using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

public sealed record HistoryStatus(int Operations, int PrivateDeliveries, int AclOnlyLinks);

public sealed partial class AutomaticPrivateStore
{
    public HistoryStatus InspectHistory() => ReadHistory().Status;

    internal void VerifyOperator(AccountInventory inventory)
    {
        if (!IsOperatorPresent(inventory)) throw new AdminException("backup_operator");
    }

    internal bool IsOperatorPresent(AccountInventory inventory)
    {
        string firstInvite;
        try { firstInvite = new WindowsPrivateStore(directory, "").SingleHistoricalInvite(); }
        catch (AdminException error) when (error.Code == "backup_operator") { return false; }
        return inventory.Accounts.Count(a => a.ConfirmedAt.HasValue && !a.RecoveryRestricted && !a.ClosureRestricted
            && ClosureContract.TargetHash(a.Email) == firstInvite) == 1;
    }

    private sealed record HistorySnapshot(HistoryStatus Status, Dictionary<string, string> Files);

    private HistorySnapshot ReadHistory()
    {
        try
        {
            var old = new WindowsPrivateStore(directory, "");
            var legacy = old.InspectLegacyHistory();
            var operations = legacy.Ids.ToHashSet();
            var files = legacy.Files.ToDictionary(path => Path.GetFileName(path)!,
                path => Convert.ToHexStringLower(SHA256.HashData(Read(path, 1_000_000))), StringComparer.Ordinal);
            foreach (var reservation in ReadReservations())
            {
                if (!operations.Add(reservation.Id)) throw new AdminException("private");
                if (reservation.Status == "complete")
                {
                    var saved = ReadResult(reservation.Id);
                    if (saved.CreatedAt != reservation.CreatedAt || saved.Reused
                        || reservation.Kind != SimpleOperationKind.Delete && !ClosureContract.Uuid(saved.AccountId ?? ""))
                        throw new AdminException("private");
                }
            }
            foreach (var path in Directory.EnumerateFiles(directory, "admin-v2-*"))
                files.Add(Path.GetFileName(path), Convert.ToHexStringLower(SHA256.HashData(Read(path, 65536))));
            if (bindProductionHistory)
            {
                if (operations.Count == 0) throw new AdminException("legacy_conflict");
                using var registry = Registry.CurrentUser.OpenSubKey(historyRegistry);
                if (registry?.GetValue("HistoryAnchor") is byte[] anchor)
                {
                    var plain = Protect(anchor, decrypt: true);
                    try
                    {
                        var original = JsonSerializer.Deserialize<Dictionary<string, string>>(plain) ?? throw new AdminException("private");
                        if (original.Count == 0 || original.Any(pair => !files.TryGetValue(pair.Key, out var digest) || digest != pair.Value))
                            throw new AdminException("legacy_conflict");
                    }
                    finally { CryptographicOperations.ZeroMemory(plain); }
                }
            }
            return new(new(operations.Count, legacy.Delivered, legacy.AclOnlyLinks), files);
        }
        catch (AdminException) { throw; }
        catch { throw new AdminException("private"); }
    }
}

public sealed partial class WindowsPrivateStore
{
    internal sealed record LegacyHistory(IReadOnlyCollection<Guid> Ids, IReadOnlyCollection<string> Files, int Delivered, int AclOnlyLinks);

    internal LegacyInvitation? FindLegacyInvitation(string email)
    {
        var hash = TargetHash(email);
        var matches = Directory.EnumerateFiles(DirectoryPath).Where(path =>
                Path.GetFileName(path) == $"reservation-{hash}.json"
                || Path.GetFileName(path).StartsWith("history-reservation-", StringComparison.Ordinal) && path.EndsWith(".json", StringComparison.Ordinal))
            .Select(path => ReadRecord(path, archived: Path.GetFileName(path).StartsWith("history-", StringComparison.Ordinal)))
            .Where(r => r["targetHash"]!.GetValue<string>() == hash && r["type"]!.GetValue<string>() == "invite"
                && r["status"]!.GetValue<string>() == "delivered-private")
            .ToArray();
        if (matches.Length > 1) throw new AdminException("invitation_history");
        return matches.Length == 0 ? null : new LegacyInvitation(Guid.Parse(matches[0]["operationId"]!.GetValue<string>()),
            RequireDate(matches[0], "reservedAt"), RequireDate(matches[0], "deliveredAt"));
    }

