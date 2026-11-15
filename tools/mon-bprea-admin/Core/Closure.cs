using System.Collections.ObjectModel;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MonBprea.Admin.Core;

public sealed record ClosureRequest(string Reference, DateTimeOffset ReceivedAt, ClosureAttestations Attestations);
public sealed record ClosureAttestations(bool RequestReceived, bool IdentityChecked, bool ExactTarget,
    bool RightQualified, bool ExceptionsReviewed, bool ExportOffered, bool RequestedExportDelivered,
    bool ConsequencesExplained, bool OperatorAuthorized)
{
    // The seventh attestation means either no export was requested, or its
    // treatment AND private handover were checked. It is never preselected.
    public bool Complete => RequestReceived && IdentityChecked && ExactTarget && RightQualified && ExceptionsReviewed
        && ExportOffered && RequestedExportDelivered && ConsequencesExplained && OperatorAuthorized;
}
public sealed record ClosurePreparation(AuthAccount Account, AccountInventory Inventory, ClosureRequest Request,
    IReadOnlyList<string> Blockers, IReadOnlyDictionary<string, long> Counts, string BackupSummary, PreparedClosure? AuthorizedPlan)
{
    public bool CanConfirm => Blockers.Count == 0 && AuthorizedPlan is not null;
}
public sealed class PreparedClosure
{
    internal PreparedClosure(Guid session, AuthAccount account, AccountInventory inventory, ClosureRequest request,
        ClosureEvidence evidence, string ledgerHash)
    { Session = session; Account = account; Inventory = inventory; Request = request; Evidence = evidence; LedgerHash = ledgerHash; }
    internal Guid Session { get; }
    internal int Spent;
    internal ClosureEvidence Evidence { get; }
    internal string LedgerHash { get; }
    public AuthAccount Account { get; }
    public AccountInventory Inventory { get; }
    public ClosureRequest Request { get; }
    public string ConfirmationText => $"SUPPRIMER DEFINITIVEMENT {Account.Email}";
}
public enum ClosureStatus { Prepared, Authorized, Deleting, Uncertain, AuthAbsentChecksIncomplete, ActiveDataVerifiedDeleted, Followup }
public sealed record ClosureReceipt(Guid OperationId, ClosureStatus Status, string AuthCall, bool AuthAbsent,
    bool ActiveDataVerified, DateTimeOffset CheckedAt)
{
    public string Description => Status switch {
        ClosureStatus.Prepared => "Préparée — vérifications incomplètes",
        ClosureStatus.Authorized => "Autorisée",
        ClosureStatus.Deleting => "Suppression en cours",
        ClosureStatus.Uncertain => "Résultat incertain — aucune répétition ; inspection non destructive uniquement",
        ClosureStatus.AuthAbsentChecksIncomplete => "Compte Auth supprimé, contrôles incomplets",
        ClosureStatus.ActiveDataVerifiedDeleted => "Données actives vérifiées supprimées — clôture en suivi",
        _ => "Clôture en suivi"
    };
}

public interface IClosureStore : IPrivateStore
{
    Task<string> ReadDeletionLedgerHashAsync();
    Task RecordClosurePreparationAsync(AuthAccount account, ClosureRequest request);
    Task<Guid> ReserveClosureAsync(PreparedClosure plan);
    Task RecordClosureResultAsync(ClosureReceipt receipt);
}

// No public evidence adapter, endpoint switch, JSON import, checkbox or launch
// parameter can enable production deletion. Only friend test assemblies inject
// evidence from their isolated environment. A future PROD adapter needs its own
// qualification, read-only PostgreSQL identity and explicit permission review.
internal interface IClosureEvidenceSource
{
    Task<ClosureEvidence?> ReadAsync(AuthAccount target, AccountInventory inventory, string ledgerHash);
}
internal sealed class MissingClosureEvidence : IClosureEvidenceSource
{
    public Task<ClosureEvidence?> ReadAsync(AuthAccount target, AccountInventory inventory, string ledgerHash) => Task.FromResult<ClosureEvidence?>(null);
}
internal sealed record ClosureEvidence(string Project, string TargetId, string OperatorId, string InventorySnapshot,
    DateTimeOffset ObservedAt, IReadOnlyDictionary<string, long> Rows, IReadOnlyList<string> ForeignKeys,
    bool PermissionsVerified, bool ParticipantVerified, long StorageObjects, long Orphans,
    long Sessions, long RefreshTokens, string WitnessDigest, bool BackupVerified, DateTimeOffset SnapshotStartedAt,
    string BackupReference, string BackupLedgerHash);

