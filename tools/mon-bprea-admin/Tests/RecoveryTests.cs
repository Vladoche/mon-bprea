using System.Text.Json;
using MonBprea.Admin.Core;

internal static partial class Program
{
    private const string RecoveryId = "22222222-2222-4222-8222-222222222222";
    private static readonly RecoveryAttestations RecoveryHuman = new(true, true, true, true, true);
    private static object RecoveryAccount(string id = RecoveryId, string email = Recipient, bool confirmed = true, bool banned = false) => new
    {
        id, email, role = "authenticated", created_at = "2026-11-01T10:00:00Z",
        email_confirmed_at = confirmed ? "2026-11-01T10:00:00Z" : null,
        invited_at = "2026-11-01T10:00:00Z", banned_until = banned ? "2099-01-01T10:00:00Z" : null
    };
    private static Router RecoveryRouter() => new() { Users = [Account(1), RecoveryAccount()], OperationType = "recovery" };
    private static async Task<PreparedRecovery> PrepareRecovery(AdminSession session)
    {
        var inventory = await session.RefreshAsync();
        return await session.PrepareRecoveryAsync(inventory.Accounts.Single(x => x.Email == Recipient), RecoveryHuman, Workstation);
    }
    private static void RecoveryParity(JsonElement root)
    {
        foreach (var item in root.GetProperty("recoveryLinkCases").EnumerateArray())
        {
            string? link = null;
            var valid = Valid(() => link = AdminContract.BuildManualLink(item.GetProperty("data"), Recipient, "recovery", "11111111-1111-4111-8111-111111111111"));
            Check("Node recovery link parity " + item.GetProperty("name").GetString(), valid == item.GetProperty("valid").GetBoolean());
            if (valid) Check("Node recovery callback parity", link == item.GetProperty("link").GetString());
        }
    }
    private static async Task Recoveries()
    {
        foreach (var human in new[] { RecoveryHuman with { RequestedByHolder = false }, RecoveryHuman with { IdentityCheckedViaKnownChannel = false },
            RecoveryHuman with { SelectedAddressConfirmed = false }, RecoveryHuman with { PrivateChannelAgreed = false }, RecoveryHuman with { HolderChoosesPassword = false } })
        {
            var router = RecoveryRouter(); using var session = Session(new(), router);
            var inventory = await session.RefreshAsync(); var before = router.Requests;
            await Reject("each recovery identity attestation required", "attestations", () => session.PrepareRecoveryAsync(inventory.Accounts[1], human, Workstation));
            Check("missing attestation no additional request", before == router.Requests && router.Posts == 0);
        }
        foreach (var item in JsonDocument.Parse(File.ReadAllText(NodeVectorsPath!)).RootElement.GetProperty("recoveryTargetCases").EnumerateArray())
        {
            var router = RecoveryRouter(); router.ListBody = JsonSerializer.Serialize(new { users = item.GetProperty("users") });
            using var session = Session(new(), router); var valid = false;
            try { await PrepareRecovery(session); valid = true; } catch (AdminException) {} catch (InvalidOperationException) {}
            Check("real Node recovery target parity " + item.GetProperty("name").GetString(), valid == item.GetProperty("valid").GetBoolean());
            Check("target parity no POST", router.Posts == 0);
        }
        {
            var router = RecoveryRouter(); using var session = Session(new(), router);
            var invented = new AuthAccount(RecoveryId, Recipient, Now, Now, null);
            await Reject("recovery requires verified inventory selection", "missing", () => session.PrepareRecoveryAsync(invented, RecoveryHuman, Workstation));
            await session.RefreshAsync();
            await Reject("arbitrary address absent from verified inventory", "missing", () => session.PrepareRecoveryAsync(invented with { Email = "absent@example.test" }, RecoveryHuman, Workstation));
            Check("invented selection never generates", router.Posts == 0);
        }
        foreach (var (name, users, code) in new[] {
            ("pending invitation", new object[] { Account(1), RecoveryAccount(confirmed: false) }, "missing"),
            ("invalid uuid", new object[] { Account(1), RecoveryAccount(id: "invalid") }, "lookup"),
            ("locked Auth account", new object[] { Account(1), RecoveryAccount(banned: true) }, "missing") })
        {
            var router = RecoveryRouter(); router.Users = users; using var session = Session(new(), router);
            await Reject(name, code, async () => await PrepareRecovery(session)); Check(name + " zero POST", router.Posts == 0);
        }
        foreach (var (name, code, mutate) in new (string, string, Action<Router>)[] {
            ("uuid drift", "drift", r => r.Users = [Account(1), RecoveryAccount(id: "33333333-3333-4333-8333-333333333333")]),
            ("email drift", "drift", r => r.Users = [Account(1), RecoveryAccount(email: "changed@example.test")]),
            ("confirmation drift", "drift", r => r.Users = [Account(1), RecoveryAccount(confirmed: false)]),
            ("account removed", "drift", r => r.Users = [Account(1)]),
            ("account banned after preflight", "missing", r => r.Users = [Account(1), RecoveryAccount(banned: true)]),
            ("incomplete inventory", "lookup", r => r.Total = 5),
            ("Auth configuration drift", "configuration", r => r.SettingsBody = "{}"),
            ("network fails before POST", "transport", r => r.ReadFailure = true) })
        {
            var store = new FakeStore(); var router = RecoveryRouter(); using var session = Session(store, router);
            var prepared = await PrepareRecovery(session); mutate(router);
            await Reject(name, code, () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
            Check(name + " never reserves or posts", store.Reservations == 0 && router.Posts == 0);
        }
        {
            var clock = new Clock(Now); var router = RecoveryRouter(); using var session = Session(new(), router, clock);
            var prepared = await PrepareRecovery(session); clock.Now += TimeSpan.FromMinutes(5);
            await Reject("recovery inventory at expiry", "stale", () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
            await Reject("stale selection cannot prepare", "stale", () => session.PrepareRecoveryAsync(prepared.Account, RecoveryHuman, Workstation));
            Check("stale recovery no POST", router.Posts == 0);
        }
        {
            var router = RecoveryRouter(); using var session = Session(new(), router); var prepared = await PrepareRecovery(session);
            foreach (var confirmation in new[] { "", "OK", "CONFIRMER PROD recovery other@example.test", "CONFIRMER PROD invite " + Recipient })
                await Reject("cancel or wrong recovery confirmation", "confirmation", () => session.GenerateRecoveryAsync(prepared, confirmation));
            Check("cancelled recovery no POST", router.Posts == 0);
        }
        {
            var store = new FakeStore(); var router = RecoveryRouter();
            router.Users = [RecoveryAccount(), .. Enumerable.Range(1, 6).Select(x => Account(x))];
            using var session = Session(store, router); var prepared = await PrepareRecovery(session);
            router.BeforePost = () => Check("recovery reservation and shared lock before POST", store.Uncertain && store.Locked);
            var one = session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText);
            await Reject("recovery double click", "pending", () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
            var receipt = await one;
            Check("recovery at seven accounts one POST one file same UUID", router.Posts == 1 && store.Deliveries == 1 && receipt.OperationId == store.Operation && prepared.Account.Id == RecoveryId);
            Check("recovery callback type", store.Link?.EndsWith("&type=recovery", StringComparison.Ordinal) == true);
            await Reject("not handed over blocks fresh request", "pending", async () => await PrepareRecovery(session));
            await session.MarkHandedOverAsync(receipt.OperationId);
            var another = await PrepareRecovery(session); await session.GenerateRecoveryAsync(another, another.ConfirmationText);
            Check("new legitimate recovery after separate handover", store.Reservations == 2 && router.Posts == 2);
            using var vectors = JsonDocument.Parse(File.ReadAllText(NodeVectorsPath!));
            foreach (var item in vectors.RootElement.GetProperty("recoveryRequestCases").EnumerateArray())
                Check("actual C# request matches real Node transport " + item.GetProperty("name").GetString(),
                    JsonElement.DeepEquals(router.LastPostBody, item.GetProperty("body")) == item.GetProperty("valid").GetBoolean());
            // Router checks every method/path: no Auth creation/update or pedagogical endpoint was accepted.
        }
        {
            var store = new FakeStore(); var router = RecoveryRouter(); var hold = new TaskCompletionSource(); router.HoldPost = hold.Task;
            using var session = Session(store, router); var one = await PrepareRecovery(session); var two = await PrepareRecovery(session);
            var pending = session.GenerateRecoveryAsync(one, one.ConfirmationText);
            await Reject("simultaneous independent recoveries", "busy", () => session.GenerateRecoveryAsync(two, two.ConfirmationText));
            hold.SetResult(); await pending; Check("simultaneous recovery one POST", router.Posts == 1);
        }
        foreach (var (name, mutate) in new (string, Action<Router>)[] {
            ("wrong response type", r => r.PostBody = Router.LinkResponse()),
            ("wrong response callback", r => r.PostBody = Router.LinkResponse(type: "recovery", callback: "https://example.test/")),
            ("malformed response", r => r.PostBody = "{}"),
            ("unexpected UUID", r => r.PostBody = Router.LinkResponse(type: "recovery").Replace(RecoveryId, "33333333-3333-4333-8333-333333333333")),
            ("wrong response address", r => r.PostBody = Router.LinkResponse(type: "recovery").Replace(Recipient, "other@example.test")),
            ("invalid token", r => r.PostBody = Router.LinkResponse(type: "recovery").Replace("synthetic_token_without_any_auth_capability", "short")),
            ("lost response timeout after send", r => r.PostFailure = true),
            ("HTTP rejected POST", r => r.PostHttpFailure = true),
            ("redirected POST", r => r.PostRedirect = true),
            ("body timeout after send", r => r.PostHangsBody = true) })
        {
            var store = new FakeStore(); var router = RecoveryRouter(); mutate(router);
            using (var session = Session(store, router))
            {
                var prepared = await PrepareRecovery(session);
                await Reject(name, "recovery_uncertain", () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
                await Reject(name + " no retry", "pending", () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
            }
            using var restarted = Session(store, router);
            await Reject(name + " survives restart", "pending", async () => await PrepareRecovery(restarted));
            Check(name + " one POST reservation kept", router.Posts == 1 && store.Uncertain && store.Reserved);
        }
        foreach (var after in new[] { false, true })
        {
            var store = new FakeStore { ReserveFailure = !after, CrashAfterReservation = after }; var router = RecoveryRouter(); using var session = Session(store, router);
            var prepared = await PrepareRecovery(session);
            await Reject("recovery crash before POST", "private", () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
            Check("recovery crash before POST has zero POST", router.Posts == 0 && store.Reserved == after);
        }
        {
            var store = new FakeStore { DeliveryFailure = true }; var router = RecoveryRouter(); using var session = Session(store, router);
            var prepared = await PrepareRecovery(session);
            await Reject("recovery private write failed", "recovery_uncertain", () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
            Check("private write failure cannot retry", store.Uncertain && router.Posts == 1);
        }
        {
            var store = new FakeStore(); var router = RecoveryRouter(); using var session = Session(store, router); var prepared = await PrepareRecovery(session);
            router.ReadFailure = true; await Reject("failed refresh", "transport", async () => await session.RefreshAsync()); router.ReadFailure = false;
            await Reject("failed inventory clears eligible selection", "missing", () => session.PrepareRecoveryAsync(prepared.Account, RecoveryHuman, Workstation));
            session.Dispose(); await Reject("locked recovery", "locked", () => session.GenerateRecoveryAsync(prepared, prepared.ConfirmationText));
        }
    }
    private static string? NodeVectorsPath;
}
