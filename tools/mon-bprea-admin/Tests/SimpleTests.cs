using System.Net;
using System.Text;
using System.Text.Json;
using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

internal static partial class Program
{
    private static async Task SimpleV2()
    {
        var now = DateTimeOffset.UtcNow;
        var account = new AuthAccount("22222222-2222-4222-8222-222222222222", Recipient, null, now, null);
        async Task Scenario(Func<SimpleAdminSession, SimpleRouter, SimpleStore, Task> action, Func<AccountInventory, Task>? invitationGuard = null)
        {
            var time = new SimpleClock(now);
            var router = new SimpleRouter(time); var store = new SimpleStore();
            using var session = new SimpleAdminSession(FakeSecret, AdminTarget.Production, store, time, router,
                invitationGuard ?? (_ => Task.CompletedTask));
            await session.CheckInvitationDurationAsync(FakeManagementToken);
            await action(session, router, store);
        }
        await Scenario(async (s, r, st) => {
            await Reject("V2 invalid email before network", "input", () => s.CreateAsync("bad")); Check("V2 input no network", r.Posts == 0 && r.Reads == 0);
            var result = await s.CreateAsync("new@example.test");
            Check("V2 one create no attestations", r.Posts == 1 && st.Reservations.Count == 1 && result.Links.Count == 1);
            Check("V2 private link recipient", result.Links[0].Address == "new@example.test" && result.Links[0].Value.StartsWith(AdminContract.Callback));
            Check("V2.2 expiry sourced from verified management API", result.ExpirySeconds == 86400);
            Check("V2 no fabricated consent", !JsonSerializer.Serialize(st.Reservations).Contains("attestation", StringComparison.OrdinalIgnoreCase));
        });
        await Scenario(async (s, r, st) => {
            await Reject("V2 duplicate", "exists", () => s.CreateAsync(Recipient)); Check("V2 duplicate no mutation", r.Posts == 0 && st.Reservations.Count == 0);
            r.Count = 7; await Reject("V2 capacity", "capacity", () => s.CreateAsync("new@example.test")); Check("V2 cap no post", r.Posts == 0);
        });
        foreach (var failure in new[] { "network", "redirect", "revoked", "open-signup", "pagination" })
            await Scenario(async (s, r, st) => {
                r.ReadFailure = failure;
                await Reject("V2 preflight " + failure, failure == "revoked" ? "key_revoked" : failure == "open-signup" ? "configuration" : failure == "pagination" ? "lookup" : "transport", () => s.CreateAsync("new@example.test"));
                Check("V2 failed read no reservation " + failure, st.Reservations.Count == 0 && r.Posts == 0);
            });
        foreach (var failure in new[] { "lost", "wrong-user", "wrong-recipient", "wrong-callback", "duplicate-json" })
            await Scenario(async (s, r, st) => {
                r.MutationFailure = failure;
                await Reject("V2 uncertain " + failure, "uncertain", () => s.CreateAsync("new@example.test"));
                Check("V2 durable intent " + failure, st.HasUncertainOperation() && st.Reservations.Count == 1 && r.Posts == 1);
                await Reject("V2 never retry " + failure, "pending", () => s.CreateAsync("new@example.test")); Check("V2 post not repeated " + failure, r.Posts == 1);
            });
        await Scenario(async (s, r, st) => {
            r.Hold = new TaskCompletionSource(); var first = s.CreateAsync("new@example.test");
            await Reject("V2 double click", "busy", () => s.CreateAsync("second@example.test"));
            r.Hold.SetResult(); await first; Check("V2 exclusive generation", r.Posts == 1);
        });
        await Scenario(async (s, r, st) => {
            var current = (await s.RefreshAsync()).Accounts.Single(a => a.Email == Recipient);
            var receipt = await s.RecoverAsync(current, SimpleOperationKind.Password);
            current = (await s.RefreshAsync()).Accounts.Single(a => a.Email == Recipient);
            var repeated = await s.RecoverAsync(current, SimpleOperationKind.Password);
            Check("V2 redisplay same link without new generation", receipt.Operation == repeated.Operation && r.Posts == 1);
            Check("V2 replay is explicitly labelled", repeated.Reused && repeated.Title.Contains("déjà"));
            var replacement = await s.RecoverAsync(current, SimpleOperationKind.Password, newLink: true);
            Check("V2 deliberate new request can replace used link without known expiry", replacement.Operation != receipt.Operation && r.Posts == 2);
            await Reject("V2 email requires real decision", "identity", () => s.RecoverAsync(current, SimpleOperationKind.Email, "new@example.test"));
            await Reject("V2 decision bound to uuid", "identity", () => s.RecoverAsync(current, SimpleOperationKind.Email, "new@example.test", new("wrong", "new@example.test", now)));
            await Reject("V2 decision bound to address", "identity", () => s.RecoverAsync(current, SimpleOperationKind.Email, "new@example.test", new(current.Id, "other@example.test", now)));
            await Reject("V2 old decision refused", "identity", () => s.RecoverAsync(current, SimpleOperationKind.Email, "new@example.test", new(current.Id, "new@example.test", now.AddMinutes(-6))));
        });
        foreach (var kind in new[] { SimpleOperationKind.Email, SimpleOperationKind.EmailAndPassword })
            await Scenario(async (s, r, st) => {
                var selected = (await s.RefreshAsync()).Accounts.Single(a => a.Email == Recipient);
                var result = await s.RecoverAsync(selected, kind, "new@example.test", new(selected.Id, "new@example.test", now));
                Check("V2 email uuid preserved " + kind, r.AccountId == selected.Id && r.Email == "new@example.test");
                Check("V2 no role or password admin write " + kind, r.UpdateFields == "email,email_confirm");
                Check("V2 combined recovery goes to new email " + kind, kind == SimpleOperationKind.Email ? r.Posts == 0 : r.LinkAddress == "new@example.test");
                Check("V2 real intermediate step " + kind, st.Steps.SequenceEqual(new[] { "email-modified" }) && result.Title.Contains("Adresse modifiée"));
            });
        await Scenario(async (s, r, st) => {
            var selected = (await s.RefreshAsync()).Accounts.Single(a => a.Email == Recipient); r.MutationFailure = "lost";
            await Reject("V2 combined partial result", "email_partial", () => s.RecoverAsync(selected, SimpleOperationKind.EmailAndPassword,
                "new@example.test", new(selected.Id, "new@example.test", now)));
            Check("V2 partial state retained", r.Email == "new@example.test" && st.Steps.Count == 1 && st.HasUncertainOperation());
        });
        await Scenario(async (s, r, st) => {
            var first = await s.CreateAsync("new@example.test");
            var same = await s.CreateAsync("new@example.test");
            Check("V2 existing invitation retrieved without recreation", same.Operation == first.Operation && same.Reused && r.Posts == 1);
        });
        await Scenario(async (s, r, st) => {
            var selected = (await s.RefreshAsync()).Accounts.Single(a => a.Email == Recipient);
            await Reject("V2 PROD deletion cannot activate", "deletion_unqualified", () => s.DeleteAsync(selected));
            Check("V2 no PROD DELETE or reservation", r.Deletes == 0 && st.Reservations.Count == 0);
        });
        foreach (var code in new[] { "backup_expired", "backup_comparison", "backup_ledger", "backup_inventory" })
        {
            await Scenario(async (s, r, st) => {
                await Reject("V2 invitation guard " + code, code, () => s.CreateAsync("new@example.test"));
                Check("V2 backup refusal avoids reservation and POST " + code, st.Reservations.Count == 0 && r.Posts == 0);
            }, _ => Task.FromException(new AdminException(code)));
        }
        await Scenario(InvitationLifecycleTests);
        foreach (var failure in new[] { "lost", "lost-after", "receipt" })
            await Scenario(async (s, r, st) => {
                var first = await s.CreateAsync("new@example.test");
                r.Clock.Now = r.Clock.Now.AddDays(2);
                var review = await s.ReviewInvitationAsync((await s.RefreshAsync()).Accounts.Single(a => a.Id == first.AccountId));
                if (failure == "receipt") st.SkipReceipt = true;
                else r.MutationFailure = failure;
                await Reject("renewal ambiguous " + failure, "uncertain", () => s.RenewInvitationAsync(review));
                Check("durable renewal reservation " + failure, st.PendingInvitationRenewal()?.InitialInvitation == first.Operation);
                await Reject("no blind retry " + failure, "pending", () => s.RenewInvitationAsync(review));
                if (failure == "receipt") await s.ReconcileInvitationAsync();
                else await Reject("Auth identity alone insufficient " + failure, "invitation_no_receipt", s.ReconcileInvitationAsync);
                Check("reconciliation never calls generateLink " + failure, r.Posts == 2 && st.HasUncertainOperation() == (failure != "receipt"));
            });
        foreach (var legacy in new[] { true, false })
            await Scenario(async (s, r, st) => {
                const string email = "historic@example.test";
                var created = r.Clock.Now.AddMinutes(-90);
                r.InvitationEmail = email; r.InvitedAt = created.AddSeconds(2); r.InviteCreatedAt = r.InvitedAt;
                Guid initial;
                if (legacy)
                {
                    initial = Guid.NewGuid(); st.Legacy = new(initial, created, created.AddSeconds(5));
                }
                else
                {
                    initial = st.Reserve(email, SimpleOperationKind.Invite, null, null, created);
                    st.Complete(new(initial, "V2.1", "", [new(email, "historic synthetic")], created, null, r.InviteId));
                }
                var selected = (await s.RefreshAsync()).Accounts.Single(a => a.Id == r.InviteId);
                var review = await s.ReviewInvitationAsync(selected);
                Check("historic unknown lifetime " + legacy, review.State == InvitationState.DurationUnknown && review.InitialOperation == initial);
                await Reject("unknown historical link never copied " + legacy, "invitation_unusable", () => s.ReadInvitationLinkAsync(selected, initial));
                var renewed = await s.RenewInvitationAsync(review);
                Check("historic identity preserved " + legacy, renewed.AccountId == selected.Id && st.PendingInvitationRenewal() is null);
            });
        await Scenario(async (s, r, st) => {
            var created = await s.CreateAsync("new@example.test");
            var selected = (await s.RefreshAsync()).Accounts.Single(a => a.Id == created.AccountId);
            var review = await s.ReviewInvitationAsync(selected);
            using (st.AcquireLock())
                await Reject("two executors share lock", "busy", () => s.RenewInvitationAsync(review));
            r.Clock.Now = r.Clock.Now.AddMinutes(1);
            r.Hold = new();
            var renewal = s.RenewInvitationAsync(review);
            await Reject("double renewal click", "busy", () => s.RenewInvitationAsync(review));
            r.Hold.SetResult(); await renewal;
            await Reject("stale click cannot replace current link", "invitation_changed", () => s.RenewInvitationAsync(review));
            Check("double click results in one renewal", r.Posts == 2);
        });
        await SimpleWindowsStore();
    }

