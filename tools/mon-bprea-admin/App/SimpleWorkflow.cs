using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.App;

internal interface ISimpleWorkflow : IDisposable
{
    Task<AccountInventory> RefreshAsync();
    Task<SimpleResult> CreateAsync(string email);
    Task<InvitationReview> ReviewInvitationAsync(AuthAccount selected);
    Task<SimpleResult> RenewInvitationAsync(InvitationReview selected);
    Task<PersonalLink> ReadInvitationLinkAsync(AuthAccount selected, Guid operation);
    Task<int> CheckInvitationDurationAsync(string token);
    Task RequireProductionInvitationDurationAsync();
    Task ReconcileInvitationAsync();
    Task<SimpleResult> RecoverAsync(AuthAccount selected, SimpleOperationKind kind, string? next, KnownChannelDecision? decision, bool newLink = false);
    Task<SimpleResult> DeleteAsync(AuthAccount selected);
}
internal sealed class SimpleWorkflow(SimpleAdminSession session) : ISimpleWorkflow
{
    public Task<AccountInventory> RefreshAsync() => session.RefreshAsync();
    public Task<SimpleResult> CreateAsync(string email) => session.CreateAsync(email);
    public Task<InvitationReview> ReviewInvitationAsync(AuthAccount selected) => session.ReviewInvitationAsync(selected);
    public Task<SimpleResult> RenewInvitationAsync(InvitationReview selected) => session.RenewInvitationAsync(selected);
    public Task<PersonalLink> ReadInvitationLinkAsync(AuthAccount selected, Guid operation) => session.ReadInvitationLinkAsync(selected, operation);
    public Task<int> CheckInvitationDurationAsync(string token) => session.CheckInvitationDurationAsync(token);
    public Task RequireProductionInvitationDurationAsync() => session.RequireProductionInvitationDurationAsync();
    public Task ReconcileInvitationAsync() => session.ReconcileInvitationAsync();
    public Task<SimpleResult> RecoverAsync(AuthAccount account, SimpleOperationKind kind, string? next, KnownChannelDecision? decision, bool newLink = false)
        => session.RecoverAsync(account, kind, next, decision, newLink);
    public Task<SimpleResult> DeleteAsync(AuthAccount account) => session.DeleteAsync(account);
    public void Dispose() => session.Dispose();
}

internal sealed class SimpleBootstrap(AdminTarget target, IAdminCredentialVault vault, ISimplePrivateStore store, ProductionBackup? backup = null)
{
    private SimpleAdminSession Session(string key) => new(key, target, store, backup is null ? null : backup.RequireReadyAsync);
    public string? ReadSavedKey() => vault.Read();
    public ISimpleWorkflow OpenSaved(string key)
    {
        store.Initialize();
        return new SimpleWorkflow(Session(key));
    }
    public async Task<ISimpleWorkflow> ConfigureAsync(string key)
    {
        store.Initialize();
        var session = Session(key);
        try
        {
            await session.RefreshAsync(); // Exact pinned target and valid admin rights.
            vault.Save(key);
            if (vault.Read() != key) throw new AdminException("credential");
            return new SimpleWorkflow(session);
        }
        catch { session.Dispose(); throw; }
    }
}
