using System.Net;
using System.Text;
using System.Text.Json;

namespace MonBprea.Admin.Core;

public sealed class AdminSession : IDisposable
{
    private string? _secret;
    private AccountInventory? _lastInventory;
    private readonly string _operatorEmail;
    private readonly IPrivateStore _store;
    private readonly TimeProvider _clock;
    private readonly HttpClient _http;
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly SemaphoreSlim _generation = new(1, 1);

    public AdminSession(string secret, string operatorEmail, IPrivateStore store, TimeProvider? clock = null)
        : this(secret, operatorEmail, store, clock, new SocketsHttpHandler
        {
            AllowAutoRedirect = false, UseProxy = false, UseCookies = false,
            AutomaticDecompression = DecompressionMethods.None,
            PooledConnectionLifetime = TimeSpan.Zero,
            ConnectTimeout = TimeSpan.FromSeconds(10)
        }) { }

    // Injection is internal and accessible only to the test assembly. Production
    // has no endpoint, transport, proxy or certificate override.
    internal AdminSession(string secret, string operatorEmail, IPrivateStore store, TimeProvider? clock, HttpMessageHandler handler)
    {
        AdminContract.ValidateSecret(secret);
        _operatorEmail = AdminContract.NormalizeEmail(operatorEmail);
        _secret = secret;
        _store = store;
        _clock = clock ?? TimeProvider.System;
        _http = new HttpClient(handler, true) { Timeout = TimeSpan.FromSeconds(10) };
    }

    private void Unlocked() { if (_secret is null) throw new AdminException("locked"); }

    public async Task<AccountInventory> RefreshAsync()
    {
        Unlocked();
        _lastInventory = null;
        return _lastInventory = await ReadInventoryAsync().ConfigureAwait(false);
    }

    public async Task<PreparedInvitation> PrepareAsync(string email, HumanAttestations human, WorkstationAttestations workstation)
    {
        Unlocked();
        var target = AdminContract.NormalizeEmail(email);
        if (!human.Complete || !workstation.Complete) throw new AdminException("attestations");
        await _store.ValidateAsync().ConfigureAwait(false);
        if (await _store.HasUncertainOperationAsync().ConfigureAwait(false) || await _store.HasTargetReservationAsync(target).ConfigureAwait(false)) throw new AdminException("pending");
        var inventory = await ReadInventoryAsync().ConfigureAwait(false);
        CheckTarget(inventory, target);
        return new(_sessionId, target, inventory, human, workstation, _clock.GetUtcNow());
    }

    private static void CheckTarget(AccountInventory inventory, string target)
    {
        if (inventory.Accounts.Any(x => x.Email == target)) throw new AdminException("exists");
        if (inventory.AvailableParticipantPlaces <= 0) throw new AdminException("capacity");
        if (inventory.Accounts.Any(x => !x.ConfirmedAt.HasValue && !x.InvitedAt.HasValue)) throw new AdminException("lookup");
    }

    public async Task<PreparedRecovery> PrepareRecoveryAsync(AuthAccount selected, RecoveryAttestations human, WorkstationAttestations workstation)
    {
        Unlocked();
        if (!human.Complete || !workstation.Complete) throw new AdminException("attestations");
        if (_lastInventory is null || !_lastInventory.Accounts.Contains(selected)) throw new AdminException("missing");
        CheckAge(_lastInventory);
        CheckRecoveryTarget(_lastInventory, selected);
        await _store.ValidateAsync().ConfigureAwait(false);
        if (await _store.HasUncertainOperationAsync().ConfigureAwait(false) || await _store.HasRecoveryReservationAsync(selected.Email).ConfigureAwait(false)) throw new AdminException("pending");
        var inventory = await ReadInventoryAsync().ConfigureAwait(false);
        CheckRecoveryTarget(inventory, selected);
        return new(_sessionId, selected, inventory, human, workstation, _clock.GetUtcNow());
    }

