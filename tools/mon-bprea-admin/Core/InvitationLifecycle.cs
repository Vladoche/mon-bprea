using System.Text.RegularExpressions;
using System.Text.Json;

namespace MonBprea.Admin.Core;

public sealed partial class SimpleAdminSession
{
    private const string AuthConfigPath = "/v1/projects/" + AdminContract.Project + "/config/auth";
    private string? authConfigToken;

    public async Task<int> CheckInvitationDurationAsync(string token)
    {
        if (target.IsLocal || !Regex.IsMatch(token, @"\A[A-Za-z0-9_.-]{20,512}\z")
            || token.StartsWith("sb_secret_", StringComparison.Ordinal) || token.StartsWith("sb_publishable_", StringComparison.Ordinal))
            throw new AdminException("otp_unverified");
        authConfigToken = null;
        var seconds = await ReadProductionExpiry(token) ?? throw new AdminException("otp_unverified");
        authConfigToken = token;
        return seconds;
    }

    private async Task<int?> ReadProductionExpiry(string token)
    {
        try
        {
            using var config = await Send(HttpMethod.Get, AuthConfigPath, authConfigToken: token);
            return config.RootElement.ValueKind == JsonValueKind.Object
                && config.RootElement.TryGetProperty("mailer_otp_exp", out var expiry)
                && expiry.ValueKind == JsonValueKind.Number && expiry.TryGetInt32(out var seconds) && seconds > 0 ? seconds : null;
        }
        catch (AdminException) { return null; }
    }

    private Task<int?> ReadInvitationExpiry() => target.IsLocal ? Task.FromResult(capabilities?.OtpExpiry)
        : authConfigToken is string token ? ReadProductionExpiry(token) : Task.FromResult<int?>(null);

    public async Task RequireProductionInvitationDurationAsync()
    {
        var seconds = await ReadInvitationExpiry();
        if (seconds is null) throw new AdminException("otp_unverified");
        if (!target.IsLocal && seconds != AdminContract.InvitationExpirySeconds) throw new AdminException("otp_duration");
    }

    public async Task<InvitationReview> ReviewInvitationAsync(AuthAccount selected)
    {
        using var lease = store.AcquireLock();
        if (store.HasUncertainOperation()) throw new AdminException("pending");
        var current = await RefreshAsync();
        var account = RequireInvitationAccount(current, selected.Id, selected.Email);
        return ReviewInvitation(account, await ReadInvitationExpiry()).Review;
    }

    public Task<SimpleResult> RenewInvitationAsync(InvitationReview selected) => IssueInvitation(selected.Account.Email, selected);

    public async Task<PersonalLink> ReadInvitationLinkAsync(AuthAccount selected, Guid operation)
    {
        using var lease = store.AcquireLock();
        if (store.HasUncertainOperation()) throw new AdminException("pending");
        var current = await RefreshAsync();
        var account = RequireInvitationAccount(current, selected.Id, selected.Email);
        var (review, saved) = ReviewInvitation(account, await ReadInvitationExpiry());
        if (review.LatestOperation != operation) throw new AdminException("invitation_changed");
        if (review.State != InvitationState.Pending || saved is null) throw new AdminException("invitation_unusable");
        return saved.Links.Single();
    }

