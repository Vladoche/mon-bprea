using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.Tests;

public static class StoreTests
{
    private const string Email = "synthetic-participant@example.invalid";
    private const string Token = "SYNTHETIC_TEST_TOKEN_NO_PRODUCTION_0123456789";
    private static readonly HumanAttestations Human = new(true, true, true);

    public static async Task RunAsync(Action<string, bool> check)
    {
        if (!OperatingSystem.IsWindows()) { check("Windows private store requires Windows", false); return; }
        var now = new DateTimeOffset(2026, 11, 12, 10, 0, 0, TimeSpan.Zero);
        var temporaryRoot = Path.Combine(Path.GetTempPath(), "mon-bprea-admin-store-tests-" + Guid.NewGuid().ToString("N"));
        CreateProtectedDirectory(temporaryRoot);
        var configPath = Path.Combine(temporaryRoot, "operator.json");
        WriteConfig(configPath, now);
        WindowsPrivateStore Store(string name)
        {
            var path = Path.Combine(temporaryRoot, name);
            CreateProtectedDirectory(path);
            return new WindowsPrivateStore(path, configPath, clock: () => now);
        }
        async Task Refuses(string name, Func<Task> action, string? code = null)
        {
            try { await action(); check(name, false); }
            catch (AdminException error) { check(name, code is null || error.Code == code); }
            catch { check(name, false); }
        }
        try
        {
            foreach (var path in new[] { "relative", @"\\server\share\private", @"C:\private:stream", @"C:\private\..\target", @"C:\" })
                await Refuses("unsafe storage path refused", () => new WindowsPrivateStore(path, configPath).ValidateAsync(), "private");

            var good = Store("good");
            await good.ValidateAsync();
            check("private EFS write probe and existing operator preflight", true);
            check("empty store has no uncertain operation", !await good.HasUncertainOperationAsync());
            await Refuses("reservation requires exclusive lock", () => good.ReserveAsync(Email, Human), "busy");

            Guid operation;
            using (await good.AcquireLockAsync())
            {
                await Refuses("double-click lock on same instance", () => good.AcquireLockAsync(), "busy");
                var other = new WindowsPrivateStore(good.DirectoryPath, configPath, clock: () => now);
                await Refuses("lock excludes another instance and Node create-exclusive", () => other.AcquireLockAsync(), "busy");
                await Refuses("missing human attestation never reserves", () => good.ReserveAsync(Email, new(false, true, true)), "attestations");
                operation = await good.ReserveAsync(Email, Human);
                check("reservation persisted before possible POST", await other.HasTargetReservationAsync(Email) && await other.HasUncertainOperationAsync());
                await Refuses("second reservation same target blocked", () => good.ReserveAsync(Email, Human), "pending");
                await Refuses("uncertain operation blocks another target", () => good.ReserveAsync("other@example.invalid", Human), "pending");
                var reservation = Directory.GetFiles(good.DirectoryPath, "reservation-*.json").Single();
                var recordText = File.ReadAllText(reservation);
                var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(AdminContract.Project + "\0" + Email)));
                check("Node-compatible reservation hash and minimal no-address journal", Path.GetFileName(reservation) == $"reservation-{hash}.json"
                    && !recordText.Contains(Email, StringComparison.Ordinal) && !recordText.Contains(Token, StringComparison.Ordinal)
                    && !recordText.Contains("sb_secret_", StringComparison.Ordinal));
                await Refuses("link with wrong callback refused", () => good.DeliverAsync(Email, operation, "https://example.invalid/?token_hash=" + Token), "private");
                await Refuses("link with final newline refused", () => good.DeliverAsync(Email, operation,
                    AdminContract.Callback + "?token_hash=" + Token + "&type=invite\n"), "private");
                check("invalid link leaves durable reservation uncertain", await good.HasUncertainOperationAsync());
                await good.DeliverAsync(Email, operation, AdminContract.Callback + "?token_hash=" + Token + "&type=invite");
                var linkPath = Path.Combine(good.DirectoryPath, $"auth-link-{operation:D}.txt");
                check("link encrypted under current Windows user", File.GetAttributes(linkPath).HasFlag(FileAttributes.Encrypted)
                    && File.ReadAllText(linkPath) == AdminContract.Callback + "?token_hash=" + Token + "&type=invite\n");
                check("local file delivery resolved independently from participant handoff", !await good.HasUncertainOperationAsync()
                    && !File.ReadAllText(reservation).Contains("handedOverAt", StringComparison.Ordinal));
                await Refuses("delivered invitation cannot be overwritten or generated again", () => good.DeliverAsync(Email, operation,
                    AdminContract.Callback + "?token_hash=" + Token + "&type=invite"), "private");
            }
            check("normal completion removes only its own lock", !File.Exists(Path.Combine(good.DirectoryPath, "operation.lock")));
            await good.MarkHandedOverAsync(operation);
            check("manual participant handoff persisted separately", File.ReadAllText(Directory.GetFiles(good.DirectoryPath, "reservation-*.json").Single())
                .Contains("handedOverAt", StringComparison.Ordinal));
            await Refuses("handoff cannot silently replace a previous timestamp", () => good.MarkHandedOverAsync(operation), "private");
            using (await good.AcquireLockAsync())
                await Refuses("persistent target reservation blocks fresh operation after restart", () => good.ReserveAsync(Email, Human), "pending");

            var crashed = Store("crashed");
            using (await crashed.AcquireLockAsync()) await crashed.ReserveAsync("crash@example.invalid", Human);
            var restarted = new WindowsPrivateStore(crashed.DirectoryPath, configPath, clock: () => now);
            check("crash after reservation survives restart", await restarted.HasUncertainOperationAsync());
            var staleLock = Path.Combine(crashed.DirectoryPath, "operation.lock");
            File.WriteAllText(staleLock, "synthetic-interrupted-lock\n");
            check("interrupted lock blocks preparation after restart", await restarted.HasUncertainOperationAsync());
            await Refuses("interrupted lock is never cleared on startup", () => restarted.AcquireLockAsync(), "busy");
            check("interrupted lock remains present", File.Exists(staleLock));

            var legacy = Store("node-reservation");
            var legacyHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(AdminContract.Project + "\0" + Email)));
            File.WriteAllText(Path.Combine(legacy.DirectoryPath, $"reservation-{legacyHash}.json"), JsonSerializer.Serialize(new
            {
                version = 1, project = AdminContract.Project, operationId = Guid.NewGuid().ToString("D"), targetHash = legacyHash,
                type = "invite", status = "reserved", reservedAt = "2026-11-12T10:00:00.000Z"
            }));
            check("historical Node reservation recognized without added GUI fields", await legacy.HasUncertainOperationAsync());
            var malformed = Store("malformed");
            File.WriteAllText(Path.Combine(malformed.DirectoryPath, "reservation-broken.json"), "{}");
            await Refuses("malformed reservation blocks new invitations", () => malformed.HasUncertainOperationAsync(), "private");

