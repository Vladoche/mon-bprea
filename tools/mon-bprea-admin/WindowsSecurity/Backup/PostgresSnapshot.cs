using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using MonBprea.Admin.Core;
using static MonBprea.Admin.WindowsSecurity.BackupFiles;

namespace MonBprea.Admin.WindowsSecurity;

internal static class PostgresSnapshot
{
    private static readonly string[] SchemaFlags = ["--schema=public", "--schema=bprea_private", "--strict-names",
        "--no-large-objects", "--no-publications", "--no-subscriptions", "--no-security-labels", "--quote-all-identifiers"];
    private static readonly string CatalogueSql = AuditSelect("catalogue.sql");
    private static readonly string PrivilegesSql = AuditSelect("privileges.sql");
    private const string EffectiveSchemas = """
        select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),
          'acl',coalesce(nspacl,acldefault('n',nspowner)))) from pg_namespace where nspname in ('public','bprea_private');
        """;
    private const string RoutineDefinitions = """
        select coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_functiondef(p.oid),
          pg_get_userbyid(p.proowner),coalesce(p.proacl,acldefault('f',p.proowner)))),'[]') from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','bprea_private') and p.prokind in ('f','p','w');
        """;
    private static readonly string SummarySql = "select jsonb_build_object(" + string.Join(",",
        Tables.Select(t => $"'{t}',(select jsonb_build_object('count',count(*),'digest',encode(sha256(convert_to("
            + $"coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate \"C\"),'[]'::jsonb)::text,'UTF8')),'hex')) from public.{t} t)")) + ");";

    internal sealed record Measurements(JsonElement Catalogue, JsonElement Privileges, JsonElement Schemas, JsonElement Routines, JsonElement Rows);
    internal sealed record SourceIdentity(string Version, string LocaleProvider, string Locale, long TableBytes, string[] AccountIds, string[] ProfileIds);

    private static string AuditSelect(string resource) => Resource(resource)
        .Split("begin transaction read only;", StringSplitOptions.None)[1].Split("rollback;", StringSplitOptions.None)[0];

    private static string ReadOnly(string sql) =>
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL TIME ZONE 'UTC'; SET LOCAL statement_timeout='90s'; SET LOCAL lock_timeout='5s';\n"
        + sql + "\nROLLBACK;";

    private static async Task<JsonElement[]> ReadJson(NativePostgres native, NativePostgres.Connection connection, string sql, int count)
    {
        var raw = await native.Sql(connection, ReadOnly(sql));
        var rows = raw.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        Require(rows.Length == count, "backup_source");
        return rows.Select(Parse).ToArray();
    }

    internal static async Task<SourceIdentity> Identify(NativePostgres native, NativePostgres.Connection connection)
    {
        var value = (await ReadJson(native, connection, """
            select jsonb_build_object('database',current_database(),'role',current_user,'sessionRole',session_user,
              'version',current_setting('server_version'),'defaultReadOnly',current_setting('default_transaction_read_only'),
              'readOnly',current_setting('transaction_read_only'),'ssl',(select ssl from pg_stat_ssl where pid=pg_backend_pid()),
              'port',inet_server_port(),'provider',d.datlocprovider,
              'locale',coalesce(to_jsonb(d)->>'datlocale',to_jsonb(d)->>'daticulocale',d.datcollate),
              'bytes',(select coalesce(sum(pg_total_relation_size(c.oid)),0) from pg_class c
                where c.relnamespace='public'::regnamespace and c.relkind='r'),
              'accounts',(select coalesce(jsonb_agg(id::text order by id::text),'[]') from auth.users),
              'profiles',(select coalesce(jsonb_agg(id::text order by id::text),'[]') from public.profiles))
            from pg_database d where datname=current_database();
            """, 1))[0];
        var version = value.GetProperty("version").GetString()!;
        var ids = Strings(value.GetProperty("accounts"));
        var profiles = Strings(value.GetProperty("profiles"));
        Require(value.GetProperty("readOnly").GetString() == "on"
            && value.GetProperty("role").GetString() == "postgres" && value.GetProperty("sessionRole").GetString() == "postgres"
            && Regex.IsMatch(version, @"^17\.\d+$") && ids.All(ClosureContract.Uuid)
            && ids.SequenceEqual(profiles), "backup_source");
        if (connection.Hosted)
            Require(value.GetProperty("defaultReadOnly").GetString() == "on" && value.GetProperty("ssl").GetBoolean()
                && value.GetProperty("database").GetString() == "postgres" && value.GetProperty("port").GetInt32() == 5432, "backup_source");
        return new(version, value.GetProperty("provider").GetString()!, value.GetProperty("locale").GetString()!,
            value.GetProperty("bytes").GetInt64(), ids, profiles);
    }

    internal static async Task<Measurements> Measure(NativePostgres native, NativePostgres.Connection connection, bool data)
    {
        var values = await ReadJson(native, connection, CatalogueSql + PrivilegesSql + EffectiveSchemas + RoutineDefinitions
            + (data ? SummarySql : ""), data ? 5 : 4);
        return new(values[0], values[1], values[2], values[3], data ? values[4] : default);
    }