public static class ClosureContract
{
    public static IReadOnlyList<string> Tables { get; } = Array.AsReadOnly(new[] {
        "profiles", "drill_series", "drill_answers", "drill_training_attempts", "course_states", "quiz_attempts",
        "botanical_sessions", "botanical_answers", "itk_settings", "appearance_preferences" });
    // Canonical signatures include both sides, column order, validation and
    // cascade. Counting eleven alone cannot satisfy this contract.
    internal static readonly string[] ForeignKeys = [
        "profiles(id)->auth.users(id):cascade:valid",
        "drill_series(user_id)->auth.users(id):cascade:valid",
        "drill_answers(user_id,series_id)->public.drill_series(user_id,id):cascade:valid",
        "drill_training_attempts(user_id,series_id,question_id)->public.drill_answers(user_id,series_id,question_id):cascade:valid",
        "course_states(user_id)->auth.users(id):cascade:valid",
        "quiz_attempts(user_id)->auth.users(id):cascade:valid",
        "botanical_sessions(user_id)->auth.users(id):cascade:valid",
        "botanical_answers(user_id)->auth.users(id):cascade:valid",
        "botanical_answers(user_id,session_id)->public.botanical_sessions(user_id,session_id):cascade:valid",
        "itk_settings(user_id)->auth.users(id):cascade:valid",
        "appearance_preferences(user_id)->auth.users(id):cascade:valid"
    ];
    public static string TargetHash(string email) => Hash(AdminContract.Project + "\0" + AdminContract.NormalizeEmail(email));
    public static string Hash(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    internal static bool Uuid(string value) => Regex.IsMatch(value, @"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z");
    internal static void ValidateRequest(ClosureRequest request, DateTimeOffset now)
    {
        if (!Regex.IsMatch(request.Reference, @"\A[A-Za-z0-9][A-Za-z0-9._-]{2,63}\z")
            || request.ReceivedAt > now || request.ReceivedAt < DateTimeOffset.Parse("2026-01-01T00:00:00Z")
            || !request.Attestations.Complete) throw new AdminException("closure_request");
    }
    internal static void ValidateEvidence(ClosureEvidence e, AuthAccount account, AccountInventory inventory, string ledgerHash, DateTimeOffset now, bool after = false)
    {
        if (e.Project != AdminContract.Project || e.TargetId != account.Id || !Uuid(e.OperatorId)
            || e.OperatorId == account.Id || inventory.Accounts.All(a => a.Id != e.OperatorId)
            || inventory.Count < (after ? 1 : 2) || e.InventorySnapshot != inventory.Snapshot
            || now < e.ObservedAt || now - e.ObservedAt >= AdminContract.MaximumInventoryAge
            || !e.PermissionsVerified || !e.ParticipantVerified || e.StorageObjects != 0 || e.Orphans != 0
            || !e.ForeignKeys.Order().SequenceEqual(ForeignKeys.Order())
            || !e.Rows.Keys.Order().SequenceEqual(Tables.Order()) || e.Rows.Values.Any(n => n < 0)
            || !Regex.IsMatch(e.WitnessDigest, @"\A[a-f0-9]{64}\z")) throw new AdminException("closure_evidence");
        if (!after && (!e.BackupVerified || e.BackupLedgerHash != ledgerHash
            || e.SnapshotStartedAt > now || now - e.SnapshotStartedAt > TimeSpan.FromHours(168)
            || !Regex.IsMatch(e.BackupReference, @"\A[a-f0-9]{64}\z"))) throw new AdminException("closure_backup");
        if (after && (e.Rows.Values.Any(n => n != 0) || e.Sessions != 0 || e.RefreshTokens != 0)) throw new AdminException("closure_evidence");
    }
    public const string ResidualReminder = "Clôture en suivi : anciens JWT potentiellement valables jusqu’à expiration ; sessions/refresh à contrôler séparément. " +
        "Accompagner les appareils accessibles, fermer les anciens onglets et examiner les opérations non synchronisées. " +
        "Appareils absents, copies téléchargées et sauvegardes restent à suivre ; aucun effacement global du navigateur. " +
        "Toute restauration reste isolée et réconciliée avec le journal courant ; son ancienne preuve doit être renouvelée après modification du journal.";
    public static string HolderResponse(ClosureReceipt receipt) =>
        $"Référence de clôture : {receipt.OperationId:D}. État : {receipt.Description}. " +
        (receipt.ActiveDataVerified ? "L’absence de votre identité Auth et de vos données actives dans les dix tables a été contrôlée. " : "Les contrôles restent incomplets ; aucune confirmation globale d’effacement. ") +
        "Copies résiduelles et exceptions : [à préciser]. Appareils absents : [à préciser]. Prochaine revue et échéances : [à compléter]. " +
        "Ce modèle doit être relu et complété par l’exploitant ; aucun message n’a été envoyé.";
}

public sealed partial class AdminSession
{
    private IClosureEvidenceSource _closureEvidence = new MissingClosureEvidence();
    internal AdminSession(string secret, string operatorEmail, IPrivateStore store, TimeProvider? clock,
        HttpMessageHandler handler, IClosureEvidenceSource evidence) : this(secret, operatorEmail, store, clock, handler) => _closureEvidence = evidence;

