using System.Security.Cryptography;
using System.Text.Json;
using static MonBprea.Admin.WindowsSecurity.BackupFiles;

namespace MonBprea.Admin.WindowsSecurity;

internal static partial class PostgresSnapshot
{
    // Supabase's qualified platform permissions for this project. The model
    // must not take ACLs or executable code from the server being validated.
    private const string HostedDefaults = """
        GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
          GRANT ALL ON TABLES TO postgres, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
          GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres, supabase_admin IN SCHEMA public
          GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres, supabase_admin IN SCHEMA public
          GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
        """;

    private const string ContractSecuritySql = """
        select jsonb_build_object(
          'application', jsonb_build_object(
            'types', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', t.typname, 'kind', t.typtype,
                'owner', pg_get_userbyid(t.typowner), 'acl', t.typacl))
              from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('public','bprea_private')),
            'relations', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,
                'persistence',c.relpersistence,'owner',pg_get_userbyid(c.relowner),'is_partition',c.relispartition,
                'options',c.reloptions,'replica_identity',c.relreplident))
              from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','bprea_private')),
            'attributes', (select jsonb_agg(jsonb_build_object('table',c.relname,'attribute',a.attname,
                'identity',a.attidentity,'collation',a.attcollation::regcollation::text))
              from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace='public'::regnamespace
                and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped)),
          'external_triggers', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
              'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true)))
            from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
            join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and n.nspname not in ('public','bprea_private')
              and p.pronamespace in ('public'::regnamespace,'bprea_private'::regnamespace)),
          'api_roles', (select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'inherit',rolinherit,
              'bypassrls',rolbypassrls,'superuser',rolsuper,'replication',rolreplication,'createdb',rolcreatedb,'createrole',rolcreaterole))
            from pg_roles where rolname in ('anon','authenticated','service_role','authenticator')),
          'api_memberships', coalesce((select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,
              'grantor',pg_get_userbyid(a.grantor),'inherit',a.inherit_option,'set',a.set_option,'admin',a.admin_option))
            from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member
            where r.rolname in ('anon','authenticated','service_role','authenticator')
               or m.rolname in ('anon','authenticated','service_role','authenticator')), '[]'::jsonb),
          'auth_contract', (select jsonb_build_object('id_type',format_type(a.atttypid,a.atttypmod),'id_not_null',a.attnotnull,
              'key',pg_get_constraintdef(k.oid), 'usage',has_schema_privilege('authenticated','auth','USAGE'),
              'uid_execute',has_function_privilege('authenticated',to_regprocedure('auth.uid()'),'EXECUTE'),
              'role_execute',has_function_privilege('authenticated',to_regprocedure('auth.role()'),'EXECUTE'))
            from pg_attribute a join pg_constraint k on a.attrelid=k.conrelid and k.contype='p'
            where a.attrelid='auth.users'::regclass and a.attname='id' and not a.attisdropped),
          'auth_functions', (select jsonb_agg(jsonb_build_object('name',p.proname,'owner',pg_get_userbyid(p.proowner),
              'acl',p.proacl,'hash',encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),chr(13),''),'UTF8')),'hex')))
            from pg_proc p where p.pronamespace='auth'::regnamespace and p.proname in ('uid','role')
              and p.pronargs=0 and p.prokind='f'),
          'managed_routine', (select jsonb_build_object('owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
              'hash',encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),chr(13),''),'UTF8')),'hex'))
            from pg_proc p where p.oid=to_regprocedure('public.rls_auto_enable()') and p.prokind='f'),
          'managed_trigger', (select jsonb_build_object('owner',pg_get_userbyid(e.evtowner),'event',e.evtevent,
              'enabled',e.evtenabled,'tags',e.evttags,'function',e.evtfoid=to_regprocedure('public.rls_auto_enable()'))
            from pg_event_trigger e where e.evtname='ensure_rls'),
          'scoped_extensions', (select jsonb_agg(e.extname) from pg_extension e where e.extnamespace in
            ('public'::regnamespace,'bprea_private'::regnamespace)));
        """;

