using System.Diagnostics;
using System.Text;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

internal sealed class NativePostgres(string bin, string workingDirectory)
{
    private static readonly string[] Tools = ["psql", "pg_dump", "pg_restore", "initdb", "pg_ctl", "pg_checksums", "postgres"];

    internal static bool Installed(string? path) => path is not null && Path.IsPathFullyQualified(path)
        && Tools.All(tool => File.Exists(Path.Combine(path, tool + ".exe")));

    internal async Task<string> CheckVersion()
    {
        BackupFiles.Require(Installed(bin), "backup_tools");
        string? version = null;
        foreach (var tool in Tools)
        {
            var output = await Run(tool, ["--version"]);
            var suffix = output[(output.LastIndexOf(' ') + 1)..];
            BackupFiles.Require(Version.TryParse(suffix, out var parsed) && parsed.Major == 17
                && (version is null || suffix == version), "backup_tools");
            version = suffix;
        }
        return $"pg_dump (PostgreSQL) {version}";
    }

    internal Task<string> Sql(Connection connection, string input) => Run("psql",
        [.. connection.Arguments, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-f", "-"], connection, input);

    internal async Task<string> Run(string tool, string[] args, Connection? connection = null, string? input = null)
    {
        var file = Path.Combine(bin, tool + ".exe");
        for (var current = file; current is not null; current = Path.GetDirectoryName(current))
            BackupFiles.Require((File.GetAttributes(current) & (FileAttributes.ReparsePoint | FileAttributes.Offline)) == 0, "backup_tools");
        // On Windows the postmaster can inherit redirected handles even
        // when pg_ctl writes its server log to a file. A pipe would remain
        // open after pg_ctl exits and prevent the application from proceeding.
        var daemonControl = tool == "pg_ctl" && args[0] is "start" or "stop";
        var start = new ProcessStartInfo(file) {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = workingDirectory,
            RedirectStandardInput = !daemonControl, RedirectStandardOutput = !daemonControl, RedirectStandardError = !daemonControl
        };
        if (!daemonControl)
        {
            start.StandardInputEncoding = new UTF8Encoding(false);
            start.StandardOutputEncoding = start.StandardErrorEncoding = Encoding.UTF8;
        }
        start.Environment.Clear();
        foreach (var name in new[] { "SYSTEMROOT", "WINDIR", "SYSTEMDRIVE", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "TEMP", "TMP" })
            start.Environment[name] = Environment.GetEnvironmentVariable(name);
        start.Environment["PATH"] = bin + ";" + Environment.SystemDirectory;
        start.Environment["COMSPEC"] = Path.Combine(Environment.SystemDirectory, "cmd.exe");
        start.Environment["PGCONNECT_TIMEOUT"] = "8";
        start.Environment["PGCLIENTENCODING"] = "UTF8";
        start.Environment["PGTZ"] = "UTC";
        start.Environment["PGAPPNAME"] = "Mon BPREA Admin backup";
        start.Environment["PGPASSFILE"] = Path.Combine(workingDirectory, "absent-pgpass");
        start.Environment["PGSERVICEFILE"] = Path.Combine(workingDirectory, "absent-pgservice");
        if (connection is not null)
        {
            start.Environment["PGPASSWORD"] = connection.Password;
            if (connection.Hosted)
                start.Environment["PGOPTIONS"] = "-c default_transaction_read_only=on -c statement_timeout=90s -c lock_timeout=5s";
        }
        foreach (var arg in args) start.ArgumentList.Add(arg);
        using var process = new Process { StartInfo = start };
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(180));
        try
        {
            if (!process.Start()) throw new AdminException("backup_tools");
            start.Environment.Remove("PGPASSWORD");
            if (daemonControl)
            {
                await process.WaitForExitAsync(timeout.Token);
                BackupFiles.Require(process.ExitCode == 0, "backup_restore");
                return "";
            }
            var output = process.StandardOutput.ReadToEndAsync(timeout.Token);
            var error = process.StandardError.ReadToEndAsync(timeout.Token);
            if (input is not null) await process.StandardInput.WriteAsync(input.AsMemory(), timeout.Token);
            process.StandardInput.Close();
            await process.WaitForExitAsync(timeout.Token);
            var diagnostics = await error;
            if (process.ExitCode != 0)
            {
                if (connection?.Hosted == true && tool == "psql")
                    throw new AdminException(diagnostics.Contains("password authentication failed", StringComparison.OrdinalIgnoreCase)
                        ? "backup_access" : "backup_source");
                throw new AdminException(connection?.Hosted == true ? "backup_capture" : "backup_restore");
            }
            // SQL errors are fatal (ON_ERROR_STOP/exit-on-error). Do not retain
            // native stderr, which can contain data, a path or connection details.
            return (await output).Trim();
        }
        catch (OperationCanceledException)
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync();
            throw new AdminException("backup_timeout");
        }
        finally { start.Environment.Remove("PGPASSWORD"); }
    }

    internal sealed class Connection(string[] arguments, string password, bool hosted = false)
    {
        internal string[] Arguments { get; } = [.. arguments, "--no-password"];
        internal string Password { get; } = password;
        internal bool Hosted { get; } = hosted;

        internal static Connection Production(string trustedCa, string password) => new(
            ["--dbname=postgresql://postgres@db." + AdminContract.Project + ".supabase.co:5432/postgres?sslmode=verify-full&sslrootcert="
                + Uri.EscapeDataString(trustedCa) + "&gssencmode=disable"], password, hosted: true);

        internal static Connection Local(int port, string database, string password) => new(
            ["--host=127.0.0.1", "--port=" + port, "--username=postgres", "--dbname=" + database], password);
    }
}
