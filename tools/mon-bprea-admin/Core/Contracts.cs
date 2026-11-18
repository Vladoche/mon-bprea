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
    DateTimeOffset? ConfirmedAt, DateTimeOffset? InvitedAt, bool RecoveryRestricted = false, bool ClosureRestricted = false)
{
    public DateTimeOffset? ConfirmationSentAt { get; init; }
    public bool InvitationRestricted { get; init; }
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
        "identity" => "Contacte le titulaire par son canal habituel avant de modifier son adresse. La connaissance de son ancienne adresse ne suffit pas.",
        "email_partial" => "L’adresse a été modifiée, mais la suite n’est pas confirmée. Aucun nouvel essai automatique. Le compte et le journal sont conservés pour vérification.",
        "key_revoked" => "La clé enregistrée est refusée. Elle a peut-être été renouvelée ou révoquée. Remplace-la dans les paramètres.",
        "legacy_conflict" => "Un historique antérieur est introuvable ou plusieurs historiques sont présents. La reprise est bloquée pour éviter de perdre une opération. Les fichiers sont conservés.",
        "backup_access" => "L’accès PostgreSQL pour les sauvegardes est absent ou a été refusé. Utilise « Finaliser la configuration » dans État du système.",
        "backup_expired" => "La sauvegarde restaurée a atteint son échéance de sept jours. Renouvelle-la depuis État du système avant de créer un compte.",
        "backup_evidence" => "Aucune archive accompagnée d’une preuve de restauration vérifiable n’est disponible. Consulte État du système.",
        "backup_storage" => "Le dossier de sauvegarde est introuvable ou ses protections Windows sont insuffisantes.",
        "backup_ledger" => "Le journal courant des effacements manque, a changé ou nécessite une réconciliation.",
        "backup_tools" => "Les outils PostgreSQL 17 pour Windows sont absents ou incompatibles.",
        "backup_source" => "La connexion PostgreSQL en lecture seule au projet Mon BPREA n’a pas pu être vérifiée.",
        "backup_operator" => "Le compte exploitant n’a pas pu être rapproché de son invitation historique et de l’inventaire actuel.",
        "backup_inventory" => "Les comptes lus dans Auth et PostgreSQL diffèrent. Actualise l’inventaire avant de poursuivre.",
        "backup_drift" => "Le schéma ou les droits PROD diffèrent de la référence de sauvegarde qualifiée. Une vérification du service est nécessaire.",
        "backup_capture" => "La nouvelle archive PostgreSQL n’a pas pu être produite.",
        "backup_changed" => "Les données ou les permissions ont changé pendant la copie. La tentative reste à vérifier.",
        "backup_isolation" => "L’isolement ou l’arrêt de la base locale de restauration n’a pas été vérifié.",
        "backup_dependencies" => "Les dépendances du schéma ou les identifiants Auth et applicatifs divergent.",
        "backup_restore" => "La restauration PostgreSQL isolée a échoué. La dernière copie vérifiée est conservée.",
        "backup_comparison" => "La comparaison du contenu, du schéma ou des permissions restaurés a échoué.",
        "backup_space" => "Le disque de sauvegarde manque d’espace pour l’archive et sa restauration isolée.",
        "backup_timeout" => "Le délai de sauvegarde ou de restauration a été dépassé.",
        "deletion_unqualified" => "Opération bloquée. Cette version ne dispose pas encore des vérifications de données et de sauvegardes nécessaires sur le service réel. Aucun compte n’a été supprimé.",
        "credential" => "Gestionnaire d’identifiants Windows indisponible ou entrée non conforme. Aucune clé affichée ni enregistrée dans un fichier.",
        "closure_request" => "Clôture refusée : référence interne, date et neuf attestations nouvelles requises. Export demandé : traitement et remise vérifiés.",
        "closure_target" => "Clôture refusée : identité inconnue, restreinte ou hors périmètre participant. Le compte exploitant est protégé par UUID vérifié.",
        "closure_evidence" => "Clôture bloquée : preuves techniques absentes ou divergentes (exploitant, dix tables, onze FK, Storage, permissions ou témoins). Aucune case ne remplace ces lectures.",
        "closure_backup" => "Clôture suspendue : sauvegarde/restauration non vérifiable, plus de 168 h ou journal courant modifié. Ne remplacez jamais le journal par un ancien snapshot.",
        "closure_uncertain" => "Résultat de clôture incertain. Aucune répétition ; inspection non destructive et journal privé requis.",
        "key" => "Clé administrative moderne absente ou invalide. Utilisez une clé sb_secret_ du seul projet PROD.",
        "input" => "Saisissez une seule adresse e-mail valide et confirmée.",
        "lookup" => "Inventaire Auth incomplet ou ambigu. Toute génération est bloquée ; actualisez en lecture seule.",
        "missing" => "La récupération exige le compte sélectionné, existant et confirmé. Invitation en attente ou état indéterminé : diagnostic requis.",
        "configuration" => "Réglages Auth absents ou divergents : inscriptions fermées, anonymat désactivé et e-mail avec confirmation requis.",
        "capacity" => "Capacité administrative de sept comptes atteinte ou dépassée, invitations en attente comprises.",
        "exists" => "Ce compte existe déjà, même si son invitation est en attente. Invitation refusée.",
        "invitation_existing" => "Ce camarade possède déjà une invitation en attente.",
        "invitation_history" => "L’historique ne permet pas de relier l’invitation à ce compte. Aucune nouvelle invitation ne peut être créée.",
        "invitation_restricted" => "Ce compte est protégé ou soumis à une restriction. Le renouvellement est bloqué.",
        "invitation_changed" => "Le compte ou l’invitation a changé. Rouvre Récupérer un compte pour vérifier son état.",
        "invitation_activated" => "Le compte a été activé. Tu peux maintenant utiliser la récupération de compte.",
        "invitation_unusable" => "Le lien ne peut plus être copié. Vérifie l’état de l’invitation avant de générer un nouveau lien.",
        "invitation_no_receipt" => "Le résultat du renouvellement ne peut pas être prouvé. La réservation reste bloquée pour vérification.",
        "otp_duration" => "Supabase indique une durée différente de 24 heures. Vérifie le réglage avant de créer un lien.",
        "otp_unverified" => "Durée du lien non vérifiée. Vérifie la configuration Auth avant de créer un lien.",
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
