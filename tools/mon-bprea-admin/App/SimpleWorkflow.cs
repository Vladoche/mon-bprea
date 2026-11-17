using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.App;

internal interface ISimpleWorkflow : IDisposable
{
    Task<AccountInventory> RefreshAsync();
    Task<SimpleResult> CreateAsync(string email);
    Task<SimpleResult> RecoverAsync(AuthAccount selected, SimpleOperationKind kind, string? next, KnownChannelDecision? decision, bool newLink = false);
    Task<SimpleResult> DeleteAsync(AuthAccount selected);
}
internal sealed class SimpleWorkflow(SimpleAdminSession session) : ISimpleWorkflow
{
    public Task<AccountInventory> RefreshAsync() => session.RefreshAsync();
    public Task<SimpleResult> CreateAsync(string email) => session.CreateAsync(email);
    public Task<SimpleResult> RecoverAsync(AuthAccount account, SimpleOperationKind kind, string? next, KnownChannelDecision? decision, bool newLink = false)
        => session.RecoverAsync(account, kind, next, decision, newLink);
    public Task<SimpleResult> DeleteAsync(AuthAccount account) => session.DeleteAsync(account);
    public void Dispose() => session.Dispose();
}

internal sealed class SimpleBootstrap(AdminTarget target, IAdminCredentialVault vault, ISimplePrivateStore store)
{
    public string? ReadSavedKey() => vault.Read();
    public ISimpleWorkflow OpenSaved(string key)
    {
        store.Initialize();
        return new SimpleWorkflow(new SimpleAdminSession(key, target, store));
    }
    public async Task<ISimpleWorkflow> ConfigureAsync(string key)
    {
        store.Initialize();
        var session = new SimpleAdminSession(key, target, store);
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
