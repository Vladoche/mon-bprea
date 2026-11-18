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
            var router = new SimpleRouter(now); var store = new SimpleStore();
            using var session = new SimpleAdminSession(FakeSecret, AdminTarget.Production, store, TimeProvider.System, router,
                invitationGuard ?? (_ => Task.CompletedTask));
            await action(session, router, store);
        }
        await Scenario(async (s, r, st) => {
            await Reject("V2 invalid email before network", "input", () => s.CreateAsync("bad")); Check("V2 input no network", r.Posts == 0 && r.Reads == 0);
            var result = await s.CreateAsync("new@example.test");
            Check("V2 one create no attestations", r.Posts == 1 && st.Reservations.Count == 1 && result.Links.Count == 1);
            Check("V2 private link recipient", result.Links[0].Address == "new@example.test" && result.Links[0].Value.StartsWith(AdminContract.Callback));
            Check("V2 expiry is unknown without privileged source", result.ExpirySeconds is null);
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
        await SimpleWindowsStore();
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
        public void Initialize() { } public void Validate() { } public IDisposable AcquireLock() => new SimpleLease();
        public bool HasUncertainOperation() => Reservations.Any(r => r.Status != "complete");
        public bool HasLegacyTarget(string email) => false;
        public SimpleReservation? Latest(string email, SimpleOperationKind kind) => Reservations.LastOrDefault(r => r.Kind == kind && r.TargetHash == ClosureContract.TargetHash(email));
        public Guid Reserve(string email, SimpleOperationKind kind, string? accountId, string? next, DateTimeOffset now, string? backupReference = null)
        { var id = Guid.NewGuid(); Reservations.Add(new(id, kind, ClosureContract.TargetHash(email), accountId, now, "reserved", next is null ? null : ClosureContract.TargetHash(next))); return id; }
        public void RecordStep(Guid id, string step) => Steps.Add(step);
        public void Complete(SimpleResult result) { results[result.Operation] = result; var i = Reservations.FindIndex(r => r.Id == result.Operation); Reservations[i] = Reservations[i] with { Status = "complete" }; }
        public SimpleResult ReadResult(Guid id) => results[id]; public string DeletionLedgerHash() => ClosureContract.Hash("[]");
        private sealed class SimpleLease : IDisposable { public void Dispose() { } }
    }

    private sealed class SimpleRouter(DateTimeOffset now) : HttpMessageHandler
    {
        public int Posts, Reads, Deletes, Count = 2;
        public string? ReadFailure, MutationFailure, LinkAddress, UpdateFields;
        public string Email = Recipient, AccountId = RecoveryId;
        public TaskCompletionSource? Hold;
        private bool invited;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Check("V2 pinned HTTPS origin", request.RequestUri!.GetLeftPart(UriPartial.Authority) == AdminContract.Api);
            var path = request.RequestUri.AbsolutePath;
            if (request.Method == HttpMethod.Get)
            {
                Reads++;
                if (ReadFailure == "network") throw new HttpRequestException();
                if (ReadFailure == "revoked") return Reply("{}", HttpStatusCode.Unauthorized);
                if (ReadFailure == "redirect") { var redirect = Reply("{}"); redirect.Headers.Location = new Uri("https://example.invalid"); return redirect; }
                if (path.EndsWith("settings")) return Reply(JsonSerializer.Serialize(new { disable_signup = ReadFailure != "open-signup", mailer_autoconfirm = false, external = new { email = true, anonymous_users = false } }));
                var accounts = new List<object> {
                    new { id = "11111111-1111-4111-8111-111111111111", email = Operator, role = "authenticated", email_confirmed_at = now, app_metadata = new { provider = "email" } },
                    new { id = AccountId, email = Email, role = "authenticated", email_confirmed_at = now, app_metadata = new { provider = "email" } } };
                for (var n = 2; n < Count; n++) accounts.Add(new { id = $"{n+1:D8}-1111-4111-8111-111111111111", email = $"user{n}@example.test", role = "authenticated", email_confirmed_at = now });
                if (invited) accounts.Add(new { id = "99999999-1111-4111-8111-111111111111", email = LinkAddress, role = "authenticated", invited_at = now });
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
            invited = type == "invite";
            var token = "SYNTHETIC_TOKEN_NO_CAPABILITY_0123456789";
            var callback = MutationFailure == "wrong-callback" ? "https://example.invalid/" : AdminContract.Callback;
            var text = JsonSerializer.Serialize(new { id = MutationFailure == "wrong-user" ? "wrong" : invited ? "99999999-1111-4111-8111-111111111111" : AccountId,
                email = MutationFailure == "wrong-recipient" ? "wrong@example.test" : LinkAddress, verification_type = type,
                hashed_token = token, redirect_to = callback,
                action_link = AdminContract.Api + "/auth/v1/verify?token=" + token + "&type=" + type + "&redirect_to=" + Uri.EscapeDataString(callback) });
            if (MutationFailure == "duplicate-json") text = text.Replace("\"hashed_token\":", "\"hashed_token\":\"duplicate\",\"hashed_token\":");
            return Reply(text);
            HttpResponseMessage Reply(string json, HttpStatusCode status = HttpStatusCode.OK) => new(status) { RequestMessage = request, Content = new StringContent(json, Encoding.UTF8, "application/json") };
        }
    }
}
