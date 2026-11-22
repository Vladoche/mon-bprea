using System.Globalization;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

public sealed record BackupStatus(DateTimeOffset? Snapshot, DateTimeOffset? Deadline, bool Due, string? Problem,
    bool Approaching = false, bool PreviousPointQualified = false)
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
    internal const string Definitions = "source-definitions-before.json";
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
    internal sealed record BackupSchema(string[] Migrations, string[] Tables, string Hash);
    private const string ParcoursMigration = "20261121171000_create_parcours_preferences.sql";
    private const string AppearanceMigration = "20261120092557_appearance_custom_colors.sql";
    private static readonly string[] PreviousTables = Tables.Where(table => table != "parcours_preferences").ToArray();
    internal static readonly BackupSchema CurrentSchema = Describe(Migrations, Tables);
    internal static readonly BackupSchema PreviousSchema =
        Describe(Migrations.TakeWhile(name => name != ParcoursMigration).ToArray(), PreviousTables);
    internal static readonly BackupSchema AppearanceBaselineSchema =
        Describe(Migrations.TakeWhile(name => name != AppearanceMigration).ToArray(), PreviousTables);
    internal static readonly string SchemaHash = CurrentSchema.Hash;
    internal static readonly string SourceCommit = Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!
        .InformationalVersion.Split('+').Last();

    internal static string Resource(string name)
    {
        using var reader = new StreamReader(Assembly.GetManifestResourceStream("backup/" + name)!);
        return reader.ReadToEnd();
    }

    internal static string Hash(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    private static BackupSchema Describe(string[] migrations, string[] tables) => new(migrations, tables,
        Hash(JsonSerializer.Serialize(migrations.Select(name => new[] {
            name, Resource("migrations/" + name).Replace("\r\n", "\n", StringComparison.Ordinal)
        }), Json)));
    internal static string Digest(JsonElement value) => Hash(JsonSerializer.Serialize(value, Json));
    // The existing preopening verifier accepts UTC with zero or three
    // fractional digits. Offset timestamps emitted by .NET are not equivalent
    // on disk even when they represent the same instant.
    private const string MillisecondStamp = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";
    internal static string Stamp(DateTimeOffset value) => value.ToUniversalTime().ToString(MillisecondStamp, CultureInfo.InvariantCulture);
    private static DateTimeOffset ReadStamp(JsonElement value)
    {
        if (!DateTimeOffset.TryParseExact(value.GetString(), [MillisecondStamp, "yyyy-MM-dd'T'HH:mm:ss'Z'"],
            CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var stamp))
            throw new AdminException("backup_evidence");
        return stamp;
    }
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

    internal static void CheckToc(string toc, BackupSchema? schema = null)
    {
        var tables = (schema ?? CurrentSchema).Tables.Order(StringComparer.Ordinal);
        var entries = Regex.Matches(toc, @"^\d+; \d+ \d+ TABLE( DATA)? ([a-z_]+) ([a-z_]+) ", RegexOptions.Multiline);
        Require(entries.All(m => m.Groups[2].Value == "public")
            && entries.Where(m => !m.Groups[1].Success).Select(m => m.Groups[3].Value).Order(StringComparer.Ordinal).SequenceEqual(tables)
            && entries.Where(m => m.Groups[1].Success).Select(m => m.Groups[3].Value).Order(StringComparer.Ordinal).SequenceEqual(tables)
            && !Regex.IsMatch(toc, @"^\d+; \d+ \d+ .*\b(auth|storage|vault)\b", RegexOptions.Multiline));
    }

    private static readonly string[] LegacyFiles = [Dump, Toc];
    private static readonly string[] BoundFiles = [Dump, Toc, Catalogue, Privileges, Definitions, Ledger];

    internal static JsonElement Seal(string generation, DateTimeOffset start, DateTimeOffset completed, string toolVersion,
        string sourceCommit, string project = AdminContract.Project, BackupSchema? schema = null)
    {
        schema ??= CurrentSchema;
        CheckToc(Read(Path.Combine(generation, Toc)), schema);
        var body = JsonSerializer.SerializeToElement(new {
            version = 2, projectRef = project, sourceKind = SourceKind(project), snapshotStartedAt = Stamp(start),
            completedAt = Stamp(completed), sourceCommit, toolVersion, schemaHash = schema.Hash,
            method = "pg_dump-custom-single-snapshot", tables = schema.Tables, exclusions = Exclusions, authIncluded = false,
            files = BoundFiles.ToDictionary(name => name, name => Identify(Path.Combine(generation, name)))
        }, Json);
        Save(Path.Combine(generation, Manifest), body);
        return body;
    }

    internal static BackupStatus Verify(string generation, string ledgerHash, DateTimeOffset now,
        string project = AdminContract.Project, string proofName = Evidence, BackupSchema? expectedSchema = null)
        => Inspect(generation, ledgerHash, now, project, proofName, expectedSchema).Status;

    internal sealed record VerifiedGeneration(BackupStatus Status, BackupSchema Schema, bool BaselineBound);

    internal static VerifiedGeneration Inspect(string generation, string ledgerHash, DateTimeOffset now,
        string project = AdminContract.Project, string proofName = Evidence, BackupSchema? expectedSchema = null)
    {
        expectedSchema ??= CurrentSchema;
        VerifyStorage(generation, directory: true);
        var manifest = Parse(Read(Path.Combine(generation, Manifest)));
        var proof = Parse(Read(Path.Combine(generation, proofName)));
        var recordedSchemaHash = manifest.GetProperty("schemaHash").GetString();
        var schema = new[] { CurrentSchema, PreviousSchema, AppearanceBaselineSchema }
            .FirstOrDefault(candidate => candidate.Hash == recordedSchemaHash) ?? throw new AdminException("backup_evidence");
        var version = manifest.GetProperty("version").GetInt32();
        Require(version is 1 or 2 && manifest.GetProperty("projectRef").GetString() == project
            && manifest.GetProperty("sourceKind").GetString() == SourceKind(project)
            && Regex.IsMatch(manifest.GetProperty("sourceCommit").GetString()!, "^[a-f0-9]{40}$")
            && Regex.IsMatch(manifest.GetProperty("toolVersion").GetString()!, @"^pg_dump \(PostgreSQL\) 17\.\d+(?:\.\d+)?$")
            && manifest.GetProperty("method").GetString() == "pg_dump-custom-single-snapshot" && !manifest.GetProperty("authIncluded").GetBoolean()
            && Strings(manifest.GetProperty("tables")).Order(StringComparer.Ordinal).SequenceEqual(schema.Tables.Order(StringComparer.Ordinal))
            && Strings(manifest.GetProperty("exclusions")).Order(StringComparer.Ordinal).SequenceEqual(Exclusions.Order(StringComparer.Ordinal)));
        var point = ReadStamp(manifest.GetProperty("snapshotStartedAt"));
        var completed = ReadStamp(manifest.GetProperty("completedAt"));
        var tested = ReadStamp(proof.GetProperty("testedAt"));
        Require(point <= completed && completed <= tested && tested <= now);
        var files = manifest.GetProperty("files");
        CheckFiles(generation, files, version);
        CheckToc(Read(Path.Combine(generation, Toc)), schema);
        if (version == 2)
            Require(Digest(Parse(Read(Path.Combine(generation, Ledger)))) == ledgerHash, "backup_ledger");
        Require(proof.GetProperty("version").GetInt32() == 1 && proof.GetProperty("manifestHash").GetString() == Digest(manifest)
            && proof.GetProperty("projectRef").GetString() == project && proof.GetProperty("schemaHash").GetString() == recordedSchemaHash
            && proof.GetProperty("archiveHash").GetString() == files.GetProperty(Dump).GetProperty("sha256").GetString()
            && IsHash(ledgerHash) && proof.GetProperty("deletionLedgerHash").GetString() == ledgerHash);
        foreach (var field in new[] { "isolated", "restoreSucceeded", "dataCompared", "schemaAndPrivilegesCompared",
            "dependenciesCompatible", "deletionsReconciled", "clusterStopped", "localChecksumsVerified" })
            Require(proof.GetProperty(field).ValueKind == JsonValueKind.True);
        var deadline = point.AddHours(MaximumHours);
        if (schema.Hash != expectedSchema.Hash || version == 1)
            return new(new(point, deadline, false, "backup_drift",
                PreviousPointQualified: schema.Hash == PreviousSchema.Hash && version == 2 && now < deadline), schema, version == 2);
        var expired = now >= deadline;
        return new(new(point, deadline, now >= point.AddHours(WarningHours), expired ? "backup_expired" : null,
            now >= point.AddHours(WarningHours - 12)), schema, version == 2);
    }

    internal static void CheckFiles(string generation, JsonElement files, int version)
    {
        Require(version is 1 or 2);
        var names = version == 2 ? BoundFiles : LegacyFiles;
        Require(files.EnumerateObject().Count() == names.Length);
        foreach (var name in names)
        {
            var expected = files.GetProperty(name);
            var actual = Identify(Path.Combine(generation, name));
            Require(expected.GetProperty("bytes").GetInt64() == actual.bytes && expected.GetProperty("sha256").GetString() == actual.sha256);
        }
    }

    private static string SourceKind(string project) => project == AdminContract.Project ? "authorized-hosted"
        : project.StartsWith("synthetic-", StringComparison.Ordinal) ? "synthetic" : throw new AdminException("backup_evidence");
}
