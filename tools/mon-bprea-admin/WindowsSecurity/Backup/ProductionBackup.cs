using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using MonBprea.Admin.Core;
using static MonBprea.Admin.WindowsSecurity.BackupFiles;

namespace MonBprea.Admin.WindowsSecurity;

public sealed class ProductionBackup(AutomaticPrivateStore history)
{
    private const string RegistryPath = @"Software\MonBPREAAdmin";
    private readonly AdminCredentialVault vault = AdminCredentialVault.ForPostgres();
    private sealed record Configuration(string Root, string? LegacyLedger, string? Tools);
    private sealed record Generation(string Path, VerifiedGeneration Verification)
    {
        internal BackupStatus Status => Verification.Status;
        internal BackupSchema Schema => Verification.Schema;
    }

    public BackupStatus AttachConfiguration()
    {
        try
        {
            using var lease = history.AcquireInspection();
            if (history.HasUncertainOperation()) throw new AdminException("pending");
            var config = Configure();
            var latest = Latest(config, ReadLedger(config));
            if (latest is null) return new(null, null, true, "backup_evidence");
            if (latest.Status.Problem == "backup_drift") return latest.Status;
            using var registry = Registry.CurrentUser.OpenSubKey(RegistryPath);
            if (registry?.GetValue("BackupConfiguration") is null) SaveConfiguration(config);
            return latest.Status;
        }
        catch (AdminException error) { return new(null, null, true, error.Code); }
        catch { return new(null, null, true, "backup_storage"); }
    }

    private static void SaveConfiguration(Configuration configuration)
    {
        using var registry = Registry.CurrentUser.CreateSubKey(RegistryPath);
        registry.SetValue("BackupConfiguration", JsonSerializer.Serialize(configuration, Json), RegistryValueKind.String);
    }

    private static Configuration Configure()
    {
        using var registry = Registry.CurrentUser.OpenSubKey(RegistryPath);
        var repo = WindowsPrivateStore.ApplicationRepository();
        var installed = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PostgreSQL", "17", "bin");
        var previousTools = repo is null ? null : Path.Combine(repo, ".tmp", "lot653b-native", "postgresql-17.11", "pgsql", "bin");
        var tools = new[] { PostgresTools.InstalledBin, installed, previousTools }.FirstOrDefault(NativePostgres.Installed);
        if (registry?.GetValue("BackupConfiguration") is string saved)
        {
            var config = JsonSerializer.Deserialize<Configuration>(saved) ?? throw new AdminException("backup_storage");
            return config with { Tools = NativePostgres.Installed(config.Tools) ? config.Tools : tools };
        }
        Require(repo is not null, "backup_storage");
        var old = Path.Combine(repo!, ".tmp", "preopening-operator");
        var context = ReadLegacy(Path.Combine(old, "backup-context.json"));
        Require(context.GetProperty("projectRef").GetString() == AdminContract.Project, "backup_storage");
        var generation = context.GetProperty("backupDirectory").GetString();
        Require(generation is not null && Path.IsPathFullyQualified(generation), "backup_storage");
        return new(Path.GetDirectoryName(generation!)!, Path.Combine(old, Ledger), tools);
    }

    private string ReadLedger(Configuration config)
    {
        VerifyStorage(config.Root, directory: true);
        var primary = Path.Combine(config.Root, Ledger);
        var adminLedger = Path.Combine(history.DirectoryPath, Ledger);
        var current = config.LegacyLedger is string legacy ? ReadLegacy(legacy)
            : Parse(Read(primary));
        Require(current.ValueKind == JsonValueKind.Array && current.GetArrayLength() == 0, "backup_ledger");
        // PROD delete is blocked. Any tombstone or disagreement requires a
        // separate reconciliation before a restore can be declared eligible.
        var hash = Digest(current);
        if (File.Exists(primary)) Require(Digest(Parse(Read(primary))) == hash, "backup_ledger");
        if (File.Exists(adminLedger))
        {
            WindowsPrivateStore.VerifyProtectedFile(adminLedger);
            Require(new FileInfo(adminLedger).Length <= 1_000_000 && Digest(Parse(File.ReadAllText(adminLedger))) == hash, "backup_ledger");
        }
        return hash;
    }

