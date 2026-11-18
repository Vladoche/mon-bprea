using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

public sealed record BackupStatus(DateTimeOffset? Snapshot, DateTimeOffset? Deadline, bool Due, string? Problem, bool Approaching = false)
{
    public bool Ready => Problem is null;
}

internal static class BackupFiles
{
    internal const string Dump = "application.dump";
    internal const string Toc = "archive-toc.txt";
    internal const string Manifest = "manifest.json";
    internal const string Evidence = "restore-evidence.json";
    internal const string Catalogue = "source-catalogue-before.json";
    internal const string Privileges = "source-privileges-before.json";
    internal const string Ledger = "deletions.json";
    internal static readonly JsonSerializerOptions Json = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private static readonly Assembly Assembly = typeof(BackupFiles).Assembly;
    private const string MigrationPrefix = "backup/migrations/";
    private static readonly JsonElement Policy = JsonDocument.Parse(Resource("policy.json")).RootElement.Clone();
    internal static readonly string[] Tables = Strings(Policy.GetProperty("tables"));
    internal static readonly string[] Exclusions = Strings(Policy.GetProperty("excludedBackupScopes"));
    internal static readonly int WarningHours = Policy.GetProperty("backup").GetProperty("warningAgeHours").GetInt32();
    internal static readonly int MaximumHours = Policy.GetProperty("backup").GetProperty("maximumAgeHours").GetInt32();
    internal static readonly string[] Migrations = Assembly.GetManifestResourceNames()
        .Where(name => name.StartsWith(MigrationPrefix, StringComparison.Ordinal))
        .Select(name => name[MigrationPrefix.Length..]).Order(StringComparer.Ordinal).ToArray();
    internal static readonly string SchemaHash = Hash(JsonSerializer.Serialize(Migrations
        .Select(name => new[] { name, Resource("migrations/" + name).Replace("\r\n", "\n", StringComparison.Ordinal) }), Json));
    internal static readonly string SourceCommit = Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!
        .InformationalVersion.Split('+').Last();

    internal static string Resource(string name)
    {
        using var reader = new StreamReader(Assembly.GetManifestResourceStream("backup/" + name)!);
        return reader.ReadToEnd();
    }

    internal static string Hash(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    internal static string Digest(JsonElement value) => Hash(JsonSerializer.Serialize(value, Json));
    internal static bool IsHash(string? value) => value is { Length: 64 } && value.All(char.IsAsciiHexDigitLower);
    internal static string[] Strings(JsonElement array) => array.EnumerateArray().Select(x => x.GetString()!).ToArray();
    internal static void Require(bool passed, string code = "backup_evidence")
    {
        if (!passed) throw new AdminException(code);
    }

    internal static JsonElement Parse(string text)
    {
        using var document = JsonDocument.Parse(text);
        SimpleJson.Unique(document.RootElement);
        return document.RootElement.Clone();
    }

    internal static void VerifyStorage(string path, bool directory)
    {
        if (directory) WindowsPrivateStore.VerifyV2Directory(path);
        else WindowsPrivateStore.VerifyProtectedFile(path);
        Require(File.GetAttributes(path).HasFlag(FileAttributes.Encrypted), "backup_storage");
    }

    internal static string Read(string path, int maximum = 2_000_000)
    {
        VerifyStorage(path, directory: false);
        Require(new FileInfo(path).Length is > 0 && new FileInfo(path).Length <= maximum);
        return File.ReadAllText(path, new UTF8Encoding(false, true));
    }

    internal static JsonElement ReadLegacy(string path)
    {
        WindowsPrivateStore.VerifyProtectedFile(path, allowLegacyAdministrators: true);
        Require(new FileInfo(path).Length is > 0 and <= 1_000_000, "backup_ledger");
        return Parse(File.ReadAllText(path, new UTF8Encoding(false, true)));
    }

    internal static void Write(string path, string contents)
    {
        using (WindowsPrivateStore.NewV2File(path)) { }
        // Check ACL and EFS on the empty file before writing any content.
        VerifyStorage(path, directory: false);
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough);
        stream.Write(Encoding.UTF8.GetBytes(contents));
        stream.Flush(true);
    }

    internal static void Save(string path, object contents) => Write(path, JsonSerializer.Serialize(contents, Json) + "\n");

    internal sealed record Fingerprint(long bytes, string sha256);
    private static Fingerprint Identify(string path)
    {
        VerifyStorage(path, directory: false);
        using var stream = File.OpenRead(path);
        Require(stream.Length > 0);
        return new(stream.Length, Convert.ToHexStringLower(SHA256.HashData(stream)));
    }

