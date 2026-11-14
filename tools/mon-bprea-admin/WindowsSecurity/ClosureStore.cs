using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

public sealed partial class WindowsPrivateStore : IClosureStore
{
    private string DeletionLedger => Path.Combine(DirectoryPath, "deletions.json");
    private JsonArray ReadDeletionLedger()
    {
        VerifyPrivateDirectory(); VerifyProtectedFile(DeletionLedger);
        if (new FileInfo(DeletionLedger).Length is <= 0 or > 1_000_000) throw new AdminException("private");
        var text = File.ReadAllText(DeletionLedger, Encoding.UTF8);
        using (var doc = JsonDocument.Parse(text)) CheckUnique(doc.RootElement);
        var array = JsonNode.Parse(text) as JsonArray ?? throw new AdminException("private");
        if (array.Any(x => x is not JsonObject)) throw new AdminException("private");
        return array;
    }
    // Same JSON.stringify projection as preopening.digest: object property order
    // is retained, no whitespace, and Unicode is not escaped. Existing entries
    // are never projected onto a narrower schema or discarded.
    private static readonly JsonSerializerOptions LedgerJson = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    public Task<string> ReadDeletionLedgerHashAsync() => Safe(() => {
        var ledger = ReadDeletionLedger(); ReadClosures(ledger);
        return ClosureContract.Hash(ledger.ToJsonString(LedgerJson));
    });
    public Task RecordClosurePreparationAsync(AuthAccount account, ClosureRequest request) => Safe(() => {
        RequireLock(); VerifyPrivateDirectory();
        var record = new JsonObject {
            ["version"] = 3, ["project"] = Project, ["accountId"] = account.Id,
            ["targetHash"] = TargetHash(account.Email), ["reference"] = request.Reference,
            ["receivedAt"] = request.ReceivedAt.ToString("O"), ["recordedAt"] = clock().ToString("O"),
            ["status"] = "prepared", ["attestations"] = JsonSerializer.SerializeToNode(request.Attestations)
        };
        WriteExclusive(Path.Combine(DirectoryPath, $"closure-request-{Guid.NewGuid():D}.json"), record.ToJsonString(LedgerJson), encrypted: true);
    });
    public Task<Guid> ReserveClosureAsync(PreparedClosure plan) => Safe(() => {
        RequireLock(); VerifyPrivateDirectory();
        var ledger = ReadDeletionLedger();
        if (ClosureContract.Hash(ledger.ToJsonString(LedgerJson)) != plan.LedgerHash || ReadClosures(ledger).Count != 0)
            throw new AdminException("pending");
        var id = Guid.NewGuid(); var now = clock();
        var intent = new JsonObject {
            ["version"] = 3, ["type"] = "closure", ["project"] = Project, ["operationId"] = id.ToString("D"),
            ["accountId"] = plan.Account.Id, ["targetHash"] = TargetHash(plan.Account.Email),
            ["projectRef"] = Project, ["userId"] = plan.Account.Id,
            ["reference"] = plan.Request.Reference, ["decidedAt"] = now.ToString("O"), ["identityChecked"] = true,
            ["scope"] = "auth-and-ten-tables", ["status"] = "pending/uncertain",
            ["backupReferences"] = new JsonArray(plan.Evidence.BackupReference),
            ["previousLedgerHash"] = plan.LedgerHash,
            ["residuals"] = new JsonArray("backups-reconcile-before-restore", "jwt-until-expiry", "devices-and-downloads"),
            ["nextAction"] = "postcheck-and-residual-review", ["reviewDueAt"] = now.AddDays(1).ToString("O"),
            ["attestations"] = JsonSerializer.SerializeToNode(plan.Request.Attestations)
        };
        // Any crash from this point leaves an immutable intent blocking all
        // administration. A DELETE cannot precede the current ledger flush.
        WriteExclusive(Path.Combine(DirectoryPath, $"closure-{id:D}-intent.json"), intent.ToJsonString(LedgerJson), encrypted: true);
        var original = File.ReadAllText(DeletionLedger, Encoding.UTF8);
        WriteExclusive(Path.Combine(DirectoryPath, $"history-deletions-{id:D}.json"), original, encrypted: true);
        ledger.Add(intent.DeepClone());
        var temporary = Path.Combine(DirectoryPath, $"deletions-{id:D}.new");
        WriteExclusive(temporary, ledger.ToJsonString(LedgerJson), encrypted: true);
        VerifyProtectedFile(DeletionLedger);
        File.Move(temporary, DeletionLedger, overwrite: true);
        VerifyProtectedFile(DeletionLedger);
        if (ReadClosures(ReadDeletionLedger()).Single().Id != id) throw new AdminException("private");
        return id;
    });
    public Task RecordClosureResultAsync(ClosureReceipt receipt) => Safe(() => {
        RequireLock(); VerifyPrivateDirectory();
        var states = ReadClosures(ReadDeletionLedger());
        if (states.All(x => x.Id != receipt.OperationId)) throw new AdminException("private");
        var result = new JsonObject {
            ["version"] = 3, ["type"] = "closure", ["project"] = Project,
            ["operationId"] = receipt.OperationId.ToString("D"), ["recordedAt"] = receipt.CheckedAt.ToString("O"),
            ["status"] = receipt.Status.ToString(), ["authCall"] = receipt.AuthCall,
            ["authAbsent"] = receipt.AuthAbsent, ["activeDataVerified"] = receipt.ActiveDataVerified,
            ["residualFollowup"] = true
        };
        if (receipt.ActiveDataVerified) {
            result["targetRows"] = JsonSerializer.SerializeToNode(ClosureContract.Tables.ToDictionary(t => t, _ => 0));
            result["sessions"] = "absent-verified"; result["refreshTokens"] = "absent-verified";
        }
        WriteExclusive(Path.Combine(DirectoryPath, $"closure-{receipt.OperationId:D}-result.json"), result.ToJsonString(LedgerJson), encrypted: true);
        ReadClosures(ReadDeletionLedger());
    });
    private sealed record ClosureState(Guid Id, string Hash);
    private List<ClosureState> ReadClosures(JsonArray? ledger = null)
    {
        var paths = Directory.EnumerateFiles(DirectoryPath, "closure-*.json").Where(p => !Path.GetFileName(p).StartsWith("closure-request-", StringComparison.Ordinal)).ToArray();
        if (paths.Length == 0) {
            if (File.Exists(DeletionLedger) && ReadDeletionLedger().Any(IsClosureEntry)) throw new AdminException("private");
            return [];
        }
        ledger ??= ReadDeletionLedger();
        var intents = new Dictionary<Guid, JsonObject>(); var results = new Dictionary<Guid, JsonObject>();
        foreach (var path in paths)
        {
            VerifyProtectedFile(path);
            if (new FileInfo(path).Length is <= 0 or > 65536) throw new AdminException("private");
            var text = File.ReadAllText(path, Encoding.UTF8);
            using (var doc = JsonDocument.Parse(text)) CheckUnique(doc.RootElement);
            var r = JsonNode.Parse(text)!.AsObject();
            if (r["version"]?.GetValue<int>() != 3 || r["type"]?.GetValue<string>() != "closure" || r["project"]?.GetValue<string>() != Project
                || !Guid.TryParseExact(r["operationId"]?.GetValue<string>(), "D", out var id)) throw new AdminException("private");
            if (path == Path.Combine(DirectoryPath, $"closure-{id:D}-intent.json"))
            {
                if (r["identityChecked"]?.GetValue<bool>() != true || r["status"]?.GetValue<string>() != "pending/uncertain"
                    || !intents.TryAdd(id, r)) throw new AdminException("private");
                RequireDate(r, "decidedAt"); RequireDate(r, "reviewDueAt");
                if (!ledger.Any(entry => JsonNode.DeepEquals(entry, r))) throw new AdminException("private");
            }
            else if (path != Path.Combine(DirectoryPath, $"closure-{id:D}-result.json") || !results.TryAdd(id, r)) throw new AdminException("private");
        }
        foreach (var (id, r) in results)
        {
            if (!intents.TryGetValue(id, out var intent) || RequireDate(r, "recordedAt") < RequireDate(intent, "decidedAt")
                || r["status"]?.GetValue<string>() is not ("Uncertain" or "AuthAbsentChecksIncomplete" or "ActiveDataVerifiedDeleted")
                || r["authCall"]?.GetValue<string>() is not ("uncertain" or "http-success")) throw new AdminException("private");
        }
        foreach (var entry in ledger.Where(IsClosureEntry))
            if (!Guid.TryParseExact(entry!["operationId"]?.GetValue<string>(), "D", out var id) || !intents.ContainsKey(id)) throw new AdminException("private");
        // Deliberately no release/reset method in V1.2. A completed deletion
        // still needs residual and backup reconciliation review before reuse.
        return intents.Select(pair => new ClosureState(pair.Key, pair.Value["targetHash"]!.GetValue<string>())).ToList();
    }
    private static bool IsClosureEntry(JsonNode? node) => node?["version"]?.GetValue<int>() == 3 && node?["type"]?.GetValue<string>() == "closure";
}