    public async Task<ClosurePreparation> PrepareClosureAsync(AuthAccount selected, ClosureRequest request)
    {
        Unlocked(); ClosureContract.ValidateRequest(request, _clock.GetUtcNow());
        if (_lastInventory is null || !_lastInventory.Accounts.Contains(selected)) throw new AdminException("missing");
        CheckAge(_lastInventory);
        if (selected.RecoveryRestricted || selected.ClosureRestricted || !ClosureContract.Uuid(selected.Id)) throw new AdminException("closure_target");
        var current = await ReadInventoryAsync().ConfigureAwait(false);
        if (current.Snapshot != _lastInventory.Snapshot || !current.Accounts.Contains(selected)) throw new AdminException("drift");
        if (_store is not IClosureStore store) throw new AdminException("closure_evidence");
        await store.ValidateAsync().ConfigureAwait(false);
        using var lease = await store.AcquireLockAsync().ConfigureAwait(false);
        if (await store.HasUncertainOperationAsync().ConfigureAwait(false)
            || await store.HasRecoveryReservationAsync(selected.Email).ConfigureAwait(false)) throw new AdminException("pending");
        // A preparation is a private request record, not a deletion intention.
        await store.RecordClosurePreparationAsync(selected, request).ConfigureAwait(false);
        var blockers = new List<string>(); string ledgerHash = "";
        try { ledgerHash = await store.ReadDeletionLedgerHashAsync().ConfigureAwait(false); }
        catch { blockers.Add("Journal courant absent, incohérent ou non accessible : réconciliation impossible."); }
        var e = await _closureEvidence.ReadAsync(selected, current, ledgerHash).ConfigureAwait(false);
        if (e is null)
        {
            blockers.Add("Identité Auth immuable de l’exploitant et habilitation participant non vérifiables par le canal disponible.");
            blockers.Add("Canal PostgreSQL de confiance absent : dix comptages, onze FK réelles, dépendances supplémentaires, Storage, RLS et permissions non vérifiés.");
            blockers.Add("Sauvegarde, manifeste, restauration isolée et empreinte du journal : liaison technique non vérifiée. Le préflight hors ligne ne suffit pas.");
        }
        else ClosureContract.ValidateEvidence(e, selected, current, ledgerHash, _clock.GetUtcNow());
        CheckAge(current);
        var counts = new ReadOnlyDictionary<string, long>(new Dictionary<string, long>(e?.Rows ?? new Dictionary<string, long>()));
        var backup = e is null ? "NON VÉRIFIÉE — contrôle opérateur complémentaire obligatoire, suppression PROD bloquée."
            : $"Point applicatif : {e.SnapshotStartedAt:u} · Manifeste/restauration/journal liés · " +
                (_clock.GetUtcNow() - e.SnapshotStartedAt >= TimeSpan.FromHours(144) ? "ÉCHÉANCE PROCHE (144 h)" : "Moins de 144 h") + " · Maximum 168 h";
        return new(selected, current, request, blockers.AsReadOnly(), counts, backup,
            blockers.Count == 0 && e is not null ? new(_sessionId, selected, current, request, e with { Rows = counts, ForeignKeys = e.ForeignKeys.ToArray() }, ledgerHash) : null);
    }

