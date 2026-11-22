using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
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
        var ledger = Hash("[]");
        string Generation(string name)
        {
            var path = Path.Combine(root, name);
            WindowsPrivateStore.CreateV2Directory(path);
            VerifyStorage(path, directory: true);
            return path;
        }
        async Task<(DateTimeOffset Point, JsonElement Manifest, BackupStatus Status)> Qualify(string path, BackupSchema schema,
            PostgresSnapshot.SourceIdentity identity, PostgresSnapshot.Measurements before)
        {
            ProductionBackup.SaveBaseline(path, before);
            var (start, completed) = await PostgresSnapshot.Capture(native, source, path, schema);
            PostgresSnapshot.CompareSource(before, await PostgresSnapshot.Measure(native, source, data: true, schema: schema));
            var manifest = Seal(path, start, completed, version, SourceCommit, project, schema);
            var status = await ProductionBackup.RestoreAndValidate(native, path, identity, before, manifest, ledger, () => { }, schema);
            return (start, manifest, status);
        }
        async Task Apply(string migration)
        {
            await native.Sql(source, Resource("migrations/" + migration));
            await native.Sql(source,
                $"INSERT INTO supabase_migrations.schema_migrations VALUES ('{migration[..14]}','{migration[15..^4]}');");
        }
        try
        {
            _stage = "native-test-trusted-ca";
            var certificates = Generation("certificates");
            var ca = Path.Combine(certificates, "supabase-root-2021.crt");
            var pem = Resource("supabase-root-2021.crt").Replace("\r\n", "\n", StringComparison.Ordinal);
            Write(ca, pem);
            Check("pinned certificate accepts LF", ProductionBackup.GetTrustedCertificate(certificates, create: false) == ca);
            await File.WriteAllTextAsync(ca, pem.Replace("\n", "\r\n", StringComparison.Ordinal));
            Check("pinned certificate accepts the same PEM with CRLF", ProductionBackup.GetTrustedCertificate(certificates, create: false) == ca);
            await File.WriteAllTextAsync(ca, pem.Replace("CERTIFICATE", "ALTERED", StringComparison.Ordinal));
            await Reject("altered certificate stays blocked", "backup_source",
                () => Task.Run(() => ProductionBackup.GetTrustedCertificate(certificates, create: false)));
            _stage = "native-test-source";
            await native.Run("pg_ctl", ["start", "-D", cluster, "-l", log, "-w", "-t", "45"]);
            await native.Sql(source, """
                CREATE ROLE anon NOLOGIN;
                CREATE ROLE authenticated NOLOGIN;
                CREATE ROLE service_role NOLOGIN BYPASSRLS;
                CREATE ROLE supabase_admin NOLOGIN;
                CREATE SCHEMA auth;
                CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
                  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
                CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
                CREATE SCHEMA supabase_migrations;
                CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text NOT NULL);
                """);
            string[] expectedMigrations = [
                "20261022000100_profiles.sql", "20261024083417_create_drill_sync_schema.sql",
                "20261025143831_create_personal_data_backend.sql", "20261106093143_restrict_application_service_role.sql",
                "20261106174551_return_conflict_for_personal_revision.sql", "20261120092557_appearance_custom_colors.sql",
                "20261121171000_create_parcours_preferences.sql"
            ];
            Check("release embeds the exact migrations", Migrations.SequenceEqual(expectedMigrations));
            foreach (var migration in AppearanceBaselineSchema.Migrations)
                await Apply(migration);
            await native.Sql(source, $"INSERT INTO auth.users(id,email) VALUES ('{RecoveryId}','fixture@example.test');");
            var identity = await PostgresSnapshot.Identify(native, source);
            Check("synthetic Auth inventory and profiles have the same expected identity",
                identity.AccountIds.SequenceEqual([RecoveryId]) && identity.ProfileIds.SequenceEqual([RecoveryId]));
            _stage = "native-test-historical";
            var historical = Generation("historical-schema");
            var historicalMeasurements = await PostgresSnapshot.Measure(native, source, data: true, schema: AppearanceBaselineSchema);
            var historicalQualification = await Qualify(historical, AppearanceBaselineSchema, identity, historicalMeasurements);
            Check("known historical point is available but does not protect the upcoming migration",
                historicalQualification.Status.Ready && Verify(historical, ledger, DateTimeOffset.UtcNow, project)
                    is { Ready: false, Problem: "backup_drift", PreviousPointQualified: false });

            _stage = "native-test-pre-migration";
            await Apply(expectedMigrations[^2]);
            var beforeUpgrade = await PostgresSnapshot.Measure(native, source, data: true, schema: PreviousSchema);
            var previous = Generation("previous-schema");
            await ProductionBackup.CheckRenewalBaseline(native, previous, historical, identity, beforeUpgrade, PreviousSchema, AppearanceBaselineSchema);
            var previousQualification = await Qualify(previous, PreviousSchema, identity, beforeUpgrade);
            Check("real six-migration backup restores with its own contract",
                previousQualification.Status.Ready && Verify(previous, ledger, DateTimeOffset.UtcNow, project, expectedSchema: PreviousSchema).Ready);
            Check("six-migration manifest lists exactly the pre-migration tables",
                Strings(previousQualification.Manifest.GetProperty("tables")).Order(StringComparer.Ordinal)
                    .SequenceEqual(PreviousSchema.Tables.Order(StringComparer.Ordinal)));
            Check("old renewal prerequisite returns drift for this qualified predecessor",
                Verify(previous, ledger, DateTimeOffset.UtcNow, project)
                    is { Ready: false, Due: false, Problem: "backup_drift", PreviousPointQualified: true });
            Check("historical proof remains subject to current deletion journal",
                !Valid(() => Verify(previous, Hash("[{}]"), DateTimeOffset.UtcNow, project)));
            var preservedEvidence = Read(Path.Combine(previous, BackupFiles.Evidence));

            _stage = "native-test-migration";
            await Apply(expectedMigrations[^1]);
            await native.Sql(source, $$"""
                SET request.jwt.claim.sub = '{{RecoveryId}}';
                INSERT INTO public.parcours_preferences(user_id, preferences, operation_id, base_revision)
                VALUES ('{{RecoveryId}}', '{"version":1,"uc1":"exempt","units":["uc2"],"ucare":[],"exams":[],"assignments":{} }',
                  '6b8e33aa-d0f0-4939-9fdf-52092888ee03', 0);
                """);
            var measurements = await PostgresSnapshot.Measure(native, source, data: true);
            string[] expectedTables = [
                "appearance_preferences", "botanical_answers", "botanical_sessions", "course_states",
                "drill_answers", "drill_series", "drill_training_attempts", "itk_settings",
                "parcours_preferences", "profiles", "quiz_attempts"
            ];
            Check("row digests cover the exact release table set",
                measurements.Rows.EnumerateObject().Select(x => x.Name).Order(StringComparer.Ordinal).SequenceEqual(expectedTables));
            Check("restoration will compare nonempty Parcours preferences",
                measurements.Rows.GetProperty("parcours_preferences").GetProperty("count").GetInt32() == 1);
            var catalogueTables = measurements.Catalogue.GetProperty("tables");
            Check("catalogue comparison is independent of the object array order",
                PostgresSnapshot.Same(catalogueTables, JsonSerializer.SerializeToElement(catalogueTables.EnumerateArray().Reverse())));
            await Reject("legacy source validation cannot cross the previous catalogue", "backup_drift",
                () => Task.Run(() => PostgresSnapshot.ValidateSource(measurements, beforeUpgrade.Catalogue, beforeUpgrade.Privileges)));
            await Reject("different qualified catalogue blocks renewal", "backup_drift", () => Task.Run(() =>
                PostgresSnapshot.ValidateSource(measurements, JsonSerializer.SerializeToElement(new { }), measurements.Privileges)));
            await Reject("different qualified privileges block renewal", "backup_drift", () => Task.Run(() =>
                PostgresSnapshot.ValidateSource(measurements, measurements.Catalogue, JsonSerializer.SerializeToElement(new { }))));
            _stage = "native-test-requalification";
            var good = Generation("good");
            await ProductionBackup.CheckRenewalBaseline(native, good, previous, identity, measurements, CurrentSchema, PreviousSchema);
            var (point, manifest, status) = await Qualify(good, CurrentSchema, identity, measurements);
            Check("new archive restored and compared", status.Ready && File.Exists(Path.Combine(good, BackupFiles.Evidence)));
            Check("new manifest lists the exact release table set",
                Strings(manifest.GetProperty("tables")).Order(StringComparer.Ordinal).SequenceEqual(expectedTables));
            Check("six-migration proof preserved through activation of the new generation",
                Read(Path.Combine(previous, BackupFiles.Evidence)) == preservedEvidence);
            Check("expired backup cannot serve as the pre-migration recovery point",
                Verify(previous, ledger, previousQualification.Point.AddHours(168), project) is { PreviousPointQualified: false });
            await ProductionBackup.CheckRenewalBaseline(native, good, good, identity, measurements, CurrentSchema, CurrentSchema);
            var proof = Parse(Read(Path.Combine(good, BackupFiles.Evidence)));
            Check("manifest and proof timestamps match the Node UTC millisecond contract",
                new[] { manifest.GetProperty("snapshotStartedAt"), manifest.GetProperty("completedAt"), proof.GetProperty("testedAt") }
                .All(x => System.Text.RegularExpressions.Regex.IsMatch(x.GetString()!, @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")));
            Check("Windows reread valid proof and archive", Verify(good, ledger, DateTimeOffset.UtcNow, project).Ready);
            Check("at 144 h the point is due", Verify(good, ledger, point.AddHours(144), project) is { Ready: true, Due: true });
            Check("at 168 h invitation proof expires", Verify(good, ledger, point.AddHours(168), project) is { Ready: false, Problem: "backup_expired" });
            Check("changed deletion journal refuses an otherwise valid proof", !Valid(() => Verify(good, Hash("[{}]"), DateTimeOffset.UtcNow, project)));
            Check("synthetic project cannot satisfy PROD", !Valid(() => Verify(good, ledger, DateTimeOffset.UtcNow)));
            _stage = "native-test-source-drift";
            await RejectSourceDrift(native, source, identity, previous, good, Generation);
            var goodHash = await File.ReadAllBytesAsync(Path.Combine(good, Dump));
            foreach (var (failure, code) in new[] {
                ("corrupt", "backup_evidence"), ("restore-failed", "backup_restore"),
                ("source-data-drift", "backup_comparison"), ("current-journal-changed", "backup_ledger"), ("interrupted", "")
            })
            {
                _stage = "native-test-" + failure;
                var attempt = Generation(failure);
                ProductionBackup.SaveBaseline(attempt, measurements);
                var (start, completed) = await PostgresSnapshot.Capture(native, source, attempt);
                // A valid fingerprint of an invalid native archive still requires a real restore test.
                if (failure == "restore-failed")
                    await File.WriteAllTextAsync(Path.Combine(attempt, Dump), "not-a-postgresql-archive");
                var pending = Seal(attempt, start, completed, version, SourceCommit, project);
                if (failure == "corrupt")
                    await File.WriteAllTextAsync(Path.Combine(attempt, Dump), "not-a-postgresql-archive");
                var before = failure == "source-data-drift" ? measurements with { Rows = Parse("{}") } : measurements;
                if (failure == "interrupted")
                {
                    const string pendingEvidence = "restore-evidence.pending";
                    var otherProof = JsonNode.Parse(proof.GetRawText())!.AsObject();
                    otherProof["testedAt"] = Stamp(DateTimeOffset.UtcNow);
                    Save(Path.Combine(attempt, pendingEvidence), otherProof);
                    Check("interrupted qualification has no final evidence even with a staged receipt",
                        !File.Exists(Path.Combine(attempt, BackupFiles.Evidence)));
                    Check("receipt from a different generation with the same schema is rejected",
                        !Valid(() => Verify(attempt, ledger, DateTimeOffset.UtcNow, project, proofName: pendingEvidence)));
                }
                else
                    await Reject("restore must refuse " + failure, code,
                        () => ProductionBackup.RestoreAndValidate(native, attempt, identity, before, pending, ledger,
                            () => Require(failure != "current-journal-changed", "backup_ledger")));
                Check("failed restore leaves no eligible proof and retains prior generation " + failure,
                    !File.Exists(Path.Combine(attempt, BackupFiles.Evidence)) && Verify(good, ledger, DateTimeOffset.UtcNow, project).Ready
                    && (await File.ReadAllBytesAsync(Path.Combine(good, Dump))).SequenceEqual(goodHash));
            }
            var beforeProof = await File.ReadAllTextAsync(Path.Combine(good, BackupFiles.Evidence));
            await File.WriteAllTextAsync(Path.Combine(good, BackupFiles.Evidence), beforeProof.Replace(ledger, Hash("[1]"), StringComparison.Ordinal));
            Check("proof tampering blocks next read", !Valid(() => Verify(good, ledger, DateTimeOffset.UtcNow, project)));
            await File.WriteAllTextAsync(Path.Combine(good, BackupFiles.Evidence), beforeProof);
            var beforeManifest = await File.ReadAllTextAsync(Path.Combine(good, Manifest));
            await File.WriteAllTextAsync(Path.Combine(good, Manifest), beforeManifest.Replace(SourceCommit, new string('0', 40), StringComparison.Ordinal));
            Check("manifest with an altered release commit is rejected", !Valid(() => Verify(good, ledger, DateTimeOffset.UtcNow, project)));
            await File.WriteAllTextAsync(Path.Combine(good, Manifest), beforeManifest);
            await File.AppendAllTextAsync(Path.Combine(good, Definitions), " ");
            Check("baseline definitions are bound to the archive manifest", !Valid(() => Verify(good, ledger, DateTimeOffset.UtcNow, project)));
            CheckLegacyProof(previous, previousQualification.Manifest, preservedEvidence, ledger, project);
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

    private static void CheckLegacyProof(string path, JsonElement actualManifest, string evidence, string ledger, string project)
    {
        var manifest = JsonNode.Parse(actualManifest.GetRawText())!.AsObject();
        manifest["version"] = 1;
        foreach (var entry in new[] { Catalogue, Privileges, Definitions, Ledger })
            manifest["files"]!.AsObject().Remove(entry);
        var proof = JsonNode.Parse(evidence)!.AsObject();
        proof["manifestHash"] = Digest(Parse(manifest.ToJsonString()));
        var manifestPath = Path.Combine(path, Manifest);
        var evidencePath = Path.Combine(path, BackupFiles.Evidence);
        var originalManifest = Read(manifestPath);
        try
        {
            File.WriteAllText(manifestPath, manifest.ToJsonString());
            File.WriteAllText(evidencePath, proof.ToJsonString());
            var legacy = Inspect(path, ledger, DateTimeOffset.UtcNow, project);
            Check("known version-one archive is readable and retained as historical evidence",
                legacy.Schema.Hash == PreviousSchema.Hash && !legacy.BaselineBound
                && legacy.Status is { Ready: false, Problem: "backup_drift", PreviousPointQualified: false });
            manifest["schemaHash"] = Hash("unknown historical schema");
            proof["schemaHash"] = manifest["schemaHash"]!.GetValue<string>();
            proof["manifestHash"] = Digest(Parse(manifest.ToJsonString()));
            File.WriteAllText(manifestPath, manifest.ToJsonString());
            File.WriteAllText(evidencePath, proof.ToJsonString());
            Check("matching fabricated fingerprints cannot introduce an unknown historical scope",
                !Valid(() => Verify(path, ledger, DateTimeOffset.UtcNow, project)));
        }
        finally
        {
            File.WriteAllText(manifestPath, originalManifest);
            File.WriteAllText(evidencePath, evidence);
        }
    }

    private static async Task RejectSourceDrift(NativePostgres native, NativePostgres.Connection source,
        PostgresSnapshot.SourceIdentity identity, string previous, string good, Func<string, string> generation)
    {
        var sqlFunction = await native.Sql(source, """
            SELECT pg_get_functiondef('bprea_private.valid_parcours(jsonb)'::regprocedure);
            """);
        (string Name, string Change, string Restore)[] cases = [
            ("missing-migration",
                "DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261121171000';",
                "INSERT INTO supabase_migrations.schema_migrations VALUES ('20261121171000', 'create_parcours_preferences');"),
            ("unknown-migration",
                "INSERT INTO supabase_migrations.schema_migrations VALUES ('20261123000000', 'unknown');",
                "DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261123000000';"),
            ("column-grant",
                "GRANT UPDATE (updated_at) ON public.parcours_preferences TO authenticated;",
                "REVOKE UPDATE (updated_at) ON public.parcours_preferences FROM authenticated;"),
            ("rls-policy",
                "ALTER POLICY parcours_select_own ON public.parcours_preferences USING (false);",
                "ALTER POLICY parcours_select_own ON public.parcours_preferences USING (user_id = (select auth.uid()));"),
            ("missing-column",
                "ALTER TABLE public.parcours_preferences RENAME COLUMN updated_at TO other_name;",
                "ALTER TABLE public.parcours_preferences RENAME COLUMN other_name TO updated_at;"),
            ("wrong-function", """
                CREATE OR REPLACE FUNCTION bprea_private.valid_parcours(p jsonb) RETURNS boolean
                LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$ SELECT true $$;
                """, sqlFunction + ";"),
            ("disabled-trigger",
                "ALTER TABLE public.parcours_preferences DISABLE TRIGGER parcours_preferences_guard;",
                "ALTER TABLE public.parcours_preferences ENABLE TRIGGER parcours_preferences_guard;")
        ];
        foreach (var (name, change, restore) in cases)
        {
            _stage = "native-test-drift-" + name;
            var candidate = generation(name);
            await native.Sql(source, change);
            try
            {
                var current = await PostgresSnapshot.Measure(native, source, data: true);
                await Reject("authorized migration does not accept " + name, "backup_drift",
                    () => ProductionBackup.CheckRenewalBaseline(native, candidate, previous, identity, current, CurrentSchema, PreviousSchema));
                await Reject("qualified current baseline rejects " + name, "backup_drift",
                    () => ProductionBackup.CheckRenewalBaseline(native, candidate, good, identity, current, CurrentSchema, CurrentSchema));
                Check("rejected source produced no archive for " + name, !File.Exists(Path.Combine(candidate, Dump)));
            }
            finally { await native.Sql(source, restore); }
            await ProductionBackup.CheckRenewalBaseline(native, candidate, good, identity,
                await PostgresSnapshot.Measure(native, source, data: false), CurrentSchema, CurrentSchema);
        }
        _stage = "native-test-drift-auth";
        await native.Sql(source, """
            ALTER TABLE auth.users DISABLE TRIGGER bprea_auth_user_created;
            INSERT INTO auth.users(id,email) VALUES ('ef340142-a6f3-4a5d-9f9e-b0aa489050f7','unmatched@example.test');
            """);
        try
        {
            await Reject("unmatched local Auth identity blocks source qualification", "backup_source",
                () => PostgresSnapshot.Identify(native, source));
        }
        finally
        {
            await native.Sql(source, """
                DELETE FROM auth.users WHERE id = 'ef340142-a6f3-4a5d-9f9e-b0aa489050f7';
                ALTER TABLE auth.users ENABLE TRIGGER bprea_auth_user_created;
                """);
        }
    }
}