    internal static void CheckToc(string toc)
    {
        var entries = Regex.Matches(toc, @"^\d+; \d+ \d+ TABLE( DATA)? ([a-z_]+) ([a-z_]+) ", RegexOptions.Multiline);
        Require(entries.All(m => m.Groups[2].Value == "public")
            && entries.Count == 2 * Tables.Length
            && entries.Where(m => !m.Groups[1].Success).Select(m => m.Groups[3].Value).Order().SequenceEqual(Tables.Order())
            && entries.Where(m => m.Groups[1].Success).Select(m => m.Groups[3].Value).Order().SequenceEqual(Tables.Order())
            && !Regex.IsMatch(toc, @"^\d+; \d+ \d+ .*\b(auth|storage|vault)\b", RegexOptions.Multiline));
    }

    internal static JsonElement Seal(string generation, DateTimeOffset start, DateTimeOffset completed, string toolVersion,
        string sourceCommit, string project = AdminContract.Project)
    {
        CheckToc(Read(Path.Combine(generation, Toc)));
        var body = JsonSerializer.SerializeToElement(new {
            version = 1, projectRef = project, sourceKind = SourceKind(project), snapshotStartedAt = start,
            completedAt = completed, sourceCommit, toolVersion, schemaHash = SchemaHash,
            method = "pg_dump-custom-single-snapshot", tables = Tables, exclusions = Exclusions, authIncluded = false,
            files = new Dictionary<string, Fingerprint> { [Dump] = Identify(Path.Combine(generation, Dump)), [Toc] = Identify(Path.Combine(generation, Toc)) }
        }, Json);
        Save(Path.Combine(generation, Manifest), body);
        return body;
    }

    internal static BackupStatus Verify(string generation, string ledgerHash, DateTimeOffset now,
        string project = AdminContract.Project, string proofName = Evidence)
    {
        VerifyStorage(generation, directory: true);
        var manifest = Parse(Read(Path.Combine(generation, Manifest)));
        var proof = Parse(Read(Path.Combine(generation, proofName)));
        Require(manifest.GetProperty("version").GetInt32() == 1 && manifest.GetProperty("projectRef").GetString() == project
            && manifest.GetProperty("sourceKind").GetString() == SourceKind(project) && manifest.GetProperty("schemaHash").GetString() == SchemaHash
            && Regex.IsMatch(manifest.GetProperty("sourceCommit").GetString()!, "^[a-f0-9]{40}$")
            && Regex.IsMatch(manifest.GetProperty("toolVersion").GetString()!, @"^pg_dump \(PostgreSQL\) 17\.\d+(?:\.\d+)?$")
            && manifest.GetProperty("method").GetString() == "pg_dump-custom-single-snapshot" && !manifest.GetProperty("authIncluded").GetBoolean()
            && Strings(manifest.GetProperty("tables")).Order().SequenceEqual(Tables.Order())
            && Strings(manifest.GetProperty("exclusions")).Order().SequenceEqual(Exclusions.Order()));
        var point = manifest.GetProperty("snapshotStartedAt").GetDateTimeOffset();
        var completed = manifest.GetProperty("completedAt").GetDateTimeOffset();
        var tested = proof.GetProperty("testedAt").GetDateTimeOffset();
        Require(point <= completed && completed <= tested && tested <= now);
        var files = manifest.GetProperty("files");
        Require(files.EnumerateObject().Count() == 2);
        foreach (var name in new[] { Dump, Toc })
        {
            var expected = files.GetProperty(name);
            var actual = Identify(Path.Combine(generation, name));
            Require(expected.GetProperty("bytes").GetInt64() == actual.bytes && expected.GetProperty("sha256").GetString() == actual.sha256);
        }
        CheckToc(Read(Path.Combine(generation, Toc)));
        Require(proof.GetProperty("version").GetInt32() == 1 && proof.GetProperty("manifestHash").GetString() == Digest(manifest)
            && proof.GetProperty("projectRef").GetString() == project && proof.GetProperty("schemaHash").GetString() == SchemaHash
            && proof.GetProperty("archiveHash").GetString() == files.GetProperty(Dump).GetProperty("sha256").GetString()
            && IsHash(ledgerHash) && proof.GetProperty("deletionLedgerHash").GetString() == ledgerHash);
        foreach (var field in new[] { "isolated", "restoreSucceeded", "dataCompared", "schemaAndPrivilegesCompared",
            "dependenciesCompatible", "deletionsReconciled", "clusterStopped", "localChecksumsVerified" })
            Require(proof.GetProperty(field).ValueKind == JsonValueKind.True);
        var deadline = point.AddHours(MaximumHours);
        var expired = now >= deadline;
        return new(point, deadline, now >= point.AddHours(WarningHours), expired ? "backup_expired" : null,
            now >= point.AddHours(WarningHours - 12));
    }

    private static string SourceKind(string project) => project == AdminContract.Project ? "authorized-hosted"
        : project.StartsWith("synthetic-", StringComparison.Ordinal) ? "synthetic" : throw new AdminException("backup_evidence");
}
