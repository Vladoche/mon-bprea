using System.Net;
using System.Text;
using System.Text.Json;

namespace MonBprea.Admin.Core;

public sealed partial class SimpleAdminSession : IDisposable
{
    private string? secret;
    private readonly AdminTarget target;
    private readonly ISimplePrivateStore store;
    private readonly HttpClient http;
    private readonly TimeProvider clock;
    private readonly Func<AccountInventory, Task>? invitationGuard;
    private readonly SemaphoreSlim mutation = new(1, 1);
    private readonly Func<AccountInventory, bool>? operatorPresent;
    private AccountInventory? inventory;
    private LocalCapabilities? capabilities;

    public SimpleAdminSession(string key, AdminTarget target, ISimplePrivateStore store, Func<AccountInventory, Task>? invitationGuard = null,
        Func<AccountInventory, bool>? operatorPresent = null)
        : this(key, target, store, TimeProvider.System, new SocketsHttpHandler {
            AllowAutoRedirect = false, UseProxy = false, UseCookies = false,
            PooledConnectionLifetime = TimeSpan.Zero, ConnectTimeout = TimeSpan.FromSeconds(10) }, invitationGuard, operatorPresent) { }
    internal SimpleAdminSession(string key, AdminTarget target, ISimplePrivateStore store, TimeProvider time,
        HttpMessageHandler handler, Func<AccountInventory, Task>? invitationGuard = null,
        Func<AccountInventory, bool>? operatorPresent = null)
    {
        AdminContract.ValidateSecret(key);
        secret = key; this.target = target; this.store = store; clock = time;
        this.invitationGuard = invitationGuard; this.operatorPresent = operatorPresent;
        http = new(handler, true) { Timeout = TimeSpan.FromSeconds(15) };
    }

    public async Task<AccountInventory> RefreshAsync()
    {
        inventory = null;
        using (var settings = await Send(HttpMethod.Get, "/auth/v1/settings")) AdminContract.ValidateSettings(settings.RootElement);
        using var users = await Send(HttpMethod.Get, AdminContract.InventoryPath, inventoryResponse: true);
        // Operator identity is not guessed from the public contact or from
        // whichever account happens to be first. PROD deletion stays blocked.
        var observed = AdminContract.ParseInventory(users.RootElement, null, clock.GetUtcNow());
        if (target.IsLocal)
        {
            using var response = await Send(HttpMethod.Get, "/capabilities", capability: true);
            var c = response.RootElement.Deserialize<LocalCapabilities>() ?? throw new AdminException("configuration");
            if (c.Project != target.Project || !ClosureContract.Uuid(c.OperatorId) || c.OtpExpiry is < 1 or > 86400
                || c.ObservedAt > clock.GetUtcNow() || clock.GetUtcNow() - c.ObservedAt > TimeSpan.FromMinutes(1)) throw new AdminException("configuration");
            capabilities = c;
            observed = observed with { OperatorPresent = observed.Accounts.Any(a => a.Id == c.OperatorId) };
        }
        else if (operatorPresent is not null)
            observed = observed with { OperatorPresent = operatorPresent(observed) };
        return inventory = observed;
    }

    public async Task<SimpleResult> CreateAsync(string address)
    {
        var email = AdminContract.NormalizeEmail(address);
        return await IssueInvitation(email, null);
    }

    public Task<SimpleResult> RecoverAsync(AuthAccount selected, SimpleOperationKind kind, string? newAddress = null,
        KnownChannelDecision? decision = null, bool newLink = false)
    {
        if (kind is not (SimpleOperationKind.Password or SimpleOperationKind.Email or SimpleOperationKind.EmailAndPassword))
            throw new AdminException("input");
        if (newLink && kind != SimpleOperationKind.Password) throw new AdminException("input");
        RequireSelection(selected);
        string? next = null;
        if (kind != SimpleOperationKind.Password)
        {
            next = AdminContract.NormalizeEmail(newAddress);
            if (next == selected.Email) throw new AdminException("exists");
            if (decision is null || decision.AccountId != selected.Id || decision.NewEmail != next
                || decision.DecidedAt > clock.GetUtcNow() || clock.GetUtcNow() - decision.DecidedAt >= TimeSpan.FromMinutes(5))
                throw new AdminException("identity");
        }
        return Mutate(selected.Email, kind, selected, next, decision, newLink);
    }