    private async Task<SimpleResult> IssueInvitation(string email, InvitationReview? selected)
    {
        if (!await mutation.WaitAsync(0)) throw new AdminException("busy");
        try
        {
            using var lease = store.AcquireLock();
            if (store.HasUncertainOperation()) throw new AdminException("pending");
            var current = await RefreshAsync();
            var existing = current.Accounts.SingleOrDefault(account => account.Email == email);
            if (selected is null && existing is not null)
            {
                if (existing.ConfirmedAt.HasValue) throw new AdminException("exists");
                var (review, saved) = ReviewInvitation(RequireInvitationAccount(current, existing.Id, email), await ReadInvitationExpiry());
                if (review.State == InvitationState.Pending && saved is not null)
                    return saved with { Reused = true, Title = "Lien d’activation déjà créé" };
                throw new AdminException("invitation_existing");
            }

            if (selected is null)
            {
                if (current.AvailableParticipantPlaces == 0) throw new AdminException("capacity");
                if (current.Accounts.Any(a => a.RecoveryRestricted || !a.ConfirmedAt.HasValue && !a.InvitedAt.HasValue))
                    throw new AdminException("lookup");
                if (store.InvitationHistory(email).Count != 0 || store.FindLegacyInvitation(email) is not null)
                    throw new AdminException("invitation_history");
            }
            else
            {
                var account = RequireInvitationAccount(current, selected.Account.Id, email);
                RequireSameInvitation(selected, ReviewInvitation(account, null).Review);
            }
            if (store.HasLegacyTarget(email)) throw new AdminException("pending");
            if (!target.IsLocal)
            {
                if (invitationGuard is null) throw new AdminException("backup_evidence");
                await invitationGuard(current);
            }

            var expiry = await ReadInvitationExpiry();
            if (expiry is null) throw new AdminException("otp_unverified");
            if (!target.IsLocal && expiry != AdminContract.InvitationExpirySeconds) throw new AdminException("otp_duration");
            // The project inspection and backup check can take time. Read Auth
            // again immediately before reserving the one request.
            var latest = await RefreshAsync();
            if (!SameAccounts(latest.Accounts, current.Accounts))
            {
                if (selected is not null) _ = RequireInvitationAccount(latest, selected.Account.Id, email);
                throw new AdminException("invitation_changed");
            }
            if (selected is null && latest.AvailableParticipantPlaces == 0) throw new AdminException("capacity");
            var kind = selected is null ? SimpleOperationKind.Invite : SimpleOperationKind.RenewInvitation;
            var now = clock.GetUtcNow();
            var id = store.Reserve(email, kind, selected?.Account.Id, null, now, initialInvitation: selected?.InitialOperation);
            try
            {
                using var generated = await Send(HttpMethod.Post,
                    "/auth/v1/admin/generate_link?redirect_to=" + Uri.EscapeDataString(target.Callback),
                    new { type = "invite", email, redirect_to = target.Callback });
                var link = ValidateLink(generated.RootElement, email, "invite", selected?.Account.Id);
                var resultAccountId = generated.RootElement.GetProperty("id").GetString()!;
                var generatedAt = generated.RootElement.GetProperty("invited_at").GetDateTimeOffset();
                var after = await RefreshAsync();
                var renewed = RequireInvitationAccount(after, resultAccountId, email);
                var invitationDate = renewed.InvitedAt!.Value;
                if (after.Count != current.Count + (selected is null ? 1 : 0)
                    || !SameAccounts(after.Accounts.Where(a => a.Id != renewed.Id), current.Accounts.Where(a => a.Id != renewed.Id))
                    || (generatedAt - invitationDate).Duration() >= TimeSpan.FromMilliseconds(1)
                    || !NearReservation(now, invitationDate)
                    || selected is not null && (invitationDate <= selected.Account.InvitedAt || renewed.CreatedAt != selected.Account.CreatedAt))
                    throw new AdminException("uncertain");
                var confirmedExpiry = expiry == await ReadInvitationExpiry() ? expiry : null;
                var result = new SimpleResult(id, selected is null ? "Lien d’activation créé" : "Nouveau lien d’activation généré",
                    "Transmets le lien à ton camarade. Il choisira lui-même son mot de passe. Le compte attend son activation.",
                    [new(email, link)], now, confirmedExpiry, renewed.Id, InvitationGeneratedAt: invitationDate);
                store.Complete(result);
                return result;
            }
            catch { throw new AdminException("uncertain"); }
        }
        finally { mutation.Release(); }
    }

    public async Task ReconcileInvitationAsync()
    {
        using var lease = store.AcquireLock();
        var pending = store.PendingInvitationRenewal() ?? throw new AdminException("pending");
        SimpleResult saved;
        try { saved = store.ReadResult(pending.Id); }
        catch { throw new AdminException("invitation_no_receipt"); }
        if (saved.Links.Count != 1) throw new AdminException("pending");
        var current = await RefreshAsync();
        var account = RequireInvitationAccount(current, pending.AccountId!, saved.Links.Single().Address);
        var (review, _) = ReviewInvitation(account, null, pending, saved);
        if (review.LatestOperation != pending.Id || saved.InvitationGeneratedAt != account.InvitedAt)
            throw new AdminException("invitation_no_receipt");
        store.ReconcileInvitation(saved);
    }