    private static void CheckRecoveryTarget(AccountInventory inventory, AuthAccount selected)
    {
        var current = inventory.Accounts.SingleOrDefault(x => x.Id == selected.Id && x.Email == selected.Email);
        if (current is null || !current.ConfirmedAt.HasValue || current.RecoveryRestricted) throw new AdminException("missing");
    }

    private void CheckAge(AccountInventory inventory)
    {
        var age = _clock.GetUtcNow() - inventory.ObservedAt;
        if (age < TimeSpan.Zero || age >= AdminContract.MaximumInventoryAge) throw new AdminException("stale");
    }

    public async Task<InvitationReceipt> GenerateAsync(PreparedInvitation prepared, string exactConfirmation)
    {
        Unlocked();
        if (prepared.SessionId != _sessionId || exactConfirmation != prepared.ConfirmationText) throw new AdminException("confirmation");
        if (Interlocked.Exchange(ref prepared.Spent, 1) != 0) throw new AdminException("pending");
        var id = await GenerateOperationAsync(prepared.Email, prepared.Inventory, prepared.Human.Complete && prepared.Workstation.Complete,
            "invite", null, () => _store.ReserveAsync(prepared.Email, prepared.Human),
            (operation, link) => _store.DeliverAsync(prepared.Email, operation, link)).ConfigureAwait(false);
        return new(id, _store.DirectoryPath, _clock.GetUtcNow());
    }

    public async Task<RecoveryReceipt> GenerateRecoveryAsync(PreparedRecovery prepared, string exactConfirmation)
    {
        Unlocked();
        if (_lastInventory is null) throw new AdminException("lookup");
        if (prepared.SessionId != _sessionId || exactConfirmation != prepared.ConfirmationText) throw new AdminException("confirmation");
        if (Interlocked.Exchange(ref prepared.Spent, 1) != 0) throw new AdminException("pending");
        var id = await GenerateOperationAsync(prepared.Email, prepared.Inventory, prepared.Human.Complete && prepared.Workstation.Complete,
            "recovery", prepared.Account, () => _store.ReserveRecoveryAsync(prepared.Email, prepared.Account.Id, prepared.Human),
            (operation, link) => _store.DeliverRecoveryAsync(prepared.Email, operation, link)).ConfigureAwait(false);
        return new(id, _store.DirectoryPath, _clock.GetUtcNow());
    }

    private async Task<Guid> GenerateOperationAsync(string email, AccountInventory inventory, bool attestationsComplete,
        string type, AuthAccount? account, Func<Task<Guid>> reserve, Func<Guid, string, Task> deliver)
    {
        if (!await _generation.WaitAsync(0).ConfigureAwait(false)) throw new AdminException("busy");
        try
        {
            CheckAge(inventory);
            if (!attestationsComplete) throw new AdminException("attestations");
            await _store.ValidateAsync().ConfigureAwait(false);
            using var lease = await _store.AcquireLockAsync().ConfigureAwait(false);
            if (await _store.HasUncertainOperationAsync().ConfigureAwait(false)
                || await (type == "recovery" ? _store.HasRecoveryReservationAsync(email) : _store.HasTargetReservationAsync(email)).ConfigureAwait(false)) throw new AdminException("pending");
            var current = await ReadInventoryAsync().ConfigureAwait(false);
            if (current.Snapshot != inventory.Snapshot) throw new AdminException("drift");
            if (account is null) CheckTarget(current, email); else CheckRecoveryTarget(current, account);
            CheckAge(inventory);
            Unlocked();
            var operationId = await reserve().ConfigureAwait(false);
            try
            {
                using var result = await SendAsync(HttpMethod.Post,
                    AdminContract.Api + "/auth/v1/admin/generate_link?redirect_to=" + Uri.EscapeDataString(AdminContract.Callback),
                    JsonSerializer.Serialize(new { type, email, redirectTo = AdminContract.Callback })).ConfigureAwait(false);
                var link = AdminContract.BuildRestManualLink(result.RootElement, email, type, account?.Id);
                await deliver(operationId, link).ConfigureAwait(false);
                return operationId;
            }
            catch { throw new AdminException(type == "recovery" ? "recovery_uncertain" : "uncertain"); }
        }
        finally { _generation.Release(); }
    }