    private static readonly JsonElement HostedApiRoles = JsonSerializer.SerializeToElement(
        new[] { "anon", "authenticated", "service_role", "authenticator" }.Select(name => new {
            name, login = name == "authenticator", inherit = name != "authenticator", bypassrls = name == "service_role",
            superuser = false, replication = false, createdb = false, createrole = false
        }));

    private static readonly JsonElement HostedMemberships = JsonSerializer.SerializeToElement(
        (from role in new[] { "anon", "authenticated", "service_role" }
         from member in new[] { "authenticator", "postgres", "supabase_realtime_admin" }
         select new { role, member, grantor = "supabase_admin", inherit = member == "postgres", set = true, admin = member == "postgres" })
        .Concat(new[] {
            new { role = "authenticator", member = "postgres", grantor = "supabase_admin", inherit = true, set = true, admin = true },
            new { role = "authenticator", member = "supabase_storage_admin", grantor = "supabase_admin", inherit = false, set = true, admin = false }
        }));

    internal static void ValidateHostedProfile(Measurements current)
    {
        var security = current.Security;
        const string authOwner = "supabase_auth_admin";
        string[] authAcl = ["=X/supabase_auth_admin", "supabase_auth_admin=X/supabase_auth_admin", "dashboard_user=X/supabase_auth_admin"];
        var identityFunctions = JsonSerializer.SerializeToElement(new[] {
            new { name = "uid", owner = authOwner, acl = authAcl, hash = "7c1ff2ecbe653c9358b3115a2607db9573f88a2944ae4eca9e296a89cc5186a7" },
            new { name = "role", owner = authOwner, acl = authAcl, hash = "c96a9358b02089b03f3962fd85c5f83c9d64f32240481915c0efe74398dc761b" }
        });
        var managedRoutine = JsonSerializer.SerializeToElement(new {
            owner = "postgres", acl = new[] { "=X/postgres", "postgres=X/postgres", "anon=X/postgres", "authenticated=X/postgres", "service_role=X/postgres" },
            hash = "b21d88816c445d14cef5032c3cd4abaebc1db2001fcb3435022ab6b496182ca4"
        });
        Require(Same(security.GetProperty("api_roles"), HostedApiRoles)
            && Same(security.GetProperty("api_memberships"), HostedMemberships)
            && Same(security.GetProperty("auth_contract"), Parse("""
                {"id_type":"uuid","id_not_null":true,"key":"PRIMARY KEY (id)","usage":true,"uid_execute":true,"role_execute":true}
                """))
            && Same(security.GetProperty("auth_functions"), identityFunctions)
            && Same(security.GetProperty("managed_routine"), managedRoutine)
            && Same(security.GetProperty("managed_trigger"), Parse("""
                {"owner":"postgres","event":"ddl_command_end","enabled":"O","tags":["CREATE TABLE","CREATE TABLE AS","SELECT INTO"],"function":true}
                """))
            && security.GetProperty("scoped_extensions").ValueKind == JsonValueKind.Null, "backup_drift");
    }

    internal static async Task ReplayMigrations(NativePostgres native, NativePostgres.Connection target, BackupSchema schema)
    {
        Require(!target.Hosted, "backup_isolation");
        foreach (var migration in schema.Migrations)
        {
            await native.Sql(target, Resource("migrations/" + migration));
            await native.Sql(target, $"INSERT INTO supabase_migrations.schema_migrations VALUES ('{migration[..14]}','{migration[15..^4]}');");
        }
    }