    public async Task<ClosureReceipt> ExecuteClosureAsync(PreparedClosure plan, string exactConfirmation)
    {
        Unlocked();
        if (plan.Session != _sessionId || exactConfirmation != plan.ConfirmationText) throw new AdminException("confirmation");
        if (Interlocked.Exchange(ref plan.Spent, 1) != 0) throw new AdminException("pending");
        if (!await _generation.WaitAsync(0).ConfigureAwait(false)) throw new AdminException("busy");
        try
        {
            CheckAge(plan.Inventory); ClosureContract.ValidateRequest(plan.Request, _clock.GetUtcNow());
            if (_store is not IClosureStore store) throw new AdminException("closure_evidence");
            await store.ValidateAsync().ConfigureAwait(false);
            using var lease = await store.AcquireLockAsync().ConfigureAwait(false);
            if (await store.HasUncertainOperationAsync().ConfigureAwait(false)
                || await store.HasRecoveryReservationAsync(plan.Account.Email).ConfigureAwait(false)) throw new AdminException("pending");
            var current = await ReadInventoryAsync().ConfigureAwait(false);
            if (current.Snapshot != plan.Inventory.Snapshot || !current.Accounts.Contains(plan.Account)) throw new AdminException("drift");
            var ledger = await store.ReadDeletionLedgerHashAsync().ConfigureAwait(false);
            if (ledger != plan.LedgerHash) throw new AdminException("closure_backup");
            var e = await _closureEvidence.ReadAsync(plan.Account, current, ledger).ConfigureAwait(false) ?? throw new AdminException("closure_evidence");
            ClosureContract.ValidateEvidence(e, plan.Account, current, ledger, _clock.GetUtcNow());
            if (e.OperatorId != plan.Evidence.OperatorId || e.BackupReference != plan.Evidence.BackupReference
                || e.WitnessDigest != plan.Evidence.WitnessDigest) throw new AdminException("drift");
            CheckAge(plan.Inventory); Unlocked();
            var operation = await store.ReserveClosureAsync(plan).ConfigureAwait(false);
            // The store has flushed both the immutable intent and current
            // deletions.json before this sole call. All failures consume plan.
            var call = "uncertain";
            try
            {
                using var response = await SendAsync(HttpMethod.Delete, AdminContract.Api + "/auth/v1/admin/users/" + plan.Account.Id,
                    "{\"should_soft_delete\":false}").ConfigureAwait(false);
                if (response.RootElement.ValueKind != JsonValueKind.Object || response.RootElement.EnumerateObject().Any()) throw new AdminException("closure_uncertain");
                call = "http-success";
            }
            catch { /* Never retry, including a rejected/ambiguous HTTP response. */ }
            var receipt = await CheckClosureAsync(operation, plan, call).ConfigureAwait(false);
            await store.RecordClosureResultAsync(receipt).ConfigureAwait(false);
            _lastInventory = null;
            return receipt;
        }
        finally { _generation.Release(); }
    }

    private async Task<ClosureReceipt> CheckClosureAsync(Guid operation, PreparedClosure plan, string call)
    {
        var absent = false; var verified = false;
        try
        {
            var current = await ReadInventoryAsync().ConfigureAwait(false);
            absent = current.Accounts.All(a => a.Id != plan.Account.Id);
            // UUID, identity and state of ALL witnesses must match; count alone
            // cannot detect deletion of B and creation of C.
            var expected = plan.Inventory.Accounts.Where(a => a.Id != plan.Account.Id).OrderBy(a => a.Id).ToArray();
            if (!absent || !expected.SequenceEqual(current.Accounts.OrderBy(a => a.Id))) throw new AdminException("drift");
            var evidence = await _closureEvidence.ReadAsync(plan.Account, current, "postcheck").ConfigureAwait(false) ?? throw new AdminException("closure_evidence");
            ClosureContract.ValidateEvidence(evidence, plan.Account, current, "postcheck", _clock.GetUtcNow(), after: true);
            if (evidence.OperatorId != plan.Evidence.OperatorId || evidence.WitnessDigest != plan.Evidence.WitnessDigest) throw new AdminException("drift");
            verified = true;
        }
        catch { /* Unknown remains unknown; absence alone cannot prove cascades. */ }
        return new(operation, verified ? ClosureStatus.ActiveDataVerifiedDeleted : absent ? ClosureStatus.AuthAbsentChecksIncomplete : ClosureStatus.Uncertain,
            call, absent, verified, _clock.GetUtcNow());
    }
}