    private async Task<SimpleResult> Mutate(string email, SimpleOperationKind kind, AuthAccount? selected, string? next,
        KnownChannelDecision? decision, bool newLink = false)
    {
        if (!await mutation.WaitAsync(0)) throw new AdminException("busy");
        try
        {
            store.Validate();
            using var lease = store.AcquireLock();
            if (store.HasUncertainOperation()) throw new AdminException("pending");
            var current = await RefreshAsync();
            if (selected is not null) RequireCurrent(current, selected);
            var prior = store.Latest(email, kind);
            if (prior is not null)
            {
                if (prior.Status != "complete" || prior.NextHash != (next is null ? null : ClosureContract.TargetHash(next)))
                    throw new AdminException("pending");
                var saved = store.ReadResult(prior.Id);
                var boundId = saved.AccountId ?? prior.AccountId;
                if (boundId is null || current.Accounts.All(a => a.Id != boundId || a.Email != (next ?? email)))
                    throw new AdminException("drift");
                if (!newLink && kind == SimpleOperationKind.Password)
                    return saved with { Reused = true, Title = "Lien de récupération déjà créé" };
            }
            if (next is not null && current.Accounts.Any(a => a.Email == next)) throw new AdminException("exists");
            if (store.HasLegacyTarget(email) || next is not null && store.HasLegacyTarget(next)) throw new AdminException("pending");
            var now = clock.GetUtcNow();
            var id = store.Reserve(email, kind, selected?.Id, next, now);
            var emailChanged = false;
            try
            {
                if (next is not null)
                {
                    // Official admin update: same UUID, no role, metadata or
                    // password field. This deliberately uses the operator's
                    // verified known-channel decision, not an old-mailbox OTP.
                    using var changed = await Send(HttpMethod.Put, "/auth/v1/admin/users/" + selected!.Id,
                        new { email = next, email_confirm = true });
                    if (changed.RootElement.GetProperty("id").GetString() != selected.Id
                        || changed.RootElement.GetProperty("email").GetString() != next) throw new AdminException("uncertain");
                    emailChanged = true;
                    store.RecordStep(id, "email-modified");
                    var check = await RefreshAsync();
                    if (check.Count != current.Count || check.Accounts.All(a => a.Id != selected.Id || a.Email != next)
                        || !Witness(check, selected.Id).SequenceEqual(Witness(current, selected.Id))) throw new AdminException("uncertain");
                }
                var links = new List<PersonalLink>();
                var resultAccountId = selected?.Id;
                if (kind != SimpleOperationKind.Email)
                {
                    var destination = next ?? email;
                    using var generated = await Send(HttpMethod.Post,
                        "/auth/v1/admin/generate_link?redirect_to=" + Uri.EscapeDataString(target.Callback),
                        new { type = "recovery", email = destination, redirectTo = target.Callback });
                    var link = ValidateLink(generated.RootElement, destination, "recovery", selected?.Id);
                    resultAccountId = generated.RootElement.GetProperty("id").GetString();
                    links.Add(new(destination, link));
                    var check = await RefreshAsync();
                    if (check.Count != current.Count || check.Accounts.All(a => a.Id != selected!.Id || a.Email != destination))
                        throw new AdminException("uncertain");
                }
                var result = new SimpleResult(id, kind switch {
                    SimpleOperationKind.Email => "Adresse modifiée",
                    SimpleOperationKind.EmailAndPassword => "Adresse modifiée · récupération disponible",
                    _ => "Lien de récupération créé" },
                    kind == SimpleOperationKind.Email ? "Le compte garde son identité et ses données. La nouvelle adresse a été validée administrativement après ton échange avec le titulaire."
                    : "Transmets ce lien au titulaire par le canal connu. Il choisira lui-même son mot de passe. Le changement du mot de passe n’est pas encore confirmé.",
                    links, now, capabilities?.OtpExpiry, resultAccountId);
                store.Complete(result);
                return result;
            }
            catch
            {
                if (emailChanged) throw new AdminException("email_partial");
                throw new AdminException("uncertain");
            }
        }
        finally { mutation.Release(); }
    }