    private static async Task InvitationLifecycleTests(SimpleAdminSession s, SimpleRouter r, SimpleStore st)
    {
        const string email = "new@example.test";
        r.Otp = null;
        await Reject("unknown PROD expiration blocks issuance", "otp_unverified", () => s.CreateAsync(email));
        r.Otp = 3600;
        Check("short hosted configuration shown as read", await s.CheckInvitationDurationAsync(FakeManagementToken) == 3600);
        await Reject("short PROD expiration blocks issuance", "otp_duration", () => s.CreateAsync(email));
        Check("wrong settings reserve nothing", r.Posts == 0 && st.Reservations.Count == 0);
        r.Otp = 86400;
        r.Count = 6;
        var first = await s.CreateAsync(email);
        var selected = (await s.RefreshAsync()).Accounts.Single(a => a.Id == first.AccountId);
        var review = await s.ReviewInvitationAsync(selected);
        Check("first link pending and usable at seven accounts", review.State == InvitationState.Pending
            && (await s.ReadInvitationLinkAsync(selected, first.Operation)) == first.Links[0]);
        await Reject("wrong UUID cannot renew", "invitation_changed", () => s.ReviewInvitationAsync(selected with { Id = RecoveryId }));
        await Reject("wrong address cannot renew", "invitation_changed", () => s.ReviewInvitationAsync(selected with { Email = Recipient }));
        r.Banned = true;
        await Reject("restricted invitation cannot renew", "invitation_restricted", () => s.ReviewInvitationAsync(selected));
        r.Banned = false; r.OtherRecovery = true;
        await Reject("contradictory recovery cannot renew", "invitation_history", () => s.ReviewInvitationAsync(selected));
        r.OtherRecovery = false;
        var firstReservation = st.Reservations.Single();
        st.Reservations.Clear();
        await Reject("nonconfirmed with no journal cannot renew", "invitation_history", () => s.ReviewInvitationAsync(selected));
        st.Reservations.Add(firstReservation);
        r.Clock.Now = r.Clock.Now.AddSeconds(86400);
        review = await s.ReviewInvitationAsync(selected);
        Check("expired at exact boundary", review.State == InvitationState.Expired);
        await Reject("expired link cannot be copied", "invitation_unusable", () => s.ReadInvitationLinkAsync(selected, first.Operation));
        await Reject("creation routes an expired invitation to recovery", "invitation_existing", () => s.CreateAsync(email));
        r.ReadFailure = "network";
        await Reject("network failure before reserve", "transport", () => s.RenewInvitationAsync(review));
        r.ReadFailure = null;
        Check("preflight failure creates no extra reservation", st.Reservations.Count == 1 && r.Posts == 1);
        var renewal = await s.RenewInvitationAsync(review);
        Check("renewal preserves UUID and quota", renewal.AccountId == first.AccountId && (await s.RefreshAsync()).Count == 7);
        Check("renewal links to initial operation", st.Reservations[0] == firstReservation && st.Reservations[1].InitialInvitation == first.Operation);
        await Reject("superseded operation cannot be copied", "invitation_changed", () => s.ReadInvitationLinkAsync(selected, first.Operation));
        Check("new link can be copied", (await s.ReadInvitationLinkAsync(selected, renewal.Operation)).Address == email);
        r.Clock.Now = r.Clock.Now.AddSeconds(86401);
        var secondReview = await s.ReviewInvitationAsync(selected);
        var secondRenewal = await s.RenewInvitationAsync(secondReview);
        Check("successive renewals retain root and order", secondReview.LatestOperation == renewal.Operation
            && st.Reservations[2].InitialInvitation == first.Operation && secondRenewal.Operation != renewal.Operation);
        var beforeActivation = await s.ReviewInvitationAsync(selected);
        r.ActivateOnRead = r.Reads + 4;
        await Reject("activation between selection and POST switches to recovery", "invitation_activated", () => s.RenewInvitationAsync(beforeActivation));
        Check("activated account never reinvited", r.Posts == 3 && st.Reservations.Count == 3);
        await Reject("activated address routed to normal recovery", "exists", () => s.CreateAsync(email));
        var account = (await s.RefreshAsync()).Accounts.Single(a => a.Id == first.AccountId);
        Check("normal recovery still enabled after renewal activation", (await s.RecoverAsync(account, SimpleOperationKind.Password)).AccountId == account.Id);
    }

