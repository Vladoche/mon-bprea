using System.Net;
using System.Text;
using System.Text.Json;
using MonBprea.Admin.Core;
using MonBprea.Admin.Tests;

internal static class Program
{
    private static int _passed;
    private const string Operator = "operator@example.test";
    private const string Recipient = "participant@example.test";
    private const string FakeSecret = "sb_secret_SYNTHETIC_ONLY_WITH_NO_AUTH_CAPABILITY";
    private static readonly HumanAttestations Human = new(true, true, true);
    private static readonly WorkstationAttestations Workstation = new(true, true, true, true, true, true);
    private static readonly object Settings = new { disable_signup = true, mailer_autoconfirm = false, external = new { email = true, anonymous_users = false, phone = false } };
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-12T10:00:00Z");

    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length != 1) throw new InvalidOperationException("Provide the synthetic Node contract vector file.");
            Parity(args[0]);
            await Consultation();
            await Invitations();
            await StoreTests.RunAsync(Check);
            Console.WriteLine($"PASS: {_passed} assertions, synthetic transports only; no hosted request.");
            return 0;
        }
        catch (Exception error)
        {
            // Assert names are controlled and contain no provider payload or secret.
            Console.Error.WriteLine(error is TestFailure failure ? "FAIL: " + failure.Message : "FAIL: test infrastructure stopped (details suppressed).");
            return 1;
        }
    }

    private static void Check(string name, bool condition)
    { if (!condition) throw new TestFailure(name); _passed++; }

    private static async Task Reject(string name, string code, Func<Task> action)
    {
        try { await action(); }
        catch (AdminException error)
        {
            Check(name + " code", error.Code == code);
            Check(name + " redacted", !error.Message.Contains(FakeSecret, StringComparison.Ordinal) && !error.Message.Contains("synthetic_token", StringComparison.Ordinal));
            return;
        }
        throw new TestFailure(name + " unexpectedly succeeded");
    }

    private static bool Valid(Action action)
    { try { action(); return true; } catch (AdminException) { return false; } }

    private static void Parity(string path)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        foreach (var item in root.GetProperty("emailCases").EnumerateArray())
        {
            string? normalized = null;
            var valid = Valid(() => normalized = AdminContract.NormalizeEmail(item.GetProperty("input").GetString()));
            Check("Node email parity", valid == item.GetProperty("valid").GetBoolean());
            if (valid) Check("Node normalized email parity", normalized == item.GetProperty("normalized").GetString());
        }
        foreach (var item in root.GetProperty("settingsCases").EnumerateArray())
            Check("Node settings parity " + item.GetProperty("name").GetString(), Valid(() => AdminContract.ValidateSettings(item.GetProperty("data"))) == item.GetProperty("valid").GetBoolean());
        foreach (var item in root.GetProperty("linkCases").EnumerateArray())
        {
            string? link = null;
            var valid = Valid(() => link = AdminContract.BuildManualLink(item.GetProperty("data"), Recipient));
            Check("Node link parity " + item.GetProperty("name").GetString(), valid == item.GetProperty("valid").GetBoolean());
            if (valid) Check("Node callback parity", link == item.GetProperty("link").GetString());
        }
        foreach (var item in root.GetProperty("inventoryCases").EnumerateArray())
        {
            var response = JsonSerializer.SerializeToElement(new { users = item.GetProperty("users") });
            AccountInventory? inventory = null;
            var valid = Valid(() => inventory = AdminContract.ParseInventory(response, Operator, Now));
            Check("Node inventory parity " + item.GetProperty("name").GetString(), valid == item.GetProperty("valid").GetBoolean());
            if (valid) Check("Node inventory count parity", inventory!.Count == item.GetProperty("count").GetInt32());
        }
    }

    private static object Account(int index, bool confirmed = true, bool invited = false) => new
    {
        id = $"11111111-1111-4111-8111-{index:000000000000}",
        email = index == 1 ? Operator : $"participant-{index}@example.test",
        created_at = "2026-11-01T10:00:00Z", role = "authenticated",
        email_confirmed_at = confirmed ? "2026-11-01T10:00:00Z" : null,
        invited_at = invited ? "2026-11-01T10:00:00Z" : null
    };

    private static object[] Accounts(int count) => Enumerable.Range(1, count).Select(x => Account(x)).ToArray();

    private static AdminSession Session(FakeStore store, Router router, Clock? clock = null) =>
        new(FakeSecret, Operator, store, clock ?? new Clock(Now), router);

    private static async Task Consultation()
    {
        var store = new FakeStore { Valid = false }; var router = new Router();
        using (var session = Session(store, router))
        {
            var inventory = await session.RefreshAsync();
            Check("operator present", inventory.OperatorPresent && inventory.Count == 1 && inventory.AvailableParticipantPlaces == 6);
            Check("consultation independent from invitation storage", store.Validations == 0);
            Check("confirmed state truthful", inventory.Accounts[0].State == "Adresse confirmée");
        }
        using (var session = Session(new(), new() { Users = [] }))
        {
            var inventory = await session.RefreshAsync();
            Check("operator absent place reserved", inventory.Count == 0 && inventory.AvailableParticipantPlaces == 6 && !inventory.OperatorPresent);
        }
        using (var session = Session(new(), new() { Users = [Account(1), Account(2, false, true)] }))
        {
            var inventory = await session.RefreshAsync();
            Check("pending counted", inventory.Count == 2 && inventory.Accounts[1].State == "Invitation en attente");
        }
        using (var session = Session(new(), new() { Users = [Account(1), Account(2, false)] }))
            Check("indeterminate not fabricated", (await session.RefreshAsync()).Accounts[1].State == "Indéterminé");
        foreach (var (name, routerCase, code) in new[]
        {
            ("eight accounts", new Router { Users = Accounts(8) }, "capacity"),
            ("duplicate identities", new Router { Users = [Account(1), Account(1)] }, "lookup"),
            ("incomplete inventory", new Router { Total = 4 }, "lookup"),
            ("unexpected next page", new Router { NextPage = true }, "lookup"),
            ("malformed inventory", new Router { ListBody = "{}" }, "transport"),
            ("network read failure", new Router { ReadFailure = true }, "transport"),
            ("wrong Auth configuration", new Router { SettingsBody = "{}" }, "configuration"),
            ("redirect", new Router { Redirect = true }, "transport"),
            ("wrong response target", new Router { WrongTarget = true }, "transport"),
            ("duplicate json properties", new Router { SettingsBody = "{\"disable_signup\":true,\"disable_signup\":false}" }, "transport"),
            ("oversized body", new Router { SettingsBody = new string('x', 262145) }, "transport")
        })
        { using var session = Session(new(), routerCase); await Reject(name, code, async () => await session.RefreshAsync()); Check(name + " no POST", routerCase.Posts == 0); }
        Check("reject public key", !Valid(() => AdminContract.ValidateSecret("sb_publishable_synthetic")));
        Check("reject legacy key", !Valid(() => AdminContract.ValidateSecret("eyJhbGciOiJIUzI1NiJ9.synthetic")));
        Check("reject key final newline", !Valid(() => AdminContract.ValidateSecret(FakeSecret + "\n")));
    }

    private static async Task Invitations()
    {
        foreach (var human in new[] { new HumanAttestations(false, true, true), new(true, false, true), new(true, true, false) })
        {
            var router = new Router(); using var session = Session(new(), router);
            await Reject("human prerequisites", "attestations", async () => await session.PrepareAsync(Recipient, human, Workstation));
            Check("human prerequisites no request", router.Requests == 0);
        }
        {
            var router = new Router(); using var session = Session(new(), router);
            await Reject("invalid address", "input", async () => await session.PrepareAsync("malformed", Human, Workstation));
            await Reject("workstation prerequisites", "attestations", async () => await session.PrepareAsync(Recipient, Human, Workstation with { ProductionOpeningAuthorized = false }));
            Check("preflight prerequisites no request", router.Requests == 0);
        }
        foreach (var (name, store, router, target, code) in new[]
        {
            ("invalid private storage", new FakeStore { Valid = false }, new Router(), Recipient, "private"),
            ("previous uncertain operation", new FakeStore { Uncertain = true }, new Router(), Recipient, "pending"),
            ("previous target reservation", new FakeStore { Reserved = true }, new Router(), Recipient, "pending"),
            ("existing account", new FakeStore(), new Router(), Operator, "exists"),
            ("full capacity", new FakeStore(), new Router { Users = Accounts(7) }, Recipient, "capacity"),
            ("operator absent reserve place capacity", new FakeStore(), new Router { Users = Enumerable.Range(2, 6).Select(x => Account(x)).ToArray() }, Recipient, "capacity"),
            ("ambiguous unconfirmed account", new FakeStore(), new Router { Users = [Account(1), Account(2, false)] }, Recipient, "lookup")
        })
        { using var session = Session(store, router); await Reject(name, code, async () => await session.PrepareAsync(target, Human, Workstation)); Check(name + " no POST", router.Posts == 0); }
        {
            var store = new FakeStore(); var router = new Router { Users = [] }; using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
            Check("absent operator preflight reserves place", prepared.Inventory.AvailableParticipantPlaces == 6);
        }
        {
            var store = new FakeStore(); var router = new Router(); using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
            await Reject("cancel confirmation", "confirmation", async () => await session.GenerateAsync(prepared, ""));
            Check("cancel no reservation or POST", router.Posts == 0 && store.Reservations == 0);
        }
        {
            var clock = new Clock(Now); var store = new FakeStore(); var router = new Router(); using var session = Session(store, router, clock);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation); clock.Now += TimeSpan.FromMinutes(6);
            await Reject("stale preflight", "stale", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            Check("stale no reservation or POST", router.Posts == 0 && store.Reservations == 0);
        }
        {
            var store = new FakeStore(); var router = new Router(); using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation); router.Users = Accounts(2);
            await Reject("inventory drift", "drift", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            Check("drift no reservation or POST", router.Posts == 0 && store.Reservations == 0);
        }
        {
            var store = new FakeStore(); var router = new Router(); using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation); router.SettingsBody = "{}";
            await Reject("settings drift", "configuration", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            Check("settings drift no reservation or POST", router.Posts == 0 && store.Reservations == 0);
        }
        {
            var store = new FakeStore(); var router = new Router { BeforePost = () => Check("durable reservation precedes POST", store.Reserved && store.Locked) }; using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
            var tasks = new[] { session.GenerateAsync(prepared, prepared.ConfirmationText), session.GenerateAsync(prepared, prepared.ConfirmationText) };
            var results = await Task.WhenAll(tasks.Select(async task => { try { await task; return true; } catch (AdminException) { return false; } }));
            Check("double click one succeeds", results.Count(x => x) == 1);
            Check("double click at most one POST", router.Posts == 1 && store.Deliveries == 1 && store.Reservations == 1);
            Check("stored callback only", store.Link?.StartsWith(AdminContract.Callback + "?token_hash=", StringComparison.Ordinal) == true);
            await Reject("second generate same preparation", "pending", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            await session.MarkHandedOverAsync(store.Operation);
            Check("handoff tracked separately", store.Handovers == 1);
        }
        foreach (var (name, response, fail, deliveryFail, redirect) in new[]
        {
            ("malformed POST", "{}", false, false, false),
            ("wrong callback POST", Router.LinkResponse(callback: "https://example.test/"), false, false, false),
            ("wrong type POST", Router.LinkResponse(type: "recovery"), false, false, false),
            ("lost POST response", (string?)null, true, false, false),
            ("private delivery failure", (string?)null, false, true, false),
            ("POST redirect", (string?)null, false, false, true)
        })
        {
            var store = new FakeStore { DeliveryFailure = deliveryFail }; var router = new Router { PostBody = response, PostFailure = fail, PostRedirect = redirect };
            using (var session = Session(store, router))
            {
                var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
                await Reject(name, "uncertain", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
                Check(name + " one POST reserved", router.Posts == 1 && store.Reserved && store.Uncertain);
                await Reject(name + " retry", "pending", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            }
            using var restarted = Session(store, router);
            await Reject(name + " restart", "pending", async () => await restarted.PrepareAsync("other@example.test", Human, Workstation));
            Check(name + " remains single POST", router.Posts == 1);
        }
        {
            var store = new FakeStore(); var router = new Router { PostHttpFailure = true }; using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
            await Reject("HTTP POST rejection remains uncertain", "uncertain", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            Check("HTTP POST rejection not retried", router.Posts == 1 && store.Uncertain);
        }
        {
            var store = new FakeStore(); var router = new Router { PostHangsBody = true }; using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
            var timer = System.Diagnostics.Stopwatch.StartNew();
            await Reject("POST response body deadline", "uncertain", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            Check("POST body cancellation bounded", timer.Elapsed >= TimeSpan.FromSeconds(9) && timer.Elapsed < TimeSpan.FromSeconds(20));
            Check("POST body deadline single POST retained", router.Posts == 1 && store.Reserved && store.Uncertain);
            await Reject("POST body deadline no retry", "pending", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
        }
        {
            var store = new FakeStore { ReserveFailure = true }; var router = new Router(); using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
            await Reject("crash before reservation", "private", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            Check("crash before reservation no POST", router.Posts == 0 && !store.Reserved);
        }
        {
            var store = new FakeStore { CrashAfterReservation = true }; var router = new Router(); using var session = Session(store, router);
            var prepared = await session.PrepareAsync(Recipient, Human, Workstation);
            await Reject("crash after reservation", "private", async () => await session.GenerateAsync(prepared, prepared.ConfirmationText));
            Check("crash after reservation no POST", router.Posts == 0 && store.Reserved && store.Uncertain);
            using var restarted = Session(store, router);
            await Reject("crash reservation restart", "pending", async () => await restarted.PrepareAsync(Recipient, Human, Workstation));
        }
        {
            var session = Session(new(), new()); session.Dispose();
            await Reject("locked session", "locked", async () => await session.RefreshAsync());
        }
    }

    private sealed class TestFailure(string name) : Exception(name);
    private sealed class Clock(DateTimeOffset now) : TimeProvider
    { public DateTimeOffset Now = now; public override DateTimeOffset GetUtcNow() => Now; }

    private sealed class Router : HttpMessageHandler
    {
        public object[] Users = Accounts(1);
        public string? SettingsBody, ListBody, PostBody;
        public bool ReadFailure, Redirect, WrongTarget, NextPage, PostFailure, PostRedirect, PostHttpFailure, PostHangsBody;
        public int? Total;
        public int Posts, Requests;
        public Action? BeforePost;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++;
            Check("fixed origin", request.RequestUri?.GetLeftPart(UriPartial.Authority) == AdminContract.Api);
            Check("secret sent only header", !request.RequestUri!.AbsoluteUri.Contains(FakeSecret, StringComparison.Ordinal));
            Check("modern secret header", request.Headers.GetValues("apikey").Single() == FakeSecret);
            Check("fresh connection without continue replay", request.Headers.ConnectionClose == true && request.Headers.ExpectContinue == false
                && request.Version == HttpVersion.Version11 && request.VersionPolicy == HttpVersionPolicy.RequestVersionExact);
            var path = request.RequestUri.AbsolutePath;
            if (ReadFailure && request.Method == HttpMethod.Get) throw new HttpRequestException("synthetic provider detail suppressed");
            if (Redirect) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Found) { Headers = { Location = new Uri("https://example.test/") }, RequestMessage = request });
            string response;
            if (request.Method == HttpMethod.Post)
            {
                Check("only generate endpoint", path == "/auth/v1/admin/generate_link");
                Check("fixed callback query", request.RequestUri.Query == "?redirect_to=" + Uri.EscapeDataString(AdminContract.Callback));
                Posts++; BeforePost?.Invoke();
                if (PostFailure) throw new TaskCanceledException("synthetic timeout response loss");
                if (PostRedirect) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Found) { Headers = { Location = new Uri("https://example.test/") }, RequestMessage = request });
                if (PostHttpFailure) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.UnprocessableEntity) { Content = new StringContent("sensitive provider details suppressed"), RequestMessage = request });
                if (PostHangsBody) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new HangingContent(), RequestMessage = request });
                var content = request.Content!.ReadAsStringAsync(cancellationToken).GetAwaiter().GetResult();
                using var body = JsonDocument.Parse(content);
                Check("invite exact body", body.RootElement.EnumerateObject().Count() == 3 && body.RootElement.GetProperty("type").GetString() == "invite"
                    && body.RootElement.GetProperty("email").GetString() == Recipient && body.RootElement.GetProperty("redirectTo").GetString() == AdminContract.Callback);
                response = PostBody ?? LinkResponse();
            }
            else if (path == "/auth/v1/settings") response = SettingsBody ?? JsonSerializer.Serialize(Settings);
            else
            {
                Check("bounded first inventory page", path == "/auth/v1/admin/users" && request.RequestUri.Query == "?page=1&per_page=8");
                response = ListBody ?? JsonSerializer.Serialize(new { users = Users });
            }
            var result = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(response, Encoding.UTF8, "application/json"), RequestMessage = request };
            if (WrongTarget) result.RequestMessage = new HttpRequestMessage(request.Method, "https://example.test/");
            if (path == "/auth/v1/admin/users" && Total.HasValue) result.Headers.Add("x-total-count", Total.Value.ToString());
            if (path == "/auth/v1/admin/users" && NextPage) result.Headers.Add("Link", "<https://example.test/?page=2>; rel=\"next\"");
            return Task.FromResult(result);
        }
        public static string LinkResponse(string callback = AdminContract.Callback, string type = "invite")
        {
            const string token = "synthetic_token_without_any_auth_capability";
            return JsonSerializer.Serialize(new { id = "22222222-2222-4222-8222-222222222222", email = Recipient, verification_type = type,
                redirect_to = callback, hashed_token = token,
                action_link = AdminContract.Api + "/auth/v1/verify?token=" + token + "&type=" + type + "&redirect_to=" + Uri.EscapeDataString(callback) });
        }
    }

    private sealed class HangingContent : HttpContent
    {
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => throw new NotSupportedException();
        protected override Task<Stream> CreateContentReadStreamAsync() => Task.FromResult<Stream>(new HangingStream());
    }

    private sealed class HangingStream : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => 0; set => throw new NotSupportedException(); }
        public override void Flush() => throw new NotSupportedException();
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        { await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken); return 0; }
    }

    private sealed class FakeStore : IPrivateStore
    {
        public bool Valid = true, Uncertain, Reserved, Locked, ReserveFailure, DeliveryFailure, CrashAfterReservation;
        public int Validations, Reservations, Deliveries, Handovers;
        public string? Link;
        public Guid Operation;
        public string DirectoryPath => "PRIVATE_SYNTHETIC_DIRECTORY";
        public Task ValidateAsync() { Validations++; if (!Valid) throw new AdminException("private"); return Task.CompletedTask; }
        public Task<bool> HasUncertainOperationAsync() => Task.FromResult(Uncertain);
        public Task<bool> HasTargetReservationAsync(string email) => Task.FromResult(Reserved);
        public Task<IDisposable> AcquireLockAsync() { if (Locked) throw new AdminException("busy"); Locked = true; return Task.FromResult<IDisposable>(new Lease(() => Locked = false)); }
        public Task<Guid> ReserveAsync(string email, HumanAttestations human)
        {
            if (ReserveFailure) throw new AdminException("private");
            if (!Locked || Reserved) throw new AdminException("pending");
            Reservations++; Reserved = true; Uncertain = true; Operation = Guid.NewGuid();
            if (CrashAfterReservation) throw new AdminException("private");
            return Task.FromResult(Operation);
        }
        public Task DeliverAsync(string email, Guid operationId, string link)
        { if (DeliveryFailure) throw new AdminException("private"); Deliveries++; Link = link; Uncertain = false; return Task.CompletedTask; }
        public Task MarkHandedOverAsync(Guid operationId) { if (operationId != Operation) throw new AdminException("private"); Handovers++; return Task.CompletedTask; }
        private sealed class Lease(Action release) : IDisposable { public void Dispose() => release(); }
    }
}