    public async Task MarkHandedOverAsync(Guid operationId)
    {
        Unlocked();
        await _store.ValidateAsync().ConfigureAwait(false);
        await _store.MarkHandedOverAsync(operationId).ConfigureAwait(false);
    }

    private async Task<AccountInventory> ReadInventoryAsync()
    {
        using (var settings = await SendAsync(HttpMethod.Get, AdminContract.Api + "/auth/v1/settings").ConfigureAwait(false))
            AdminContract.ValidateSettings(settings.RootElement);
        using var result = await SendAsync(HttpMethod.Get, AdminContract.Api + "/auth/v1/admin/users?page=1&per_page=8", inventory: true).ConfigureAwait(false);
        return AdminContract.ParseInventory(result.RootElement, _operatorEmail, _clock.GetUtcNow());
    }

    private async Task<JsonDocument> SendAsync(HttpMethod method, string url, string? body = null, bool inventory = false)
    {
        Unlocked();
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var request = new HttpRequestMessage(method, url) { Version = HttpVersion.Version11, VersionPolicy = HttpVersionPolicy.RequestVersionExact };
            request.Headers.ExpectContinue = false;
            request.Headers.ConnectionClose = true;
            request.Headers.Add("apikey", _secret);
            request.Headers.TryAddWithoutValidation("Authorization", "Bearer " + _secret);
            request.Headers.Accept.ParseAdd("application/json");
            if (body is not null) request.Content = new StringContent(body, Encoding.UTF8, "application/json");
            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode || response.RequestMessage?.RequestUri?.AbsoluteUri != url || response.Headers.Location is not null) throw new AdminException("transport");
            if (response.Content.Headers.ContentLength > 262_144) throw new AdminException("transport");
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token).ConfigureAwait(false);
            using var buffer = new MemoryStream();
            var chunk = new byte[8192];
            while (true)
            {
                var received = await stream.ReadAsync(chunk, timeout.Token).ConfigureAwait(false);
                if (received == 0) break;
                if (buffer.Length + received > 262_144) throw new AdminException("transport");
                buffer.Write(chunk, 0, received);
            }
            var data = buffer.ToArray();
            var parsed = JsonDocument.Parse(data, new JsonDocumentOptions { MaxDepth = 32 });
            try
            {
                CheckUniqueProperties(parsed.RootElement);
                if (inventory)
                {
                    var count = parsed.RootElement.GetProperty("users").GetArrayLength();
                    if (response.Headers.TryGetValues("x-total-count", out var values)
                        && (values.Count() != 1 || !int.TryParse(values.Single(), out var total) || total != count)) throw new AdminException("lookup");
                    if (response.Headers.TryGetValues("Link", out var links) && links.Any(x => System.Text.RegularExpressions.Regex.IsMatch(x, "rel\\s*=\\s*\"?next", System.Text.RegularExpressions.RegexOptions.IgnoreCase))) throw new AdminException("lookup");
                }
                return parsed;
            }
            catch { parsed.Dispose(); throw; }
        }
        catch (AdminException) { throw; }
        catch { throw new AdminException("transport"); }
    }

    private static void CheckUniqueProperties(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
            { if (!names.Add(property.Name)) throw new AdminException("transport"); CheckUniqueProperties(property.Value); }
        }
        else if (element.ValueKind == JsonValueKind.Array)
            foreach (var child in element.EnumerateArray()) CheckUniqueProperties(child);
    }

    public void Dispose()
    {
        Interlocked.Exchange(ref _secret, null);
        _http.Dispose();
    }
}
