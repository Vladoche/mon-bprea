using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.App;

internal sealed record UnlockInput(string Secret, string OperatorEmail, string PrivateDirectory, string OperatorFile);

internal interface IAdminWorkflow : IDisposable
{
    Task<AccountInventory> RefreshAsync();
    Task<PreparedInvitation> PrepareAsync(string email, HumanAttestations human, WorkstationAttestations workstation);
    Task<InvitationReceipt> GenerateAsync(PreparedInvitation prepared, string confirmation);
    Task<PreparedRecovery> PrepareRecoveryAsync(AuthAccount selected, RecoveryAttestations human, WorkstationAttestations workstation);
    Task<RecoveryReceipt> GenerateRecoveryAsync(PreparedRecovery prepared, string confirmation);
    Task MarkHandedOverAsync(Guid operationId);
    void OpenPrivateFolder();
}

internal sealed class AdminWorkflow : IAdminWorkflow
{
    private readonly AdminSession session;
    private readonly WindowsPrivateStore store;
    public AdminWorkflow(UnlockInput input)
    {
        store = new WindowsPrivateStore(input.PrivateDirectory, input.OperatorFile);
        session = new AdminSession(input.Secret, input.OperatorEmail, store);
    }
    public Task<AccountInventory> RefreshAsync() => session.RefreshAsync();
    public Task<PreparedInvitation> PrepareAsync(string email, HumanAttestations human, WorkstationAttestations workstation)
        => session.PrepareAsync(email, human, workstation);
    public Task<InvitationReceipt> GenerateAsync(PreparedInvitation prepared, string confirmation) => session.GenerateAsync(prepared, confirmation);
    public Task<PreparedRecovery> PrepareRecoveryAsync(AuthAccount selected, RecoveryAttestations human, WorkstationAttestations workstation)
        => session.PrepareRecoveryAsync(selected, human, workstation);
    public Task<RecoveryReceipt> GenerateRecoveryAsync(PreparedRecovery prepared, string confirmation) => session.GenerateRecoveryAsync(prepared, confirmation);
    public Task MarkHandedOverAsync(Guid operationId) => session.MarkHandedOverAsync(operationId);
    public void OpenPrivateFolder() => store.OpenPrivateFolder();
    public void Dispose() => session.Dispose();
}