            var insecure = Store("insecure");
            var insecureDirectory = new DirectoryInfo(insecure.DirectoryPath);
            var acl = insecureDirectory.GetAccessControl();
            acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null), FileSystemRights.Read, AccessControlType.Allow));
            insecureDirectory.SetAccessControl(acl);
            await Refuses("storage visible to other local users refused", () => insecure.ValidateAsync(), "private");

            var wrongRepo = new WindowsPrivateStore(good.DirectoryPath, configPath, temporaryRoot, () => now);
            await Refuses("storage inside repository refused", () => wrongRepo.ValidateAsync(), "private");
            var cloud = Path.Combine(temporaryRoot, "OneDrive");
            CreateProtectedDirectory(cloud);
            var cloudStore = new WindowsPrivateStore(cloud, configPath, clock: () => now);
            await Refuses("known shared cloud destination refused", () => cloudStore.ValidateAsync(), "private");

            var hardlink = Path.Combine(temporaryRoot, "hardlink-operator.json");
            if (!CreateHardLink(hardlink, configPath, IntPtr.Zero)) throw new InvalidOperationException("Synthetic hardlink setup failed");
            await Refuses("hardlinked private file refused", () => { WindowsPrivateStore.VerifyProtectedFile(configPath); return Task.CompletedTask; }, "private");
            File.Delete(hardlink);

            var junction = Path.Combine(temporaryRoot, "junction");
            var process = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cmd.exe"))
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
            process.ArgumentList.Add("/c"); process.ArgumentList.Add("mklink"); process.ArgumentList.Add("/J");
            process.ArgumentList.Add(junction); process.ArgumentList.Add(good.DirectoryPath);
            using (var child = Process.Start(process)!) { await child.WaitForExitAsync(); if (child.ExitCode != 0) throw new InvalidOperationException("Synthetic junction setup failed"); }
            await Refuses("junction ancestry refused", () => new WindowsPrivateStore(junction, configPath, clock: () => now).ValidateAsync(), "private");
            Directory.Delete(junction); // Remove this known junction itself, never its target.

            WriteConfig(configPath, now, finalNewline: true);
            await Refuses("operator date with final newline refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now.AddDays(-31));
            await Refuses("stale operator contact evidence refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now.AddMinutes(1));
            await Refuses("future operator evidence refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now, missingApproval: true);
            await Refuses("missing existing preflight approval refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now);
        }
        finally
        {
            // All contents are this test's synthetic records. Verify the exact owned
            // temp target and refuse recursive cleanup if any reparse point remains.
            var full = Path.GetFullPath(temporaryRoot);
            var expectedParent = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (full.StartsWith(expectedParent, StringComparison.OrdinalIgnoreCase)
                && Path.GetFileName(full).StartsWith("mon-bprea-admin-store-tests-", StringComparison.Ordinal)
                && !Directory.EnumerateFileSystemEntries(full, "*", SearchOption.AllDirectories)
                    .Any(path => File.GetAttributes(path).HasFlag(FileAttributes.ReparsePoint))) Directory.Delete(full, recursive: true);
        }
    }

    private static void CreateProtectedDirectory(string path)
    {
        var security = new DirectorySecurity();
        security.SetAccessRuleProtection(true, false);
        var sid = WindowsIdentity.GetCurrent().User!;
        security.SetOwner(sid);
        foreach (var identity in new[] { sid, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null) })
            security.AddAccessRule(new FileSystemAccessRule(identity, FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
        FileSystemAclExtensions.Create(new DirectoryInfo(path), security);
    }

    private static void WriteConfig(string path, DateTimeOffset date, bool missingApproval = false, bool finalNewline = false)
    {
        var approvals = new JsonObject();
        foreach (var name in new[] { "legalFramework", "legalBases", "impactAssessment", "terminal", "notice", "residualRetention", "recoveryLimits" })
            approvals[name] = !missingApproval || name != "notice";
        File.WriteAllText(path, new JsonObject
        {
            ["version"] = 1, ["operatorIdentity"] = "Synthetic operator", ["capacityConfirmed"] = true,
            ["approvals"] = approvals,
            ["contact"] = new JsonObject
            {
                ["email"] = "vladimir.fouillade@hotmail.fr", ["publicationApproved"] = true, ["owned"] = true,
                ["protected"] = true, ["recoveryChecked"] = true, ["monitoringConfirmed"] = true, ["withoutAccountChecked"] = true,
                ["receivedAt"] = date.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") + (finalNewline ? "\n" : ""),
                ["repliedAt"] = date.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            }
        }.ToJsonString());
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CreateHardLinkW")]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateHardLink(string newName, string existingName, IntPtr security);
}
