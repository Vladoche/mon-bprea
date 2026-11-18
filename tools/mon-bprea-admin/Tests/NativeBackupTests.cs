using System.Security.Cryptography;
using System.Text.Json;
using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;
using static MonBprea.Admin.WindowsSecurity.BackupFiles;

internal static partial class Program
{
    // A real, synthetic PostgreSQL source and a different loopback restore.
    // Neither the production connector nor either Windows production credential is used.
    private static async Task<int> NativeBackup(string bin)
    {
        _stage = "native-backup-tools";
        var suffix = Guid.NewGuid().ToString("N");
        var project = "synthetic-" + suffix;
        var root = Path.Combine(Path.GetTempPath(), "mon-bprea-native-test-" + suffix);
        WindowsPrivateStore.CreateV2Directory(root);
        File.Encrypt(root);
        VerifyStorage(root, directory: true);
        if (Path.GetExtension(bin).Equals(".zip", StringComparison.OrdinalIgnoreCase))
        {
            var staging = Path.Combine(root, "tools-stage");
            WindowsPrivateStore.CreateV2Directory(staging);
            bin = await PostgresTools.InstallVerifiedAsync(Path.GetFullPath(bin), staging, Path.Combine(root, "tools"));
            Check("verified official archive prepared all native tools automatically", NativePostgres.Installed(bin));
        }
        var native = new NativePostgres(Path.GetFullPath(bin), root);
        var version = await native.CheckVersion();
        var cluster = Path.Combine(root, "source");
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var port = PostgresSnapshot.FreePort();
        var source = NativePostgres.Connection.Local(port, "postgres", password);
        var expected = new PostgresSnapshot.SourceIdentity("17", "i", "en-US", 0, [], []);
        var log = await PostgresSnapshot.InitializeCluster(native, root, cluster, Path.Combine(root, "source-password"), password, expected, port);
        string Generation(string name)
        {
            var path = Path.Combine(root, name);
            WindowsPrivateStore.CreateV2Directory(path);
            VerifyStorage(path, directory: true);
            return path;
        }
        try
        {
            _stage = "native-test-source";
            await native.Run("pg_ctl", ["start", "-D", cluster, "-l", log, "-w", "-t", "45"]);
            await native.Sql(source, """
                CREATE ROLE anon NOLOGIN;
                CREATE ROLE authenticated NOLOGIN;
                CREATE ROLE service_role NOLOGIN BYPASSRLS;
                CREATE ROLE supabase_admin NOLOGIN;
                CREATE SCHEMA auth;
                CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
                CREATE SCHEMA supabase_migrations;
                CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text NOT NULL);
                """);
            foreach (var migration in Migrations)
            {
                await native.Sql(source, Resource("migrations/" + migration));
                await native.Sql(source,
                    $"INSERT INTO supabase_migrations.schema_migrations VALUES ('{migration[..14]}','{migration[15..^4]}');");
            }
            await native.Sql(source, $"INSERT INTO auth.users(id,email) VALUES ('{RecoveryId}','fixture@example.test');");
            var identity = await PostgresSnapshot.Identify(native, source);
            var measurements = await PostgresSnapshot.Measure(native, source, data: true);
            Check("synthetic source has one linked profile and ten application tables",
                identity.AccountIds.Length == 1 && measurements.Rows.EnumerateObject().Count() == 10);
            PostgresSnapshot.ValidateSource(measurements, measurements.Catalogue, measurements.Privileges);
            var ledger = Hash("[]");
            _stage = "native-test-archive";
            var good = Generation("good");
            var (point, finished) = await PostgresSnapshot.Capture(native, source, good);
            var manifest = Seal(good, point, finished, version, SourceCommit, project);
            _stage = "native-test-restore";
            var status = await ProductionBackup.RestoreAndValidate(native, good, identity, measurements, manifest, ledger, () => { });
            Check("new archive restored and compared", status.Ready && File.Exists(Path.Combine(good, BackupFiles.Evidence)));
            Check("Windows reread valid proof and archive", Verify(good, ledger, DateTimeOffset.UtcNow, project).Ready);
            Check("at 144 h the point is due", Verify(good, ledger, point.AddHours(144), project) is { Ready: true, Due: true });
            Check("at 168 h invitation proof expires", Verify(good, ledger, point.AddHours(168), project) is { Ready: false, Problem: "backup_expired" });
            Check("changed deletion journal refuses an otherwise valid proof", !Valid(() => Verify(good, Hash("[{}]"), DateTimeOffset.UtcNow, project)));
            Check("synthetic project cannot satisfy PROD", !Valid(() => Verify(good, ledger, DateTimeOffset.UtcNow)));
            var goodHash = await File.ReadAllBytesAsync(Path.Combine(good, Dump));
            foreach (var failure in new[] { "corrupt", "source-data-drift", "current-journal-changed" })
            {
                _stage = "native-test-" + failure;
                var attempt = Generation(failure);
                var (start, completed) = await PostgresSnapshot.Capture(native, source, attempt);
                var pending = Seal(attempt, start, completed, version, SourceCommit, project);
                if (failure == "corrupt")
                    await File.WriteAllTextAsync(Path.Combine(attempt, Dump), "not-a-postgresql-archive");
                var before = failure == "source-data-drift" ? measurements with { Rows = Parse("{}") } : measurements;
                await Reject("restore must refuse " + failure,
                    failure == "corrupt" ? "backup_restore" : failure == "source-data-drift" ? "backup_comparison" : "backup_ledger",
                    () => ProductionBackup.RestoreAndValidate(native, attempt, identity, before, pending, ledger,
                        () => Require(failure != "current-journal-changed", "backup_ledger")));
                Check("failed restore leaves no eligible proof and retains prior generation " + failure,
                    !File.Exists(Path.Combine(attempt, BackupFiles.Evidence)) && Verify(good, ledger, DateTimeOffset.UtcNow, project).Ready
                    && (await File.ReadAllBytesAsync(Path.Combine(good, Dump))).SequenceEqual(goodHash));
            }
            var beforeProof = await File.ReadAllTextAsync(Path.Combine(good, BackupFiles.Evidence));
            await File.WriteAllTextAsync(Path.Combine(good, BackupFiles.Evidence), beforeProof.Replace(ledger, Hash("[1]"), StringComparison.Ordinal));
            Check("proof tampering blocks next read", !Valid(() => Verify(good, ledger, DateTimeOffset.UtcNow, project)));
        }
        finally
        {
            if (File.Exists(Path.Combine(cluster, "postmaster.pid")))
                await native.Run("pg_ctl", ["stop", "-D", cluster, "-w", "-m", "fast"]);
        }
        if (Path.GetDirectoryName(Path.GetFullPath(root)) != Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')
            || Directory.EnumerateFileSystemEntries(root, "*", SearchOption.AllDirectories).Any(x => File.GetAttributes(x).HasFlag(FileAttributes.ReparsePoint)))
            throw new InvalidOperationException();
        Directory.Delete(root, recursive: true);
        Console.WriteLine($"PASS {_passed} assertions against an isolated Windows PostgreSQL source and restore.");
        return 0;
    }
}