    public async Task<SimpleResult> DeleteAsync(AuthAccount selected)
    {
        RequireSelection(selected);
        if (selected.ClosureRestricted) throw new AdminException("closure_target");
        // No production HTTP request can reach DELETE through this path.
        if (!target.IsLocal) throw new AdminException("deletion_unqualified");
        if (!await mutation.WaitAsync(0)) throw new AdminException("busy");
        try
        {
            store.Validate(); using var lease = store.AcquireLock();
            if (store.HasUncertainOperation() || store.HasLegacyTarget(selected.Email)) throw new AdminException("pending");
            var current = await RefreshAsync(); RequireCurrent(current, selected);
            if (!current.OperatorPresent || capabilities?.OperatorId == selected.Id) throw new AdminException("closure_target");
            var ledger = store.DeletionLedgerHash();
            using var before = await Send(HttpMethod.Post, "/evidence", new { target = selected.Id, snapshot = current.Snapshot, ledgerHash = ledger }, capability: true);
            var e = before.RootElement.Deserialize<ClosureEvidence>() ?? throw new AdminException("closure_evidence");
            ClosureContract.ValidateEvidence(e, selected, current, ledger, clock.GetUtcNow());
            if (e.OperatorId != capabilities!.OperatorId) throw new AdminException("closure_target");
            var id = store.Reserve(selected.Email, SimpleOperationKind.Delete, selected.Id, null, clock.GetUtcNow(), e.BackupReference);
            // Immutable intent and deletions.json are durable BEFORE native Auth.
            var callSucceeded = false;
            try { using var deleted = await Send(HttpMethod.Delete, "/auth/v1/admin/users/" + selected.Id, new { should_soft_delete = false }); callSucceeded = true; }
            catch { /* Inspect once, never repeat the DELETE. */ }
            try
            {
                var after = await RefreshAsync();
                if (after.Accounts.Any(a => a.Id == selected.Id) || !Witness(current, selected.Id).SequenceEqual(Witness(after, "")))
                    throw new AdminException("closure_uncertain");
                using var proof = await Send(HttpMethod.Post, "/evidence", new { target = selected.Id, snapshot = after.Snapshot,
                    ledgerHash = store.DeletionLedgerHash(), after = true }, capability: true);
                var post = proof.RootElement.Deserialize<ClosureEvidence>() ?? throw new AdminException("closure_evidence");
                ClosureContract.ValidateEvidence(post, selected, after, ledger, clock.GetUtcNow(), after: true);
                if (post.OperatorId != e.OperatorId || post.WitnessDigest != e.WitnessDigest || !post.BackupsReconciled) throw new AdminException("closure_evidence");
                var result = new SimpleResult(id, "Compte supprimé · contrôles des données actives terminés",
                    "Les dix tables, les sessions et le stockage ont été contrôlés. Les copies de sauvegarde restent identifiées pour réconciliation. Les anciens accès peuvent subsister jusqu’à expiration. "
                    + (callSucceeded ? "" : "La réponse de suppression a été perdue ; l’absence a ensuite été vérifiée."), [], clock.GetUtcNow());
                store.Complete(result); return result;
            }
            catch { throw new AdminException("closure_uncertain"); }
        }
        finally { mutation.Release(); }
    }

