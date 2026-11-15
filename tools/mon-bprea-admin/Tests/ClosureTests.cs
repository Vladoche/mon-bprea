using System.Net;
using System.Text;
using System.Text.Json;
using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

internal static partial class Program
{
    private const string ClosureOperatorId = "11111111-1111-4111-8111-111111111111";
    private const string ClosureTargetId = "22222222-2222-4222-8222-222222222222";
    private static ClosureRequest ClosureHuman => new("REQ-SYNTHETIC-12", Now.AddDays(-1), new(true,true,true,true,true,true,true,true,true));
    private sealed class ClosureRouter : HttpMessageHandler
    {
        public bool Deleted, LoseResponse, FailPostcheck, KeepTarget, WrongWitness;
        public int Deletes;
        public TaskCompletionSource? Hold;
        public Action? BeforeDelete;
        public string OperatorAddress = Operator, TargetAddress = Recipient;
        public string DeleteResponse = "{}";
        public bool OmitTarget { get; set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Check("closure fixed HTTPS PROD shape (synthetic transport)", request.RequestUri!.GetLeftPart(UriPartial.Authority) == AdminContract.Api);
            string text;
            if (request.Method == HttpMethod.Delete)
            {
                Check("native deletion only one exact UUID endpoint", request.RequestUri.AbsolutePath == "/auth/v1/admin/users/" + ClosureTargetId && request.RequestUri.Query == "");
                Check("hard-delete false body", await request.Content!.ReadAsStringAsync(cancellationToken) == "{\"should_soft_delete\":false}");
                Deletes++; BeforeDelete?.Invoke();
                if (Hold is not null) await Hold.Task.WaitAsync(cancellationToken);
                Deleted = !KeepTarget;
                if (LoseResponse) throw new TaskCanceledException();
                text = DeleteResponse;
            }
            else if (request.RequestUri.AbsolutePath == "/auth/v1/settings") text = JsonSerializer.Serialize(Settings);
            else {
                if (Deleted && FailPostcheck) throw new HttpRequestException();
                var users = new List<object> { new { id = WrongWitness && Deleted ? "33333333-3333-4333-8333-333333333333" : ClosureOperatorId,
                    email = OperatorAddress, role = "authenticated", app_metadata = new { provider = "email", providers = new[] { "email" } }, email_confirmed_at = "2026-11-01T10:00:00Z" } };
                if (!Deleted && !OmitTarget) users.Add(new { id = ClosureTargetId, email = TargetAddress, role = "authenticated",
                    app_metadata = new { provider = "email", providers = new[] { "email" } }, email_confirmed_at = "2026-11-01T10:00:00Z" });
                text = JsonSerializer.Serialize(new { users });
            }
            return new(HttpStatusCode.OK) { RequestMessage = request, Content = new StringContent(text, Encoding.UTF8, "application/json") };
        }
    }
    private sealed class Evidence(Clock clock) : IClosureEvidenceSource
    {
        public Func<ClosureEvidence, ClosureEvidence>? Mutate;
        public bool Missing { get; set; }
        public bool PostcheckFailure;
        public Task<ClosureEvidence?> ReadAsync(AuthAccount target, AccountInventory inventory, string ledgerHash)
        {
            if (Missing || ledgerHash == "postcheck" && PostcheckFailure) return Task.FromResult<ClosureEvidence?>(null);
            var e = new ClosureEvidence(AdminContract.Project, target.Id, ClosureOperatorId, inventory.Snapshot, clock.GetUtcNow(),
                ClosureContract.Tables.ToDictionary(t => t, _ => ledgerHash == "postcheck" ? 0L : 1L), ClosureContract.ForeignKeys.ToArray(),
                true, true, 0, 0, ledgerHash == "postcheck" ? 0 : 1, ledgerHash == "postcheck" ? 0 : 1,
                ClosureContract.Hash("witness-counts"), true, clock.GetUtcNow().AddHours(-24), ClosureContract.Hash("manifest"), ledgerHash);
            return Task.FromResult<ClosureEvidence?>(Mutate is null ? e : Mutate(e));
        }
    }
    private static async Task<ClosurePreparation> PrepareClosure(AdminSession session, ClosureRequest? request = null)
    {
        var inventory = await session.RefreshAsync();
        return await session.PrepareClosureAsync(inventory.Accounts.Single(a => a.Id == ClosureTargetId), request ?? ClosureHuman);
    }
    private static async Task Closures()
    {
        foreach (var (name, mutate) in new (string, Func<ClosureEvidence, ClosureEvidence>)[] {
            ("operator UUID", e => e with { OperatorId = ClosureTargetId }),
            ("unknown operator", e => e with { OperatorId = "33333333-3333-4333-8333-333333333333" }),
            ("wrong project", e => e with { Project = "unexpected" }),
            ("wrong UUID", e => e with { TargetId = ClosureOperatorId }),
            ("stale evidence", e => e with { ObservedAt = Now.AddMinutes(-5) }),
            ("future evidence", e => e with { ObservedAt = Now.AddSeconds(1) }),
            ("extra dependency", e => e with { ForeignKeys = [..e.ForeignKeys, "unexpected"] }),
            ("changed cascade", e => e with { ForeignKeys = e.ForeignKeys.Select(s => s.Replace(":cascade:", ":restrict:")).ToArray() }),
            ("missing table", e => e with { Rows = new Dictionary<string,long>() }),
            ("Storage object", e => e with { StorageObjects = 1 }),
            ("orphans", e => e with { Orphans = 1 }),
            ("permissions unavailable", e => e with { PermissionsVerified = false }),
            ("administrative privilege", e => e with { ParticipantVerified = false }),
            ("backup not verified", e => e with { BackupVerified = false }),
            ("expired backup", e => e with { SnapshotStartedAt = Now.AddHours(-169) }),
            ("stale ledger in restore evidence", e => e with { BackupLedgerHash = ClosureContract.Hash("old") }),
        }) {
            var clock = new Clock(Now); var store = new FakeStore(); var router = new ClosureRouter(); var source = new Evidence(clock) { Mutate = mutate };
            using var s = new AdminSession(FakeSecret, Operator, store, clock, router, source);
            var failed = false; try { await PrepareClosure(s); } catch (AdminException) { failed = true; }
            Check("closure refuses " + name, failed && router.Deletes == 0 && store.Reservations == 0);
        }
        foreach (var a in new[] { ClosureHuman.Attestations with { IdentityChecked = false }, ClosureHuman.Attestations with { RequestReceived = false },
            ClosureHuman.Attestations with { RequestedExportDelivered = false }, ClosureHuman.Attestations with { OperatorAuthorized = false } }) {
            var c = new Clock(Now); var r = new ClosureRouter(); using var s = new AdminSession(FakeSecret, Operator, new FakeStore(), c, r, new Evidence(c));
            var failed = false; try { await PrepareClosure(s, ClosureHuman with { Attestations = a }); } catch (AdminException e) { failed = e.Code == "closure_request"; }
            Check("human closure attestations never replaced by technical evidence", failed && r.Deletes == 0);
        }
        {
            var c = new Clock(Now); var r = new ClosureRouter(); using var s = new AdminSession(FakeSecret, Operator, new FakeStore(), c, r);
            var p = await PrepareClosure(s);
            Check("default production adapter cannot authorize any deletion", !p.CanConfirm && p.AuthorizedPlan is null && p.Counts.Count == 0 && p.Blockers.Count >= 3 && r.Deletes == 0);
        }
        foreach (var scenario in new[] { "success", "lost-response", "lost-and-unreadable", "postcheck-missing", "wrong-witness", "target-remains", "malformed-response" }) {
            var c = new Clock(Now); var store = new FakeStore(); var r = new ClosureRouter { LoseResponse = scenario.StartsWith("lost"), FailPostcheck = scenario == "lost-and-unreadable", WrongWitness = scenario == "wrong-witness", KeepTarget = scenario == "target-remains", DeleteResponse = scenario == "malformed-response" ? "[]" : "{}" };
            var source = new Evidence(c) { PostcheckFailure = scenario == "postcheck-missing" };
            using var s = new AdminSession(FakeSecret, Operator, store, c, r, source); var p = (await PrepareClosure(s)).AuthorizedPlan!;
            r.BeforeDelete = () => Check("durable intention before native delete", store.Locked && store.Reserved && store.Uncertain);
            var result = await s.ExecuteClosureAsync(p, p.ConfirmationText);
            Check("one delete attempt " + scenario, r.Deletes == 1 && store.ClosureResult == result);
            Check("uncertain postcheck honest " + scenario,
                scenario == "lost-and-unreadable" || scenario == "target-remains" ? result.Status == ClosureStatus.Uncertain
                : scenario is "postcheck-missing" or "wrong-witness" ? result.Status == ClosureStatus.AuthAbsentChecksIncomplete : result.ActiveDataVerified);
            var failed = false; try { await s.ExecuteClosureAsync(p, p.ConfirmationText); } catch (AdminException e) { failed = e.Code == "pending"; }
            Check("spent plan never retries " + scenario, failed && r.Deletes == 1);
            using var restarted = new AdminSession(FakeSecret, Operator, store, c, new ClosureRouter(), new Evidence(c));
            failed = false; try { await PrepareClosure(restarted); } catch (AdminException e) { failed = e.Code == "pending"; }
            Check("uncertainty persists across session restart " + scenario, failed);
        }
        foreach (var scenario in new[] { "wrong-confirmation", "stale", "changed-email", "changed-ledger", "concurrent", "double-click" }) {
            var c = new Clock(Now); var store = new FakeStore(); var r = new ClosureRouter(); var source = new Evidence(c);
            using var s = new AdminSession(FakeSecret, Operator, store, c, r, source); var p = (await PrepareClosure(s)).AuthorizedPlan!;
            if (scenario == "stale") c.Now = Now.AddMinutes(5);
            if (scenario == "changed-email") r.TargetAddress = "changed@example.test";
            if (scenario == "changed-ledger") store.LedgerHash = ClosureContract.Hash("new");
            if (scenario == "concurrent") store.Locked = true;
            if (scenario == "double-click") {
                r.Hold = new TaskCompletionSource(); var first = s.ExecuteClosureAsync(p, p.ConfirmationText);
                var failed = false; try { await s.ExecuteClosureAsync(p, p.ConfirmationText); } catch (AdminException) { failed = true; }
                Check("double-click only one destructive call", failed && r.Deletes == 1); r.Hold.SetResult(); await first;
            } else {
                var failed = false; try { await s.ExecuteClosureAsync(p, scenario == "wrong-confirmation" ? "OK" : p.ConfirmationText); } catch (AdminException) { failed = true; }
                Check("execution rechecks " + scenario, failed && r.Deletes == 0 && store.Reservations == 0);
            }
        }
        // UUID protection survives a change of operator email and arbitrary
        // operator-email input supplied at unlock.
        {
            var c = new Clock(Now); var r = new ClosureRouter { OperatorAddress = "renamed@example.test" }; var source = new Evidence(c);
            using var s = new AdminSession(FakeSecret, Recipient, new FakeStore(), c, r, source);
            var inv = await s.RefreshAsync(); var failed = false;
            try { await s.PrepareClosureAsync(inv.Accounts.Single(a => a.Id == ClosureOperatorId), ClosureHuman); } catch (AdminException) { failed = true; }
            Check("operator protected by verified UUID despite changed email", failed && r.Deletes == 0);
        }
        var vault = new AdminCredentialVault(Guid.NewGuid());
        const string firstSecret = "sb_secret_FICTITIOUS_CREDENTIAL_TEST_0000000001";
        const string secondSecret = "sb_secret_FICTITIOUS_CREDENTIAL_TEST_0000000002";
        try {
            Check("test vault absent by default", vault.Read() is null);
            vault.Save(firstSecret); Check("real Windows credential API round trip", vault.Read() == firstSecret);
            var other = new AdminCredentialVault(Guid.NewGuid()); Check("credential namespace isolated", other.Read() is null);
            vault.Save(secondSecret); Check("real Windows credential replacement", vault.Read() == secondSecret);
            var refused = false; try { vault.Save("wrong-key"); } catch (AdminException) { refused = true; }
            Check("invalid credential cannot overwrite valid entry", refused && vault.Read() == secondSecret);
            vault.Delete(); vault.Delete(); Check("real Windows credential deletion idempotent", vault.Read() is null);
        } finally { vault.Delete(); }
    }
}