    internal static async Task ValidateContract(NativePostgres native, string workspace, SourceIdentity identity,
        Measurements current, BackupSchema schema, bool hosted = false)
    {
        ValidateVersions(current, schema);
        var tables = current.Catalogue.GetProperty("tables");
        Require(tables.ValueKind == JsonValueKind.Array && tables.EnumerateArray().Select(row => row.GetProperty("name").GetString())
            .Order(StringComparer.Ordinal).SequenceEqual(schema.Tables.Order(StringComparer.Ordinal)), "backup_drift");
        if (hosted) ValidateHostedProfile(current);

        var directory = Path.GetFullPath(Path.Combine(workspace, "contract"));
        Require(Path.GetDirectoryName(directory) == Path.GetFullPath(workspace).TrimEnd(Path.DirectorySeparatorChar)
            && !Directory.Exists(directory), "backup_isolation");
        WindowsPrivateStore.CreateV2Directory(directory);
        VerifyStorage(directory, directory: true);
        var cluster = Path.Combine(directory, "cluster");
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var port = FreePort();
        var target = NativePostgres.Connection.Local(port, "postgres", password);
        var boot = await InitializeCluster(native, directory, cluster, Path.Combine(directory, "initdb-password"), password, identity, port);
        Measurements reference;
        try
        {
            await native.Run("pg_ctl", ["start", "-D", cluster, "-l", boot, "-w", "-t", "45"]);
            await RequireIsolated(native, target, cluster, port);
            await native.Sql(target, DatabaseRoles + AuthStub);
            if (hosted) await native.Sql(target, HostedDefaults);
            await ReplayMigrations(native, target, schema);
            reference = await Measure(native, target, data: false, schema);
        }
        finally
        {
            if (File.Exists(Path.Combine(cluster, "postmaster.pid")))
                await native.Run("pg_ctl", ["stop", "-D", cluster, "-w", "-t", "45", "-m", "fast"]);
        }
        Require(!File.Exists(Path.Combine(cluster, "postmaster.pid")), "backup_isolation");
        // The reference contains only a replay of repository SQL. Keep a small
        // account-free result and retire the stopped, freshly created cluster.
        Require(!Directory.EnumerateFileSystemEntries(directory, "*", SearchOption.AllDirectories)
            .Any(path => File.GetAttributes(path).HasFlag(FileAttributes.ReparsePoint)), "backup_isolation");
        Directory.Delete(directory, recursive: true);

        var comparisons = new Dictionary<string, bool> {
            ["catalogue"] = Same(ContractCatalogue(current.Catalogue, hosted), ContractCatalogue(reference.Catalogue, false)),
            ["privileges"] = Same(Project(current.Privileges, "extensions"), Project(reference.Privileges, "extensions")),
            ["schemas"] = Same(current.Schemas, reference.Schemas),
            ["routineDefinitions"] = Same(ContractRoutines(current.Routines, hosted), reference.Routines),
            ["application"] = Same(current.Security.GetProperty("application"), reference.Security.GetProperty("application")),
            ["externalTriggers"] = Same(current.Security.GetProperty("external_triggers"), reference.Security.GetProperty("external_triggers")),
            ["apiPrivileges"] = hosted || (Same(current.Security.GetProperty("api_roles"), reference.Security.GetProperty("api_roles"))
                && Same(current.Security.GetProperty("api_memberships"), reference.Security.GetProperty("api_memberships")))
        };
        Save(Path.Combine(workspace, "contract-comparison.json"), new { schema = schema.Hash, migrations = schema.Migrations, comparisons });
        Require(comparisons.Values.All(result => result), "backup_drift");
    }

    private static JsonElement Project(JsonElement value, params string[] excluded) => JsonSerializer.SerializeToElement(
        value.EnumerateObject().Where(p => !excluded.Contains(p.Name)).ToDictionary(p => p.Name, p => p.Value));

    private static JsonElement ContractCatalogue(JsonElement catalogue, bool hosted)
    {
        if (!hosted) return catalogue;
        var projected = catalogue.EnumerateObject().ToDictionary(property => property.Name, property => property.Value);
        projected["routine_inventory"] = ContractRoutines(projected["routine_inventory"], true);
        return JsonSerializer.SerializeToElement(projected);
    }

    private static JsonElement ContractRoutines(JsonElement routines, bool hosted) => hosted
        ? JsonSerializer.SerializeToElement(routines.EnumerateArray().Where(row => row.GetProperty("schema").GetString() != "public"
            || row.GetProperty("name").GetString() != "rls_auto_enable" || row.GetProperty("arguments").GetString() != ""))
        : routines;
}