    internal string SingleHistoricalInvite()
    {
        var invitations = Directory.EnumerateFiles(DirectoryPath, "reservation-*.json").Select(path => ReadRecord(path))
            .Where(record => record["type"]!.GetValue<string>() == "invite" && record["status"]!.GetValue<string>() == "delivered-private")
            .ToArray();
        if (invitations.Length != 1) throw new AdminException("backup_operator");
        return invitations[0]["targetHash"]!.GetValue<string>();
    }

    internal static string? ApplicationRepository() => FindRepository(AppContext.BaseDirectory)
        ?? FindRepository(Directory.GetCurrentDirectory());

    internal LegacyHistory InspectLegacyHistory()
    {
        var paths = Directory.EnumerateFiles(DirectoryPath).ToArray();
        var ids = new HashSet<Guid>();
        var files = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var links = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var delivered = 0;
        var aclOnly = 0;
        var recoveries = ReadRecoveries();
        _ = ReadClosures();
        foreach (var path in paths)
        {
            var name = Path.GetFileName(path);
            if (name.EndsWith(".new", StringComparison.OrdinalIgnoreCase)) throw new AdminException("pending");
            var archived = name.StartsWith("history-reservation-", StringComparison.Ordinal);
            if (!(archived || name.StartsWith("reservation-", StringComparison.Ordinal)) || !name.EndsWith(".json", StringComparison.Ordinal))
                continue;
            var record = ReadRecord(path, archived: archived);
            var id = Guid.Parse(record["operationId"]!.GetValue<string>());
            if (!ids.Add(id)) throw new AdminException("private");
            files.Add(path);
            var reservedAt = RequireDate(record, "reservedAt");
            var link = Path.Combine(DirectoryPath, $"auth-link-{id:D}.txt");
            links.Add(link);
            if (record["status"]!.GetValue<string>() == "reserved")
            {
                if (archived) throw new AdminException("private");
                continue;
            }
            var deliveredAt = RequireDate(record, "deliveredAt");
            if (deliveredAt < reservedAt || record["handedOverAt"] is not null && RequireDate(record, "handedOverAt") < deliveredAt)
                throw new AdminException("private");
            delivered++;
            // The Node V1 store used ACLs only. V1.1 receipts require the EFS
            // contract on their own links. A legitimately withdrawn, handed-over
            // link does not make its completed historical reservation disappear.
            if (File.Exists(link))
            {
                VerifyProtectedFile(link);
                if (new FileInfo(link).Length is <= 0 or > 4096) throw new AdminException("private");
                var text = File.ReadAllText(link, new UTF8Encoding(false, true));
                if (!text.EndsWith('\n')) throw new AdminException("private");
                ValidateRecoveryLink(text[..^1], record["type"]!.GetValue<string>());
                if (!File.GetAttributes(link).HasFlag(FileAttributes.Encrypted)) aclOnly++;
                files.Add(link);
            }
            else if (record["handedOverAt"] is null && !archived) throw new AdminException("private");
        }
        foreach (var recovery in recoveries)
        {
            if (!ids.Add(recovery.Id)) throw new AdminException("private");
            var link = Path.Combine(DirectoryPath, $"auth-link-{recovery.Id:D}.txt");
            links.Add(link);
            if (recovery.Status != "reserved")
            {
                delivered++;
                if (File.Exists(link))
                {
                    _ = VerifyDeliveredLink(recovery.Id, "recovery");
                    files.Add(link);
                }
            }
        }
        foreach (var path in paths)
        {
            var name = Path.GetFileName(path);
            if (name.StartsWith("auth-link-", StringComparison.OrdinalIgnoreCase) && !links.Contains(path))
                throw new AdminException("private");
            if (name.StartsWith("recovery-", StringComparison.Ordinal)) files.Add(path);
        }
        return new(ids, files, delivered, aclOnly);
    }
}