    private AuthAccount RequireInvitationAccount(AccountInventory current, string id, string email)
    {
        var account = current.Accounts.SingleOrDefault(a => a.Id == id && a.Email == email) ?? throw new AdminException("invitation_changed");
        if (account.RecoveryRestricted || account.ClosureRestricted || capabilities?.OperatorId == account.Id)
            throw new AdminException("invitation_restricted");
        if (account.ConfirmedAt.HasValue) throw new AdminException("invitation_activated");
        if (account.InvitationRestricted || account.InvitedAt is not DateTimeOffset invitedAt || invitedAt != account.ConfirmationSentAt
            || account.CreatedAt is not DateTimeOffset createdAt || createdAt > invitedAt.AddSeconds(1)
            || invitedAt > clock.GetUtcNow().AddSeconds(5)) throw new AdminException("invitation_history");
        return account;
    }

    private static void RequireSameInvitation(InvitationReview selected, InvitationReview current)
    {
        if (selected.Account != current.Account || selected.InitialOperation != current.InitialOperation
            || selected.LatestOperation != current.LatestOperation) throw new AdminException("invitation_changed");
    }

    private (InvitationReview Review, SimpleResult? Saved) ReviewInvitation(AuthAccount account, int? expiry,
        SimpleReservation? pending = null, SimpleResult? pendingResult = null)
    {
        var history = store.InvitationHistory(account.Email);
        var legacy = store.FindLegacyInvitation(account.Email);
        var first = history.FirstOrDefault();
        var initial = first?.Kind == SimpleOperationKind.Invite && legacy is null ? first.Id
            : first?.Kind != SimpleOperationKind.Invite && legacy is not null ? legacy.Id
            : throw new AdminException("invitation_history");
        var latest = initial;
        DateTimeOffset? previous = legacy?.DeliveredAt;
        SimpleResult? saved = null;
        foreach (var entry in history)
        {
            if (entry.Kind == SimpleOperationKind.RenewInvitation && (entry.InitialInvitation != initial || entry.AccountId != account.Id)
                || entry.Kind == SimpleOperationKind.Invite && entry.Id != initial
                || entry.Status != "complete" && entry.Id != pending?.Id) throw new AdminException("invitation_history");
            saved = entry.Id == pending?.Id ? pendingResult! : store.ReadResult(entry.Id);
            if (saved.Operation != entry.Id || saved.AccountId != account.Id || saved.Links.Count != 1
                || saved.Links[0].Address != account.Email || saved.CreatedAt != entry.CreatedAt
                || saved.InvitationGeneratedAt is DateTimeOffset date && !NearReservation(entry.CreatedAt, date))
                throw new AdminException("invitation_history");
            var timestamp = saved.InvitationGeneratedAt ?? saved.CreatedAt;
            if (previous is not null && timestamp <= previous) throw new AdminException("invitation_history");
            previous = timestamp;
            latest = entry.Id;
        }
        var generated = account.InvitedAt!.Value;
        if (saved is not null
            ? saved.InvitationGeneratedAt is DateTimeOffset recorded ? recorded != generated : !NearReservation(saved.CreatedAt, generated)
            : legacy is null || generated < legacy.ReservedAt.AddSeconds(-5) || generated > legacy.DeliveredAt.AddSeconds(5))
            throw new AdminException("invitation_history");
        // A later config increase never lengthens the local lifetime assigned
        // to a previous link. Unverified historical links are never offered.
        var seconds = saved?.ExpirySeconds;
        var age = clock.GetUtcNow() - generated;
        var state = seconds is > 0 && age >= TimeSpan.FromSeconds(seconds.Value)
            || expiry is > 0 && age >= TimeSpan.FromSeconds(expiry.Value)
            ? InvitationState.Expired
            : seconds is > 0 && expiry is > 0 ? InvitationState.Pending : InvitationState.DurationUnknown;
        return (new(account, initial, latest, state), saved);
    }

    private static bool NearReservation(DateTimeOffset reserved, DateTimeOffset generated) =>
        generated >= reserved.AddSeconds(-5) && generated <= reserved.AddSeconds(30);

    private static bool SameAccounts(IEnumerable<AuthAccount> first, IEnumerable<AuthAccount> second) =>
        first.OrderBy(a => a.Id, StringComparer.Ordinal).SequenceEqual(second.OrderBy(a => a.Id, StringComparer.Ordinal));
}