    private static IEnumerable<string> Generations(Configuration config) => Directory.EnumerateDirectories(config.Root)
        .Where(p => Regex.IsMatch(Path.GetFileName(p), @"^applicative-\d{8}T\d{6}Z-[a-f0-9]{32}$"));

    private static Generation? Latest(Configuration config, string ledger, BackupSchema? expectedSchema = null)
    {
        expectedSchema ??= CurrentSchema;
        var now = DateTimeOffset.UtcNow;
        return Generations(config).Select(path => {
            try { return new Generation(path, Inspect(path, ledger, now, expectedSchema: expectedSchema)); }
            catch (Exception e) when (e is AdminException or IOException or UnauthorizedAccessException or JsonException
                or InvalidOperationException or KeyNotFoundException or FormatException) { return null; }
        }).OfType<Generation>().OrderBy(x => x.Schema.Hash != expectedSchema.Hash)
            .ThenByDescending(x => x.Verification.BaselineBound)
            .ThenByDescending(x => x.Status.Snapshot).FirstOrDefault();
    }

    public async Task<BackupStatus> RenewAsync(AccountInventory inventory, string? suppliedPassword, bool automatic)
    {
        // Shared with both old executors and the app. An interrupted backup
        // cannot race another extraction on the next launch.
        using var lease = history.AcquireLock();
        if (history.HasUncertainOperation()) throw new AdminException("pending");
        history.VerifyOperator(inventory);
        var config = Configure();
        var ledger = ReadLedger(config);
        var latest = Latest(config, ledger) ?? throw new AdminException("backup_evidence");
        if (automatic && !latest.Status.Due) return latest.Status;
        Require(inventory.Accounts.All(a => !a.RecoveryRestricted && (a.ConfirmedAt.HasValue || a.InvitedAt.HasValue)), "lookup");
        Require(!Generations(config).Any(path => new[] { "restoration", "contract" }
            .Any(stage => File.Exists(Path.Combine(path, stage, "cluster", "postmaster.pid")))), "backup_isolation");
        var password = suppliedPassword ?? vault.Read() ?? throw new AdminException("backup_access");
        Require(!string.IsNullOrWhiteSpace(password) && password.Length <= 266 && !password.Any(char.IsControl)
            && !password.StartsWith("sb_secret_", StringComparison.Ordinal), "backup_access");
        var tools = await PostgresTools.PrepareAsync(config.Tools);
        config = config with { Tools = tools };
        var native = new NativePostgres(tools, config.Root);
        var version = await native.CheckVersion();
        var now = DateTimeOffset.UtcNow;
        var directory = Path.Combine(config.Root, $"applicative-{now:yyyyMMdd'T'HHmmss'Z'}-{Guid.NewGuid():N}");
        WindowsPrivateStore.CreateV2Directory(directory);
        VerifyStorage(directory, directory: true);
        try
        {
            var certificate = GetTrustedCertificate(config.Root, create: true);
            var source = NativePostgres.Connection.Production(certificate, password);
            var identity = await PostgresSnapshot.Identify(native, source);
            MatchInventory(inventory, identity);
            Require(new DriveInfo(Path.GetPathRoot(directory)!).AvailableFreeSpace >= checked((1L << 30) + 5 * identity.TableBytes), "backup_space");
            var metadata = await PostgresSnapshot.Measure(native, source, data: false);
            var migrations = PostgresSnapshot.ReadMigrationNames(metadata);
            var schema = CurrentSchema;
            if (!migrations.SequenceEqual(CurrentSchema.Migrations))
            {
                Require(!automatic && latest.Schema.Hash != CurrentSchema.Hash
                    && migrations.SequenceEqual(PreviousSchema.Migrations), "backup_drift");
                schema = PreviousSchema;
                latest = Latest(config, ledger, schema) ?? throw new AdminException("backup_evidence");
            }
            Require(!automatic || latest.Schema.Hash == schema.Hash, "backup_drift");
            await CheckRenewalBaseline(native, directory, latest.Path, identity, metadata, schema, latest.Schema, hosted: true);
            var before = await PostgresSnapshot.Measure(native, source, data: true, schema: schema);
            PostgresSnapshot.CompareSource(metadata, before);
            SaveBaseline(directory, before);
            var (start, completed) = await PostgresSnapshot.Capture(native, source, directory, schema: schema);
            PostgresSnapshot.CompareSource(before, await PostgresSnapshot.Measure(native, source, data: true, schema: schema));
            MatchInventory(inventory, await PostgresSnapshot.Identify(native, source));
            var manifest = Seal(directory, start, completed, version, SourceCommit, schema: schema);
            var result = await RestoreAndValidate(native, directory, identity, before, manifest, ledger, () => {
                Require(ledger == ReadLedger(config), "backup_ledger");
                var tested = DateTimeOffset.UtcNow;
                Save(Path.Combine(directory, "renewal.json"), new {
                    previousSnapshot = latest.Status.Snapshot, previousDeadline = latest.Status.Deadline, snapshotStartedAt = start, completedAt = completed,
                    rpoGapFrom = latest.Status.Deadline <= tested ? latest.Status.Deadline : null,
                    rpoGapUntil = latest.Status.Deadline <= tested ? tested : (DateTimeOffset?)null,
                    testedAt = tested, nextDeadline = start.AddHours(MaximumHours), reviewAt = start.AddDays(14)
                });
                var primary = Path.Combine(config.Root, Ledger);
                if (!File.Exists(primary)) Save(primary, Array.Empty<object>());
                if (suppliedPassword is not null)
                {
                    vault.Save(suppliedPassword);
                    Require(vault.Read() == suppliedPassword, "credential");
                }
                SaveConfiguration(config);
            }, schema: schema);
            return schema.Hash == CurrentSchema.Hash ? result
                : result with { Problem = "backup_drift", Due = false, PreviousPointQualified = true };
        }
        catch (Exception error)
        {
            var code = error is AdminException e ? e.Code : "backup_evidence";
            Save(Path.Combine(directory, "failure.json"), new { at = DateTimeOffset.UtcNow, code });
            throw new AdminException(code);
        }
    }

