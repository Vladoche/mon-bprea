using System.Text.Json;

namespace MonBprea.Admin.Core;

// There is no caller-supplied URL, project, callback, proxy or certificate option.
// The qualification mode of the SAME executable has a separate vault and store.
public sealed record AdminTarget
{
    private AdminTarget(Guid? qualification) => Qualification = qualification;
    public static AdminTarget Production { get; } = new((Guid?)null);
    public static AdminTarget LocalQualification(Guid id) => id == Guid.Empty ? throw new AdminException("configuration") : new(id);
    public Guid? Qualification { get; }
    public bool IsLocal => Qualification.HasValue;
    public string Api => IsLocal ? "http://127.0.0.1:54321" : AdminContract.Api;
    public string Callback => IsLocal ? "http://127.0.0.1:4173/mon-bprea/authentification.html" : AdminContract.Callback;
    public string Project => IsLocal ? "mon-bprea-admin-v2-local" : AdminContract.Project;
}

public enum SimpleOperationKind { Invite, Password, Email, EmailAndPassword, Delete, RenewInvitation }
public sealed record PersonalLink(string Address, string Value)
{
    public override string ToString() => "[lien personnel masqué]";
}
public sealed record SimpleResult(Guid Operation, string Title, string Detail, IReadOnlyList<PersonalLink> Links,
    DateTimeOffset CreatedAt, int? ExpirySeconds = null, string? AccountId = null, bool Reused = false,
    DateTimeOffset? InvitationGeneratedAt = null)
{
    public override string ToString() => $"{Operation:D}: {Title}";
}
public sealed record SimpleReservation(Guid Id, SimpleOperationKind Kind, string TargetHash, string? AccountId,
    DateTimeOffset CreatedAt, string Status, string? NextHash = null, Guid? InitialInvitation = null);

public sealed record LegacyInvitation(Guid Id, DateTimeOffset ReservedAt, DateTimeOffset DeliveredAt);
public enum InvitationState { Pending, Expired, DurationUnknown }
public sealed record InvitationReview(AuthAccount Account, Guid InitialOperation, Guid LatestOperation, InvitationState State);

// This is an actual, short-lived operator decision, not proof of legal consent
// or an automatically fabricated identity attestation.
public sealed record KnownChannelDecision(string AccountId, string NewEmail, DateTimeOffset DecidedAt);

public interface ISimplePrivateStore
{
    void Initialize();
    void Validate();
    IDisposable AcquireLock();
    bool HasUncertainOperation();
    bool HasLegacyTarget(string email);
    SimpleReservation? Latest(string email, SimpleOperationKind kind);
    IReadOnlyList<SimpleReservation> InvitationHistory(string email);
    LegacyInvitation? FindLegacyInvitation(string email);
    SimpleReservation? PendingInvitationRenewal();
    Guid Reserve(string email, SimpleOperationKind kind, string? accountId, string? newEmail, DateTimeOffset now,
        string? backupReference = null, Guid? initialInvitation = null);
    void RecordStep(Guid id, string step);
    void Complete(SimpleResult result);
    void ReconcileInvitation(SimpleResult verified);
    SimpleResult ReadResult(Guid id);
    string DeletionLedgerHash();
}

internal sealed record LocalCapabilities(string Project, string OperatorId, int OtpExpiry, DateTimeOffset ObservedAt);

internal static class SimpleJson
{
    public static void Unique(JsonElement e)
    {
        if (e.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var p in e.EnumerateObject())
            { if (!names.Add(p.Name)) throw new AdminException("transport"); Unique(p.Value); }
        }
        else if (e.ValueKind == JsonValueKind.Array) foreach (var child in e.EnumerateArray()) Unique(child);
    }
}
