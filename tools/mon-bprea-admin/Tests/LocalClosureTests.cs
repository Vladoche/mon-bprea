using System.Net;
using System.Net.Http.Json;
using MonBprea.Admin.Core;
using MonBprea.Admin.Tests;

internal static partial class Program
{
    // This adapter is compiled exclusively in the test executable. The release
    // app cannot read this bridge or override its fixed production transport.
    private sealed class LocalTransport(Uri origin) : HttpMessageHandler
    {
        private readonly HttpClient client = new(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false });
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            if (request.RequestUri!.GetLeftPart(UriPartial.Authority) != AdminContract.Api) throw new InvalidOperationException();
            using var local = new HttpRequestMessage(request.Method, new Uri(origin, request.RequestUri.PathAndQuery));
            local.Content = request.Content is null ? null : new StringContent(await request.Content.ReadAsStringAsync(token), System.Text.Encoding.UTF8, "application/json");
            var response = await client.SendAsync(local, token);
            response.RequestMessage = request; return response;
        }
        protected override void Dispose(bool disposing) { if (disposing) client.Dispose(); base.Dispose(disposing); }
    }
    private sealed class LocalEvidence(Uri origin) : IClosureEvidenceSource
    {
        private readonly HttpClient client = new(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false });
        public async Task<ClosureEvidence?> ReadAsync(AuthAccount target, AccountInventory inventory, string ledgerHash)
        {
            var response = await client.PostAsJsonAsync(new Uri(origin, "/evidence"), new { target = target.Id, snapshot = inventory.Snapshot, ledgerHash });
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<ClosureEvidence>();
        }
    }
    private static async Task<int> LocalClosure(string address)
    {
        var origin = new Uri(address);
        if (origin.Scheme != "http" || origin.Host != "127.0.0.1" || origin.Port < 49152 || origin.AbsolutePath != "/"
            || origin.UserInfo != "" || origin.Query != "" || origin.Fragment != "") throw new InvalidOperationException();
        var store = StoreTests.CreateLocalClosureStore();
        using var session = new AdminSession(FakeSecret, "operator@example.test", store, TimeProvider.System, new LocalTransport(origin), new LocalEvidence(origin));
        var inventory = await session.RefreshAsync();
        using var lookup = new HttpClient(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false });
        var targetId = await lookup.GetStringAsync(new Uri(origin, "/target"));
        var request = new ClosureRequest("LOCAL-NATIVE-CSHARP-12", DateTimeOffset.UtcNow.AddMinutes(-1), new(true,true,true,true,true,true,true,true,true));
        var preparation = await session.PrepareClosureAsync(inventory.Accounts.Single(a => a.Id == targetId), request);
        Check("real local preparation complete", preparation.CanConfirm && preparation.Counts.Count == 10 && preparation.Counts.Values.All(n => n > 0));
        var plan = preparation.AuthorizedPlan!;
        var receipt = await session.ExecuteClosureAsync(plan, plan.ConfirmationText);
        Check("C# native HTTP deletion plus actual PostgreSQL postchecks", receipt.ActiveDataVerified && receipt.Status == ClosureStatus.ActiveDataVerifiedDeleted);
        var refused = false; try { await session.ExecuteClosureAsync(plan, plan.ConfirmationText); } catch (AdminException e) { refused = e.Code == "pending"; }
        Check("C# local native deletion cannot repeat", refused);
        Check("real EFS/ACL intent and result remain durably blocking", await store.HasUncertainOperationAsync()
            && File.Exists(Path.Combine(store.DirectoryPath,$"closure-{receipt.OperationId:D}-result.json")));
        StoreTests.RemoveLocalClosureStore(store);
        Console.WriteLine($"PASS {_passed} C# checks against isolated local Supabase; no production transport.");
        return 0;
    }
}