    internal static async Task<BackupStatus> RestoreAndValidate(NativePostgres native, string directory,
        PostgresSnapshot.SourceIdentity identity, PostgresSnapshot.Measurements before, JsonElement manifest,
        string ledger, Action verifyCurrentLedger, BackupSchema? schema = null)
    {
        schema ??= CurrentSchema;
        var project = manifest.GetProperty("projectRef").GetString()!;
        Require(manifest.GetProperty("schemaHash").GetString() == schema.Hash
            && Digest(Parse(Read(Path.Combine(directory, Manifest)))) == Digest(manifest));
        CheckFiles(directory, manifest.GetProperty("files"), manifest.GetProperty("version").GetInt32());
        await PostgresSnapshot.Restore(native, directory, identity, before, schema: schema);
        verifyCurrentLedger();
        var archived = manifest.GetProperty("files").GetProperty(Dump).GetProperty("sha256").GetString();
        var receipt = new {
            version = 1, manifestHash = Digest(manifest), archiveHash = archived, projectRef = project,
            schemaHash = schema.Hash, testedAt = Stamp(DateTimeOffset.UtcNow), isolated = true, restoreSucceeded = true, dataCompared = true,
            schemaAndPrivilegesCompared = true, dependenciesCompatible = true, deletionLedgerHash = ledger,
            deletionsReconciled = true, scope = "application-sql-only-with-minimal-local-auth-dependencies",
            detailsDirectory = "restoration", clusterStopped = true, localChecksumsVerified = true
        };
        // A stopped/restored but otherwise invalid generation stays invisible to
        // invitation verification. Publish the eligible proof in one rename.
        const string pendingName = "restore-evidence.pending";
        var pending = Path.Combine(directory, pendingName);
        Save(pending, receipt);
        var result = Verify(directory, ledger, DateTimeOffset.UtcNow, project, pendingName, schema);
        Require(result.Ready, "backup_expired");
        File.Move(pending, Path.Combine(directory, Evidence));
        return result;
    }

    public bool IsOperatorPresent(AccountInventory inventory) => history.IsOperatorPresent(inventory);