    // Catalogue queries return set-valued arrays with no stable OID ordering.
    // Compare their contents, while preserving every element and property.
    private static string Canonical(JsonElement value) => value.ValueKind switch {
        JsonValueKind.Object => "{" + string.Join(",", value.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal)
            .Select(p => JsonSerializer.Serialize(p.Name, Json) + ":" + Canonical(p.Value))) + "}",
        JsonValueKind.Array => "[" + string.Join(",", value.EnumerateArray().Select(Canonical).Order(StringComparer.Ordinal)) + "]",
        JsonValueKind.String => JsonSerializer.Serialize(value.GetString()!.Replace("\r\n", "\n", StringComparison.Ordinal), Json),
        _ => value.GetRawText()
    };
    internal static bool Same(JsonElement a, JsonElement b) => Canonical(a) == Canonical(b);

    internal static void ValidateSource(Measurements value, JsonElement baseline, JsonElement grants)
    {
        var versions = value.Catalogue.GetProperty("migrations").EnumerateArray()
            .Select(x => x.GetProperty("version").GetString() + "_" + x.GetProperty("name").GetString() + ".sql");
        Require(versions.SequenceEqual(Migrations) && Same(value.Catalogue, baseline) && Same(value.Privileges, grants), "backup_drift");
    }

    internal static void CompareSource(Measurements before, Measurements after)
    {
        Require(Same(before.Catalogue, after.Catalogue) && Same(before.Privileges, after.Privileges)
            && Same(before.Schemas, after.Schemas) && Same(before.Routines, after.Routines) && Same(before.Rows, after.Rows), "backup_changed");
    }

    internal static async Task<(DateTimeOffset Start, DateTimeOffset Completed)> Capture(NativePostgres native,
        NativePostgres.Connection source, string directory)
    {
        var dump = Path.Combine(directory, Dump);
        Write(dump, "");
        var started = DateTimeOffset.UtcNow;
        await native.Run("pg_dump", [.. source.Arguments, "--format=custom", .. SchemaFlags,
            "--lock-wait-timeout=5s", "--file", dump], source);
        var completed = DateTimeOffset.UtcNow;
        using (var input = File.OpenRead(dump))
        {
            byte[] header = new byte[5];
            Require(input.Read(header) == 5 && header.AsSpan().SequenceEqual("PGDMP"u8), "backup_capture");
        }
        var toc = await native.Run("pg_restore", ["--list", dump]);
        CheckToc(toc);
        Write(Path.Combine(directory, Toc), toc + "\n");
        return (started, completed);
    }

    internal static async Task Restore(NativePostgres native, string directory, SourceIdentity identity, Measurements before)
    {
        var restore = Path.Combine(directory, "restoration");
        WindowsPrivateStore.CreateV2Directory(restore);
        VerifyStorage(restore, directory: true);
        var cluster = Path.Combine(restore, "cluster");
        var passwordFile = Path.Combine(restore, "initdb-password");
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var port = FreePort();
        var setup = NativePostgres.Connection.Local(port, "postgres", password);
        var destination = NativePostgres.Connection.Local(port, "bprea_restore", password);
        var boot = await InitializeCluster(native, restore, cluster, passwordFile, password, identity, port);
        try
        {
            await native.Run("pg_ctl", ["start", "-D", cluster, "-l", boot, "-w", "-t", "45"]);
            var target = (await ReadJson(native, setup, """
                select jsonb_build_object('host',host(inet_server_addr()),'port',inet_server_port(),
                  'directory',current_setting('data_directory'),'listen',current_setting('listen_addresses'));
                """, 1))[0];
            Require(target.GetProperty("host").GetString() == "127.0.0.1"
                && target.GetProperty("port").GetInt32() == port && target.GetProperty("listen").GetString() == "127.0.0.1"
                && string.Equals(Path.GetFullPath(target.GetProperty("directory").GetString()!), cluster, StringComparison.OrdinalIgnoreCase), "backup_isolation");
            await native.Sql(setup, """
                CREATE ROLE anon NOLOGIN;
                CREATE ROLE authenticated NOLOGIN;
                CREATE ROLE service_role NOLOGIN BYPASSRLS;
                CREATE ROLE supabase_admin NOLOGIN;
                CREATE DATABASE bprea_restore;
                """);
            await native.Sql(destination, """
                CREATE SCHEMA auth;
                CREATE TABLE auth.users(id uuid PRIMARY KEY);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
                CREATE SCHEMA supabase_migrations;
                CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text NOT NULL);
                """);
            var toc = Read(Path.Combine(directory, Toc));
            var restoreToc = Regex.Replace(toc, @"^\d+; \d+ \d+ SCHEMA - public .*$", ";$0", RegexOptions.Multiline);
            Require(restoreToc != toc, "backup_restore");
            var useList = Path.Combine(restore, "restore-toc.txt");
            Write(useList, restoreToc);
            string[] args = [.. destination.Arguments, "--exit-on-error", "--single-transaction", "--use-list", useList];
            var archive = Path.Combine(directory, Dump);
            await native.Run("pg_restore", [.. args, "--section=pre-data", archive], destination);
            await native.Run("pg_restore", [.. args, "--section=data", archive], destination);
            await native.Sql(destination, "INSERT INTO auth.users(id) " + string.Join(" UNION ",
                Tables.Select(t => $"SELECT {(t == "profiles" ? "id" : "user_id")} FROM public.{t}")) + ";");
            var restored = await Identify(native, destination);
            Require(restored.AccountIds.SequenceEqual(identity.AccountIds) && restored.ProfileIds.SequenceEqual(identity.ProfileIds)
                && restored.LocaleProvider == identity.LocaleProvider && restored.Locale == identity.Locale, "backup_dependencies");
            await native.Run("pg_restore", [.. args, "--section=post-data", archive], destination);
            var after = await Measure(native, destination, data: true);
            CompareRestored(before, after);
            Save(Path.Combine(restore, "comparison-result.json"), new {
                tables = Tables.Length, sourceData = before.Rows, restoredData = after.Rows,
                beforeCatalogue = Hash(Canonical(before.Catalogue)), restoredCatalogue = Hash(Canonical(after.Catalogue)),
                schemaAndPrivilegesCompared = true, roots = restored.AccountIds.Length, authStubOnly = true
            });
        }
        finally
        {
            // A failed start can still leave a postmaster. Only this fresh
            // cluster is ever passed to pg_ctl.
            if (File.Exists(Path.Combine(cluster, "postmaster.pid")))
                await native.Run("pg_ctl", ["stop", "-D", cluster, "-w", "-t", "45", "-m", "fast"]);
        }
        Require(!File.Exists(Path.Combine(cluster, "postmaster.pid")), "backup_isolation");
        await native.Run("pg_checksums", ["--check", "-D", cluster]);
        foreach (var path in Directory.EnumerateFileSystemEntries(restore, "*", SearchOption.AllDirectories))
            VerifyStorage(path, Directory.Exists(path));
    }

    internal static async Task<string> InitializeCluster(NativePostgres native, string restore, string cluster,
        string passwordFile, string password, SourceIdentity identity, int port)
    {
        Require(identity is { LocaleProvider: "i", Locale: "en-US" } or { LocaleProvider: "c", Locale: "C" }, "backup_dependencies");
        Write(passwordFile, password + "\n");
        try
        {
            var locale = identity.LocaleProvider == "i" ? new[] { "--locale-provider=icu", "--icu-locale=en-US" } : [];
            await native.Run("initdb", ["--pgdata", cluster, "--username=postgres", "--auth=scram-sha-256",
                "--encoding=UTF8", "--locale=C", .. locale, "--data-checksums", "--pwfile=" + passwordFile, "--no-instructions"]);
        }
        finally { File.Delete(passwordFile); }
        VerifyStorage(cluster, directory: true);
        var config = Path.Combine(cluster, "postgresql.conf");
        VerifyStorage(config, directory: false);
        File.AppendAllText(config, $"\nlisten_addresses='127.0.0.1'\nport={port}\nssl=off\nlog_statement='none'\n"
            + "log_min_error_statement=panic\nlogging_collector=off\n");
        var hba = Path.Combine(cluster, "pg_hba.conf");
        VerifyStorage(hba, directory: false);
        File.WriteAllText(hba, "host all all 127.0.0.1/32 scram-sha-256\n");
        var log = Path.Combine(restore, "postgres.private.log");
        Write(log, "");
        return log;
    }

    private static void CompareRestored(Measurements before, Measurements after)
    {
        static JsonElement Project(JsonElement value, params string[] excluded) => JsonSerializer.SerializeToElement(
            value.EnumerateObject().Where(p => !excluded.Contains(p.Name)).ToDictionary(p => p.Name, p => p.Value));
        static IEnumerable<JsonElement> Triggers(JsonElement value) => value.GetProperty("triggers").ValueKind == JsonValueKind.Null ? []
            : value.GetProperty("triggers").EnumerateArray().Where(x => x.GetProperty("schema").GetString() != "auth");
        Require(Same(Project(before.Catalogue, "schemas", "migrations", "triggers"), Project(after.Catalogue, "schemas", "migrations", "triggers"))
            && Same(JsonSerializer.SerializeToElement(Triggers(before.Catalogue)), JsonSerializer.SerializeToElement(Triggers(after.Catalogue)))
            && Same(Project(before.Privileges, "extensions"), Project(after.Privileges, "extensions"))
            && Same(before.Schemas, after.Schemas) && Same(before.Routines, after.Routines) && Same(before.Rows, after.Rows), "backup_comparison");
    }

    internal static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try { return ((IPEndPoint)listener.LocalEndpoint).Port; }
        finally { listener.Stop(); }
    }
}
