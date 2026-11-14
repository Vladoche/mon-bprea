using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

public sealed partial class WindowsPrivateStore
{
    // Append-only V2 events. V1 reservations, their bytes and dates remain untouched.
    // Node reads the same events before reserving under operation.lock.
    private sealed record RecoveryState(Guid Id, string Hash, string Status);

    public Task<bool> HasRecoveryReservationAsync(string email) => Safe(() =>
    {
        VerifyPrivateDirectory();
        var hash = TargetHash(email);
        var legacy = ReservationPath(email);
        if (File.Exists(legacy))
        {
            var record = ReadRecord(legacy, hash);
            if (record["status"]!.GetValue<string>() == "reserved") return true;
            RequireDate(record, "deliveredAt");
            // V1/Node acknowledge local delivery. Its old link may already have
            // been withdrawn under the existing retention procedure. Do not
            // reinterpret that completed state as uncertain or rewrite it.
            // A fresh individual request and qualification remain mandatory.
            if (record["handedOverAt"] is not null) RequireDate(record, "handedOverAt");
        }
        return ReadRecoveries().Any(x => x.Status == "reserved" || x.Hash == hash && x.Status != "handed-over");
    });

    public async Task<Guid> ReserveRecoveryAsync(string email, string accountId, RecoveryAttestations attestations)
    {
        RequireLock();
        await ValidateAsync();
        if (!attestations.Complete) throw new AdminException("attestations");
        if (!Regex.IsMatch(accountId, @"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)) throw new AdminException("private");
        if (await HasUncertainOperationAsync() || await HasRecoveryReservationAsync(email)) throw new AdminException("pending");
        await Safe(() =>
        {
            var id = Guid.NewGuid();
            var record = NewRecoveryEvent(id, TargetHash(email), "reserved");
            record["accountId"] = accountId;
            record["attestations"] = new JsonObject
            {
                ["requestedByHolder"] = true, ["identityCheckedViaKnownChannel"] = true,
                ["selectedAddressConfirmed"] = true, ["privateChannelAgreed"] = true, ["holderChoosesPassword"] = true
            };
            WriteExclusive(RecoveryPath(id, "reserved"), record.ToJsonString(JsonOptions), encrypted: false);
        });
        // Return only the unique reservation just written; no network can precede this flush.
        return await Safe(() => ReadRecoveries().Single(x => x.Hash == TargetHash(email) && x.Status == "reserved").Id);
    }

    public Task DeliverRecoveryAsync(string email, Guid operationId, string link) => Safe(() =>
    {
        RequireLock();
        VerifyPrivateDirectory();
        var operation = ReadRecoveries().SingleOrDefault(x => x.Id == operationId);
        if (operation is null || operation.Hash != TargetHash(email) || operation.Status != "reserved") throw new AdminException("private");
        ValidateRecoveryLink(link, "recovery");
        WriteExclusive(Path.Combine(DirectoryPath, $"auth-link-{operationId:D}.txt"), link + "\n", encrypted: true);
        var digest = VerifyDeliveredLink(operationId, "recovery");
        var receipt = NewRecoveryEvent(operationId, operation.Hash, "delivered-private");
        receipt["linkSha256"] = digest;
        WriteExclusive(RecoveryPath(operationId, "delivered-private"), receipt.ToJsonString(JsonOptions), encrypted: false);
        ReadRecoveries();
    });

    private string RecoveryPath(Guid id, string status) => Path.Combine(DirectoryPath, $"recovery-{id:D}-{status}.json");
    private JsonObject NewRecoveryEvent(Guid id, string hash, string status) => new()
    {
        ["version"] = 2, ["project"] = Project, ["type"] = "recovery", ["operationId"] = id.ToString("D"),
        ["targetHash"] = hash, ["status"] = status, ["recordedAt"] = clock().ToString("O")
    };
    private void WriteRecoveryEvent(Guid id, string hash, string status) =>
        WriteExclusive(RecoveryPath(id, status), NewRecoveryEvent(id, hash, status).ToJsonString(JsonOptions), encrypted: false);

    private List<RecoveryState> ReadRecoveries()
    {
        var groups = new Dictionary<Guid, Dictionary<string, JsonObject>>();
        foreach (var path in Directory.EnumerateFiles(DirectoryPath, "recovery-*.json", SearchOption.TopDirectoryOnly))
        {
            VerifyProtectedFile(path);
            if (new FileInfo(path).Length is <= 0 or > 65536) throw new AdminException("private");
            var text = File.ReadAllText(path, Encoding.UTF8);
            using (var document = JsonDocument.Parse(text)) CheckUnique(document.RootElement);
            var record = JsonNode.Parse(text)!.AsObject();
            var status = record["status"]?.GetValue<string>() ?? "";
            var hash = record["targetHash"]?.GetValue<string>() ?? "";
            if (record["version"]?.GetValue<int>() != 2 || record["project"]?.GetValue<string>() != Project
                || record["type"]?.GetValue<string>() != "recovery"
                || !Guid.TryParseExact(record["operationId"]?.GetValue<string>(), "D", out var id)
                || !Regex.IsMatch(id.ToString("D"), @"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z", RegexOptions.CultureInvariant)
                || !Regex.IsMatch(hash, @"^[a-f0-9]{64}\z", RegexOptions.CultureInvariant)
                || status is not ("reserved" or "delivered-private" or "handed-over")
                || path != RecoveryPath(id, status)) throw new AdminException("private");
            RequireDate(record, "recordedAt");
            if (!groups.TryGetValue(id, out var events)) groups[id] = events = new();
            if (!events.TryAdd(status, record)) throw new AdminException("private");
        }
        var result = new List<RecoveryState>();
        foreach (var (id, events) in groups)
        {
            if (!events.TryGetValue("reserved", out var reservation)) throw new AdminException("private");
            var hash = reservation["targetHash"]!.GetValue<string>();
            if (events.Values.Any(x => x["targetHash"]!.GetValue<string>() != hash)) throw new AdminException("private");
            var accountId = reservation["accountId"]?.GetValue<string>() ?? "";
            if (!Regex.IsMatch(accountId, @"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)) throw new AdminException("private");
            foreach (var name in new[] { "requestedByHolder", "identityCheckedViaKnownChannel", "selectedAddressConfirmed", "privateChannelAgreed", "holderChoosesPassword" })
                if (reservation["attestations"]?[name]?.GetValue<bool>() != true) throw new AdminException("private");
            var status = "reserved";
            if (events.TryGetValue("delivered-private", out var receipt))
            {
                if (RequireDate(receipt, "recordedAt") < RequireDate(reservation, "recordedAt")
                    || !Regex.IsMatch(receipt["linkSha256"]?.GetValue<string>() ?? "", @"^[a-f0-9]{64}\z", RegexOptions.CultureInvariant)) throw new AdminException("private");
                status = "delivered-private";
                if (events.TryGetValue("handed-over", out var handover))
                {
                    if (RequireDate(handover, "recordedAt") < RequireDate(receipt, "recordedAt")) throw new AdminException("private");
                    status = "handed-over";
                }
                else if (VerifyDeliveredLink(id, "recovery") != receipt["linkSha256"]!.GetValue<string>()) throw new AdminException("private");
            }
            else if (events.ContainsKey("handed-over")) throw new AdminException("private");
            result.Add(new(id, hash, status));
        }
        return result;
    }

    private string VerifyDeliveredLink(Guid id, string type)
    {
        var path = Path.Combine(DirectoryPath, $"auth-link-{id:D}.txt");
        VerifyProtectedFile(path);
        if (!File.GetAttributes(path).HasFlag(FileAttributes.Encrypted) || new FileInfo(path).Length is <= 0 or > 4096) throw new AdminException("private");
        var text = File.ReadAllText(path, Encoding.UTF8);
        if (!text.EndsWith('\n')) throw new AdminException("private");
        ValidateRecoveryLink(text[..^1], type);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }
    private static void ValidateRecoveryLink(string value, string type)
    {
        if (type is not ("invite" or "recovery") || !Regex.IsMatch(value, "^" + Regex.Escape(Callback)
            + @"\?token_hash=[A-Za-z0-9_-]{20,512}&type=" + type + @"\z", RegexOptions.CultureInvariant)) throw new AdminException("private");
    }
    private static DateTimeOffset RequireDate(JsonObject record, string name)
    {
        var text = record[name]?.GetValue<string>();
        if (text is null || text.Any(char.IsControl) || !DateTimeOffset.TryParse(text, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.RoundtripKind, out var date)) throw new AdminException("private");
        return date;
    }
    private static void CheckUnique(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
            { if (!names.Add(property.Name)) throw new AdminException("private"); CheckUnique(property.Value); }
        }
        else if (element.ValueKind == JsonValueKind.Array) foreach (var child in element.EnumerateArray()) CheckUnique(child);
    }
}