    public async Task RequireReadyAsync(AccountInventory inventory)
    {
        try
        {
            history.VerifyOperator(inventory);
            var config = Configure();
            var ledger = ReadLedger(config);
            var latest = Latest(config, ledger) ?? throw new AdminException("backup_evidence");
            if (!latest.Status.Ready) throw new AdminException(latest.Status.Problem!);
            var password = vault.Read() ?? throw new AdminException("backup_access");
            var native = new NativePostgres(config.Tools ?? throw new AdminException("backup_tools"), config.Root);
            // Do not trust a replacement certificate near an existing backup.
            var certificate = GetTrustedCertificate(config.Root, create: false);
            var source = NativePostgres.Connection.Production(certificate, password);
            MatchInventory(inventory, await PostgresSnapshot.Identify(native, source));
            CheckBaseline(latest.Path, await PostgresSnapshot.Measure(native, source, data: false), CurrentSchema);
            Require(ledger == ReadLedger(config) && latest.Status.Deadline > DateTimeOffset.UtcNow, "backup_expired");
            Require(DateTimeOffset.UtcNow - inventory.ObservedAt < AdminContract.MaximumInventoryAge, "stale");
        }
        catch (AdminException) { throw; }
        catch { throw new AdminException("backup_evidence"); }
    }

    internal static string GetTrustedCertificate(string root, bool create)
    {
        var certificate = Path.Combine(root, "supabase-root-2021.crt");
        var pinned = Resource("supabase-root-2021.crt");
        if (create && !File.Exists(certificate)) Write(certificate, pinned);
        static string CanonicalPem(string text) => text.Replace("\r\n", "\n", StringComparison.Ordinal).Trim();
        Require(File.Exists(certificate) && CanonicalPem(Read(certificate)) == CanonicalPem(pinned), "backup_source");
        return certificate;
    }

    internal static Task CheckRenewalBaseline(NativePostgres native, string directory, string previousGeneration,
        PostgresSnapshot.SourceIdentity identity, PostgresSnapshot.Measurements current, BackupSchema schema,
        BackupSchema previousSchema, bool hosted = false)
    {
        PostgresSnapshot.ValidateVersions(current, schema);
        var version = Parse(Read(Path.Combine(previousGeneration, Manifest))).GetProperty("version").GetInt32();
        if (schema.Hash == previousSchema.Hash && version == 2)
        {
            CheckBaseline(previousGeneration, current, schema);
            return Task.CompletedTask;
        }
        Require(schema.Hash == previousSchema.Hash || (previousSchema.Migrations.Length < schema.Migrations.Length
            && previousSchema.Migrations.SequenceEqual(schema.Migrations.Take(previousSchema.Migrations.Length))), "backup_drift");
        return PostgresSnapshot.ValidateContract(native, directory, identity, current, schema, hosted);
    }

    private static JsonElement SourceDefinitions(PostgresSnapshot.Measurements value) =>
        JsonSerializer.SerializeToElement(new { value.Schemas, value.Routines, value.Security }, Json);

    internal static void SaveBaseline(string generation, PostgresSnapshot.Measurements value)
    {
        Save(Path.Combine(generation, Catalogue), value.Catalogue);
        Save(Path.Combine(generation, Privileges), value.Privileges);
        Save(Path.Combine(generation, Definitions), SourceDefinitions(value));
        Save(Path.Combine(generation, Ledger), Array.Empty<object>());
    }

    private static void CheckBaseline(string generation, PostgresSnapshot.Measurements current, BackupSchema schema)
    {
        PostgresSnapshot.ValidateSource(current, Parse(Read(Path.Combine(generation, Catalogue))),
            Parse(Read(Path.Combine(generation, Privileges))), schema);
        Require(PostgresSnapshot.Same(SourceDefinitions(current), Parse(Read(Path.Combine(generation, Definitions)))), "backup_drift");
    }

    internal static void MatchInventory(AccountInventory auth, PostgresSnapshot.SourceIdentity sql)
    {
        Require(auth.Accounts.Select(account => account.Id.ToLowerInvariant()).Order(StringComparer.Ordinal)
            .SequenceEqual(sql.AccountIds), "backup_inventory");
    }
}