    private static IEnumerable<string> Witness(AccountInventory value, string except) => value.Accounts.Where(a => a.Id != except)
        .OrderBy(a => a.Id, StringComparer.Ordinal).Select(a => $"{a.Id}|{a.Email}|{a.ConfirmedAt:O}|{a.RecoveryRestricted}");
    private void RequireSelection(AuthAccount selected)
    {
        if (inventory is null || !inventory.Accounts.Contains(selected) || clock.GetUtcNow() < inventory.ObservedAt
            || clock.GetUtcNow() - inventory.ObservedAt >= AdminContract.MaximumInventoryAge) throw new AdminException("stale");
        RequireCurrent(inventory, selected);
    }
    private static void RequireCurrent(AccountInventory value, AuthAccount selected)
    {
        if (!ClosureContract.Uuid(selected.Id) || !selected.ConfirmedAt.HasValue || selected.RecoveryRestricted
            || !value.Accounts.Contains(selected)) throw new AdminException("missing");
    }
    private string ValidateLink(JsonElement data, string email, string type, string? expectedId)
    {
        // Reuse the strict production contract after a structural rewrite of
        // only the two pinned local origins in qualification mode.
        if (!target.IsLocal) return AdminContract.BuildRestManualLink(data, email, type, expectedId);
        var text = data.GetRawText().Replace(target.Api, AdminContract.Api, StringComparison.Ordinal)
            .Replace(target.Callback, AdminContract.Callback, StringComparison.Ordinal)
            .Replace(Uri.EscapeDataString(target.Callback), Uri.EscapeDataString(AdminContract.Callback), StringComparison.Ordinal);
        using var mapped = JsonDocument.Parse(text);
        return AdminContract.BuildRestManualLink(mapped.RootElement, email, type, expectedId)
            .Replace(AdminContract.Callback, target.Callback, StringComparison.Ordinal);
    }

    private async Task<JsonDocument> Send(HttpMethod method, string path, object? body = null, bool inventoryResponse = false, bool capability = false,
        string? authConfigToken = null)
    {
        if (secret is null) throw new AdminException("locked");
        if (!path.StartsWith('/') || path.Contains('#') || capability && !target.IsLocal) throw new AdminException("configuration");
        if (authConfigToken is not null && (target.IsLocal || method != HttpMethod.Get || path != AuthConfigPath))
            throw new AdminException("configuration");
        var url = (authConfigToken is not null ? "https://api.supabase.com" : capability ? "http://127.0.0.1:54329" : target.Api) + path;
        try
        {
            using var request = new HttpRequestMessage(method, url);
            if (authConfigToken is not null) request.Headers.Authorization = new("Bearer", authConfigToken);
            else if (capability) request.Headers.Add("X-Qualification-ID", target.Qualification!.Value.ToString("D"));
            else { request.Headers.Add("apikey", secret); request.Headers.TryAddWithoutValidation("Authorization", "Bearer " + secret); }
            if (body is not null) request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (response.RequestMessage?.RequestUri?.AbsoluteUri != url || response.Headers.Location is not null) throw new AdminException("transport");
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) throw new AdminException("key_revoked");
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 262144) throw new AdminException("transport");
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var buffer = new MemoryStream(); var bytes = new byte[8192];
            for (int read; (read = await stream.ReadAsync(bytes, timeout.Token)) > 0;)
            { if (buffer.Length + read > 262144) throw new AdminException("transport"); buffer.Write(bytes, 0, read); }
            var json = JsonDocument.Parse(buffer.ToArray(), new JsonDocumentOptions { MaxDepth = 32 });
            try
            {
                SimpleJson.Unique(json.RootElement);
                if (inventoryResponse) AdminContract.ValidateInventoryHeaders(json.RootElement, response.Headers);
                return json;
            }
            catch { json.Dispose(); throw; }
        }
        catch (AdminException) { throw; }
        catch { throw new AdminException("transport"); }
    }
    public void Dispose() { Interlocked.Exchange(ref secret, null); authConfigToken = null; http.Dispose(); }
}
