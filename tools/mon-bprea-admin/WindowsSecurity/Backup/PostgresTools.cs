using System.IO.Compression;
using System.Security.Cryptography;
using MonBprea.Admin.Core;
using static MonBprea.Admin.WindowsSecurity.BackupFiles;

namespace MonBprea.Admin.WindowsSecurity;

internal static class PostgresTools
{
    // Official EDB ZIP and published sidecar, reviewed with this app build.
    private const string FileName = "postgresql-17.12-1-windows-x64-binaries.zip";
    private const string Sha256 = "a2cd8a774389347b70be7748ac4a37ef43cb6ee539c5fc3e85ae264b15e4a04c";
    private const string Url = "https://get.enterprisedb.com/postgresql/" + FileName;
    private const long MaximumArchive = 500L << 20;
    private const long MaximumExtracted = 1L << 30;
    private static string Home => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MonBPREAAdmin", "PostgreSQL");
    private static string VersionPath(string home) => Path.Combine(home, "17.12-1");
    internal static string InstalledBin => Path.Combine(VersionPath(Home), "bin");

    internal static async Task<string> PrepareAsync(string? existing)
    {
        if (NativePostgres.Installed(existing)) return existing!;
        if (Directory.Exists(Home)) WindowsPrivateStore.VerifyV2Directory(Home);
        else WindowsPrivateStore.CreateV2Directory(Home);
        var stage = Path.Combine(Home, "preparation-" + Guid.NewGuid().ToString("N"));
        WindowsPrivateStore.CreateV2Directory(stage);
        var archive = Path.Combine(stage, FileName);
        try
        {
            Require(new DriveInfo(Path.GetPathRoot(stage)!).AvailableFreeSpace > MaximumArchive + MaximumExtracted, "backup_space");
            using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(6));
            using var http = new HttpClient(new SocketsHttpHandler { AllowAutoRedirect = false, UseCookies = false });
            using var response = await http.GetAsync(Url, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            Require(response.IsSuccessStatusCode && response.Content.Headers.ContentLength is > 0 and <= MaximumArchive, "backup_tools");
            await using (var input = await response.Content.ReadAsStreamAsync(timeout.Token))
            await using (var output = WindowsPrivateStore.NewV2File(archive))
            {
                var buffer = new byte[65536];
                long total = 0;
                for (int count; (count = await input.ReadAsync(buffer, timeout.Token)) > 0;)
                {
                    total += count;
                    Require(total <= MaximumArchive, "backup_tools");
                    await output.WriteAsync(buffer.AsMemory(0, count), timeout.Token);
                }
                output.Flush(true);
            }
            return await InstallVerifiedAsync(archive, stage, VersionPath(Home));
        }
        catch (AdminException) { throw; }
        catch { throw new AdminException("backup_tools"); }
        finally { if (File.Exists(archive)) File.Delete(archive); }
    }

    internal static async Task<string> InstallVerifiedAsync(string archive, string stage, string destination)
    {
        WindowsPrivateStore.VerifyV2Directory(stage);
        var parent = Path.GetDirectoryName(Path.GetFullPath(destination))!;
        WindowsPrivateStore.VerifyV2Directory(parent);
        Require(parent.Equals(Path.GetDirectoryName(Path.GetFullPath(stage)), StringComparison.OrdinalIgnoreCase)
            && !Directory.Exists(destination) && !File.Exists(destination), "backup_tools");
        using (var stream = File.OpenRead(archive))
            Require(stream.Length <= MaximumArchive && Convert.ToHexStringLower(SHA256.HashData(stream)) == Sha256, "backup_tools");
        var root = Path.Combine(stage, "runtime");
        WindowsPrivateStore.CreateV2Directory(root);
        using var zip = ZipFile.OpenRead(archive);
        long size = 0;
        foreach (var item in zip.Entries)
        {
            var name = item.FullName.Replace('\\', '/');
            if (!(name.StartsWith("pgsql/bin/", StringComparison.Ordinal) || name.StartsWith("pgsql/lib/", StringComparison.Ordinal)
                || name.StartsWith("pgsql/share/", StringComparison.Ordinal)) || name.EndsWith('/')) continue;
            var parts = name.Split('/');
            Require(parts.All(p => p.Length > 0 && p is not ("." or "..") && !p.EndsWith('.') && !p.EndsWith(' ')
                && p.IndexOfAny(Path.GetInvalidFileNameChars()) < 0)
                && ((item.ExternalAttributes >> 16) & 0xF000) != 0xA000, "backup_tools");
            size = checked(size + item.Length);
            Require(size <= MaximumExtracted, "backup_tools");
            var target = Path.GetFullPath(Path.Combine(root, Path.Combine(parts[1..])));
            Require(target.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase), "backup_tools");
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            item.ExtractToFile(target, overwrite: false);
        }
        var bin = Path.Combine(root, "bin");
        var version = await new NativePostgres(bin, root).CheckVersion();
        Require(version == "pg_dump (PostgreSQL) 17.12", "backup_tools");
        Directory.Move(root, destination);
        return Path.Combine(destination, "bin");
    }
}
