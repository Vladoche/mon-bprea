namespace MonBprea.Admin.Core;

public interface IPrivateStore
{
    string DirectoryPath { get; }
    Task ValidateAsync();
    Task<bool> HasUncertainOperationAsync();
    Task<bool> HasTargetReservationAsync(string email);
    Task<bool> HasRecoveryReservationAsync(string email);
    Task<IDisposable> AcquireLockAsync();
    Task<Guid> ReserveAsync(string email, HumanAttestations attestations);
    Task<Guid> ReserveRecoveryAsync(string email, string accountId, RecoveryAttestations attestations);
    // Implementations flush durable reservation before returning from ReserveAsync.
    // DeliverAsync validates, writes exclusively and flushes the private link, then
    // marks the reservation delivered-private. It must never expose the link.
    Task DeliverAsync(string email, Guid operationId, string link);
    Task DeliverRecoveryAsync(string email, Guid operationId, string link);
    Task MarkHandedOverAsync(Guid operationId);
}

public sealed record RecoveryAttestations(bool RequestedByHolder, bool IdentityCheckedViaKnownChannel,
    bool SelectedAddressConfirmed, bool PrivateChannelAgreed, bool HolderChoosesPassword)
{
    public bool Complete => RequestedByHolder && IdentityCheckedViaKnownChannel && SelectedAddressConfirmed
        && PrivateChannelAgreed && HolderChoosesPassword;
}

public sealed record HumanAttestations(bool NoticeProvidedBeforeEmail, bool DirectRequestAndEmailConfirmed,
    bool PrivateChannelAgreed)
{
    public string NoticeVersion => "V1.1";
    public bool Complete => NoticeProvidedBeforeEmail && DirectRequestAndEmailConfirmed && PrivateChannelAgreed;
}

public sealed record WorkstationAttestations(bool PrivateOperatorWorkstation, bool OtherAdministrationSuspended,
    bool SharedStorageExcluded, bool ProductionOpeningAuthorized, bool ExistingPreflightRequirementsChecked,
    bool ProductionLinkExpiryChecked)
{
    public bool Complete => PrivateOperatorWorkstation && OtherAdministrationSuspended && SharedStorageExcluded
        && ProductionOpeningAuthorized && ExistingPreflightRequirementsChecked && ProductionLinkExpiryChecked;
}

public sealed record AuthAccount(string Id, string Email, DateTimeOffset? CreatedAt,
    DateTimeOffset? ConfirmedAt, DateTimeOffset? InvitedAt, bool RecoveryRestricted = false)
{
    public string State => RecoveryRestricted ? "État Auth à diagnostiquer" : ConfirmedAt.HasValue ? "Adresse confirmée" : InvitedAt.HasValue ? "Invitation en attente" : "Indéterminé";
}

public sealed record AccountInventory(IReadOnlyList<AuthAccount> Accounts, DateTimeOffset ObservedAt,
    string Snapshot, bool OperatorPresent)
{
    public int Count => Accounts.Count;
    public int AvailableParticipantPlaces => Math.Max(0, AdminContract.MaximumAccounts - Count - (OperatorPresent ? 0 : 1));
}

public sealed class PreparedInvitation
{
    internal PreparedInvitation(Guid sessionId, string email, AccountInventory inventory, HumanAttestations human,
        WorkstationAttestations workstation, DateTimeOffset preparedAt)
    { SessionId = sessionId; Email = email; Inventory = inventory; Human = human; Workstation = workstation; PreparedAt = preparedAt; }
    internal Guid SessionId { get; }
    internal HumanAttestations Human { get; }
    internal WorkstationAttestations Workstation { get; }
    internal int Spent;
    public string Email { get; }
    public AccountInventory Inventory { get; }
    public DateTimeOffset PreparedAt { get; }
    public string ConfirmationText => $"CONFIRMER PROD invite {Email}";
}

public sealed record InvitationReceipt(Guid OperationId, string PrivateDirectory, DateTimeOffset GeneratedAt);

public sealed class PreparedRecovery
{
    internal PreparedRecovery(Guid sessionId, AuthAccount account, AccountInventory inventory, RecoveryAttestations human,
        WorkstationAttestations workstation, DateTimeOffset preparedAt)
    { SessionId = sessionId; Account = account; Inventory = inventory; Human = human; Workstation = workstation; PreparedAt = preparedAt; }
    internal Guid SessionId { get; }
    internal RecoveryAttestations Human { get; }
    internal WorkstationAttestations Workstation { get; }
    internal int Spent;
    public AuthAccount Account { get; }
    public string Email => Account.Email;
    public AccountInventory Inventory { get; }
    public DateTimeOffset PreparedAt { get; }
    public string ConfirmationText => $"CONFIRMER PROD recovery {Email}";
}

public sealed record RecoveryReceipt(Guid OperationId, string PrivateDirectory, DateTimeOffset GeneratedAt);

public sealed class AdminException : Exception
{
    public string Code { get; }
    public AdminException(string code) : base(AdminMessages.For(code)) => Code = code;
}

public static class AdminMessages
{
    public static string For(string code) => code switch
    {
        "key" => "Clé administrative moderne absente ou invalide. Utilisez une clé sb_secret_ du seul projet PROD.",
        "input" => "Saisissez une seule adresse e-mail valide et confirmée.",
        "lookup" => "Inventaire Auth incomplet ou ambigu. Toute génération est bloquée ; actualisez en lecture seule.",
        "missing" => "La récupération exige le compte sélectionné, existant et confirmé. Invitation en attente ou état indéterminé : diagnostic requis.",
        "configuration" => "Réglages Auth absents ou divergents : inscriptions fermées, anonymat désactivé et e-mail avec confirmation requis.",
        "capacity" => "Capacité administrative de sept comptes atteinte ou dépassée, invitations en attente comprises.",
        "exists" => "Ce compte existe déjà, même si son invitation est en attente. Invitation refusée.",
        "pending" => "Une opération précédente reste réservée, incertaine ou non remise. Aucune nouvelle génération ; diagnostic en lecture seule requis. Les réservations sont conservées.",
        "confirmation" => "Confirmation exacte absente ou annulée. Aucun lien généré.",
        "attestations" => "Confirmez tous les prérequis individuels, du poste et du préflight. Les attestations ne vérifient pas automatiquement l’identité.",
        "stale" => "Le préflight ou son inventaire a cinq minutes ou plus. Préparez à nouveau l’opération sans modifier sa date.",
        "drift" => "L’inventaire a changé depuis le préflight. Aucune génération ; actualisez et préparez à nouveau.",
        "private" => "Le stockage privé Windows n’est pas conforme. Aucun lien affiché ; vérifiez le dossier et ses protections.",
        "busy" => "Une opération opérateur est déjà verrouillée ou interrompue. Ne retirez pas le verrou sans diagnostic.",
        "locked" => "Session administrative verrouillée. Saisissez de nouveau la clé.",
        "transport" => "Connexion administrative refusée ou indisponible. Vérifiez le réseau sans modifier la cible PROD.",
        "uncertain" => "Résultat incertain. Un compte ou un lien a peut-être déjà été créé. Aucune nouvelle tentative ne sera effectuée automatiquement.",
        "recovery_uncertain" => "Résultat incertain : un lien de récupération a peut-être déjà été généré. Aucune nouvelle tentative automatique ne sera effectuée. Réservation conservée ; diagnostic en lecture seule requis.",
        _ => "Opération refusée. Aucun détail sensible n’est affiché."
    };
}