    private static async Task SimpleWindowsStore()
    {
        var defaultPath = @"C:\synthetic\Private";
        foreach (var configuration in new[] { new[] { defaultPath }, new[] { @"C:\synthetic\Historical" } })
            await Reject("V2 missing historical pointer cannot create empty store", "legacy_conflict", () => Task.Run(() =>
                AutomaticPrivateStore.ResolveDirectory(defaultPath, configuration, false, _ => false, _ => false)));
        await Reject("V2 saved credential without known history cannot create empty store", "legacy_conflict", () => Task.Run(() =>
            AutomaticPrivateStore.ResolveDirectory(defaultPath, [], true, _ => false, _ => false)));
        Check("V2 new setup can initialize default directory", AutomaticPrivateStore.ResolveDirectory(defaultPath, [], false, _ => false, _ => false) == defaultPath);
        var lostPath = Path.Combine(Path.GetTempPath(), "mon-bprea-v2-lost-" + Guid.NewGuid().ToString("N"));
        var lostStore = new AutomaticPrivateStore(AdminTarget.LocalQualification(Guid.NewGuid()), lostPath);
        lostStore.Initialize();
        if (Path.GetFileName(lostPath).StartsWith("mon-bprea-v2-lost-", StringComparison.Ordinal) && Directory.GetFileSystemEntries(lostPath).Length == 0)
            Directory.Delete(lostPath); // This test's own verified empty directory only.
        await Reject("V2 missing initialized store is never recreated", "legacy_conflict", () => Task.Run(lostStore.Initialize));
        Check("V2 no empty history after loss", !Directory.Exists(lostPath));
        var root = Path.Combine(Path.GetTempPath(), "mon-bprea-v2-store-" + Guid.NewGuid().ToString("N"));
        var target = AdminTarget.LocalQualification(Guid.NewGuid());
        var store = new AutomaticPrivateStore(target, root);
        try
        {
            store.Initialize(); Check("V2 auto private directory and real DPAPI", Directory.Exists(root));
            Guid id;
            using (store.AcquireLock())
            {
                await Reject("V2 another instance excluded", "busy", () => Task.Run(() => new AutomaticPrivateStore(target, root).AcquireLock()));
                id = store.Reserve(Recipient, SimpleOperationKind.Password, RecoveryId, null, DateTimeOffset.UtcNow);
                Check("V2 reservation flushed before link", store.HasUncertainOperation());
                var result = new SimpleResult(id, "Lien créé", "synthetic", [new(Recipient, "synthetic-protected-link-0123456789")], DateTimeOffset.UtcNow);
                store.Complete(result);
            }
            var second = new AutomaticPrivateStore(target, root); second.Initialize();
            Check("V2 restart same encrypted link", second.ReadResult(id).Links[0].Value == "synthetic-protected-link-0123456789");
            Check("V2 completed generation distinct from uncertainty", !second.HasUncertainOperation());
            foreach (var path in Directory.GetFiles(root))
            {
                var bytes = File.ReadAllBytes(path); var text = Encoding.UTF8.GetString(bytes);
                Check("V2 no plain link or email " + Path.GetExtension(path), !text.Contains("synthetic-protected-link") && !text.Contains(Recipient));
                WindowsPrivateStore.VerifyProtectedFile(path);
            }
            try { new AutomaticPrivateStore(AdminTarget.LocalQualification(Guid.NewGuid()), root).ReadResult(id); Check("V2 namespace binding", false); }
            catch (AdminException) { Check("V2 namespace binding", true); }
            foreach (var version in new int?[] { 4, 99, null })
            {
                var orphanPath = Path.Combine(root, "orphan-closure-" + (version?.ToString() ?? "unknown"));
                var orphan = new AutomaticPrivateStore(target, orphanPath); orphan.Initialize();
                var ledgerPath = Path.Combine(orphanPath, "deletions.json");
                var ledgerBytes = JsonSerializer.SerializeToUtf8Bytes(new[] { new { version, type = "closure", operationId = Guid.NewGuid(), status = "pending/uncertain" } });
                using (var ledger = WindowsPrivateStore.NewV2File(ledgerPath)) { ledger.Write(ledgerBytes); ledger.Flush(true); }
                Check("V2 orphan closure ledger blocks without event files " + version, orphan.HasUncertainOperation());
                var reopened = new AutomaticPrivateStore(target, orphanPath); reopened.Initialize();
                Check("V2 orphan closure ledger survives restart " + version, reopened.HasUncertainOperation());
                Check("legacy C# also blocks orphan V2 ledger " + version, await new WindowsPrivateStore(orphanPath, "").HasUncertainOperationAsync());
                using (reopened.AcquireLock())
                    await Reject("V2 orphan closure refuses new reservation " + version, "pending", () => Task.Run(() =>
                        reopened.Reserve("other@example.test", SimpleOperationKind.Password, RecoveryId, null, DateTimeOffset.UtcNow)));
                Check("V2 orphan ledger preserved and no replacement events " + version,
                    File.ReadAllBytes(ledgerPath).SequenceEqual(ledgerBytes) && Directory.GetFiles(orphanPath).Length == 1);
            }
        }
        finally
        {
            var absolute = Path.GetFullPath(root);
            if (!absolute.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase)
                || !Path.GetFileName(absolute).StartsWith("mon-bprea-v2-store-", StringComparison.Ordinal)
                || Directory.EnumerateFileSystemEntries(absolute, "*", SearchOption.AllDirectories).Any(p => File.GetAttributes(p).HasFlag(FileAttributes.ReparsePoint))) throw new InvalidOperationException();
            Directory.Delete(absolute, true);
        }
    }

    private sealed class SimpleStore : ISimplePrivateStore
    {
        public List<SimpleReservation> Reservations = []; public List<string> Steps = [];
        private readonly Dictionary<Guid, SimpleResult> results = new();
        public bool SkipReceipt;
        public LegacyInvitation? Legacy;
        private int locked;
        public void Initialize() { } public void Validate() { }
        public IDisposable AcquireLock()
        {
            if (Interlocked.Exchange(ref locked, 1) != 0) throw new AdminException("busy");
            return new SimpleLease(() => Volatile.Write(ref locked, 0));
        }
        public bool HasUncertainOperation() => Reservations.Any(r => r.Status != "complete");
        public bool HasLegacyTarget(string email) => false;
        public SimpleReservation? Latest(string email, SimpleOperationKind kind) => Reservations.LastOrDefault(r => r.Kind == kind && r.TargetHash == ClosureContract.TargetHash(email));
        public IReadOnlyList<SimpleReservation> InvitationHistory(string email) => Reservations.Where(r => r.TargetHash == ClosureContract.TargetHash(email)
            && r.Kind is SimpleOperationKind.Invite or SimpleOperationKind.RenewInvitation).ToArray();
        public LegacyInvitation? FindLegacyInvitation(string email) => Legacy;
        public SimpleReservation? PendingInvitationRenewal() => Reservations.SingleOrDefault(r => r.Kind == SimpleOperationKind.RenewInvitation && r.Status != "complete");
        public Guid Reserve(string email, SimpleOperationKind kind, string? accountId, string? next, DateTimeOffset now,
            string? backupReference = null, Guid? initialInvitation = null)
        { var id = Guid.NewGuid(); Reservations.Add(new(id, kind, ClosureContract.TargetHash(email), accountId, now, "reserved", next is null ? null : ClosureContract.TargetHash(next), initialInvitation)); return id; }
        public void RecordStep(Guid id, string step) => Steps.Add(step);
        public void Complete(SimpleResult result)
        {
            results[result.Operation] = result;
            if (SkipReceipt) throw new AdminException("private");
            ReconcileInvitation(result);
        }
        public void ReconcileInvitation(SimpleResult result)
        {
            var i = Reservations.FindIndex(r => r.Id == result.Operation);
            Reservations[i] = Reservations[i] with { Status = "complete" };
        }
        public SimpleResult ReadResult(Guid id) => results[id]; public string DeletionLedgerHash() => ClosureContract.Hash("[]");
        private sealed class SimpleLease(Action release) : IDisposable { public void Dispose() => release(); }
    }

    private const string FakeManagementToken = "sbp_fixture_read_only_1234567890";
    private sealed class SimpleClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }
    private sealed class SimpleRouter(SimpleClock time) : HttpMessageHandler
    {
        public SimpleClock Clock => time;
        public int Posts, Reads, Deletes, Count = 2;
        public string? ReadFailure, MutationFailure, LinkAddress, UpdateFields;
        public string Email = Recipient, AccountId = RecoveryId;
        public TaskCompletionSource? Hold;
        public string InviteId = "99999999-1111-4111-8111-111111111111";
        public string? InvitationEmail;
        public DateTimeOffset? InvitedAt, InviteCreatedAt;
        public bool Activated, Banned, OtherRecovery;
        public int? Otp = 86400;
        public int? ActivateOnRead;
        private readonly DateTimeOffset now = time.Now;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.RequestUri!.Host == "api.supabase.com")
            {
                Check("OTP management only fixed GET with independent bearer",
                    request.Method == HttpMethod.Get && request.RequestUri.AbsolutePath == "/v1/projects/" + AdminContract.Project + "/config/auth"
                    && request.Headers.Authorization?.Parameter == FakeManagementToken && !request.Headers.Contains("apikey"));
                return Otp is int seconds ? Reply(JsonSerializer.Serialize(new { mailer_otp_exp = seconds })) : Reply("{}", HttpStatusCode.Forbidden);
            }
            Check("V2 pinned HTTPS origin", request.RequestUri!.GetLeftPart(UriPartial.Authority) == AdminContract.Api);
            var path = request.RequestUri.AbsolutePath;
            if (request.Method == HttpMethod.Get)
            {
                Reads++;
                if (Reads == ActivateOnRead) Activated = true;
                if (ReadFailure == "network") throw new HttpRequestException();
                if (ReadFailure == "revoked") return Reply("{}", HttpStatusCode.Unauthorized);
                if (ReadFailure == "redirect") { var redirect = Reply("{}"); redirect.Headers.Location = new Uri("https://example.invalid"); return redirect; }
                if (path.EndsWith("settings")) return Reply(JsonSerializer.Serialize(new { disable_signup = ReadFailure != "open-signup", mailer_autoconfirm = false, external = new { email = true, anonymous_users = false } }));
                var accounts = new List<object> {
                    new { id = "11111111-1111-4111-8111-111111111111", email = Operator, role = "authenticated", email_confirmed_at = now, app_metadata = new { provider = "email" } },
                    new { id = AccountId, email = Email, role = "authenticated", email_confirmed_at = now, app_metadata = new { provider = "email" } } };
                for (var n = 2; n < Count; n++) accounts.Add(new { id = $"{n+1:D8}-1111-4111-8111-111111111111", email = $"user{n}@example.test", role = "authenticated", email_confirmed_at = now });
                if (InvitationEmail is not null) accounts.Add(new { id = InviteId, email = InvitationEmail, role = "authenticated",
                    created_at = InviteCreatedAt, invited_at = InvitedAt, confirmation_sent_at = InvitedAt,
                    email_confirmed_at = Activated ? (DateTimeOffset?)time.Now : null, banned_until = Banned ? (DateTimeOffset?)time.Now.AddHours(1) : null,
                    recovery_sent_at = OtherRecovery ? (DateTimeOffset?)time.Now : null, app_metadata = new { provider = "email" } });
                var response = Reply(JsonSerializer.Serialize(new { users = accounts }));
                if (ReadFailure == "pagination") response.Headers.TryAddWithoutValidation("Link", "<next>; rel=next");
                return response;
            }
            if (request.Method == HttpMethod.Delete) { Deletes++; return Reply("{}"); }
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
            if (request.Method == HttpMethod.Put)
            {
                UpdateFields = string.Join(',', body.RootElement.EnumerateObject().Select(p => p.Name).Order());
                Email = body.RootElement.GetProperty("email").GetString()!;
                return Reply(JsonSerializer.Serialize(new { id = AccountId, email = Email }));
            }
            Posts++; if (Hold is not null) await Hold.Task;
            if (MutationFailure == "lost") throw new HttpRequestException();
            var type = body.RootElement.GetProperty("type").GetString()!; LinkAddress = body.RootElement.GetProperty("email").GetString()!;
            var invite = type == "invite";
            if (invite)
            {
                InvitationEmail = LinkAddress;
                InviteCreatedAt ??= time.Now;
                InvitedAt = time.Now;
            }
            if (MutationFailure == "lost-after") throw new HttpRequestException();
            var token = "SYNTHETIC_TOKEN_NO_CAPABILITY_0123456789";
            var callback = MutationFailure == "wrong-callback" ? "https://example.invalid/" : AdminContract.Callback;
            var text = JsonSerializer.Serialize(new { id = MutationFailure == "wrong-user" ? "wrong" : invite || LinkAddress == InvitationEmail ? InviteId : AccountId,
                email = MutationFailure == "wrong-recipient" ? "wrong@example.test" : LinkAddress, verification_type = type,
                hashed_token = token, redirect_to = callback, invited_at = InvitedAt,
                action_link = AdminContract.Api + "/auth/v1/verify?token=" + token + "&type=" + type + "&redirect_to=" + Uri.EscapeDataString(callback) });
            if (MutationFailure == "duplicate-json") text = text.Replace("\"hashed_token\":", "\"hashed_token\":\"duplicate\",\"hashed_token\":");
            return Reply(text);
            HttpResponseMessage Reply(string json, HttpStatusCode status = HttpStatusCode.OK) => new(status) { RequestMessage = request, Content = new StringContent(json, Encoding.UTF8, "application/json") };
        }
    }
}
