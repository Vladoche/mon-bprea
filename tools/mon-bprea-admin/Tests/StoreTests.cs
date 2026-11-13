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
    public static string DiagnosticStage { get; private set; } = "not-started";
    private const string Email = "synthetic-participant@example.invalid";
    private const string Token = "SYNTHETIC_TEST_TOKEN_NO_PRODUCTION_0123456789";
    private static readonly HumanAttestations Human = new(true, true, true);

    public static async Task RunAsync(Action<string, bool> check)
    {
        if (!OperatingSystem.IsWindows()) { check("Windows private store requires Windows", false); return; }
        var now = new DateTimeOffset(2026, 11, 12, 10, 0, 0, TimeSpan.Zero);
        var temporaryRoot = Path.Combine(Path.GetTempPath(), "mon-bprea-admin-store-tests-" + Guid.NewGuid().ToString("N"));
        DiagnosticStage = "create-private-test-directory";
        CreateProtectedDirectory(temporaryRoot);
        var configPath = Path.Combine(temporaryRoot, "operator.json");
        DiagnosticStage = "write-synthetic-operator-configuration";
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
            DiagnosticStage = "unsafe-path-rejections";
            foreach (var path in new[] { "relative", @"\\server\share\private", @"C:\private:stream", @"C:\private\..\target", @"C:\" })
                await Refuses("unsafe storage path refused", () => new WindowsPrivateStore(path, configPath).ValidateAsync(), "private");

            DiagnosticStage = "synthetic-operator-file-security";
            WindowsPrivateStore.VerifyProtectedFile(configPath);
            DiagnosticStage = "synthetic-operator-preflight";
            OperatorPreflight.Validate(configPath, now);
            DiagnosticStage = "create-compliant-store-directory";
            var good = Store("good");
            DiagnosticStage = "compliant-store-and-efs-validation";
            await good.ValidateAsync();
            check("private EFS write probe and existing operator preflight", true);
            check("empty store has no uncertain operation", !await good.HasUncertainOperationAsync());
            await Refuses("reservation requires exclusive lock", () => good.ReserveAsync(Email, Human), "busy");

            Guid operation;
            DiagnosticStage = "exclusive-lock-and-durable-reservation";
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
                check("new private file owner is current user before content is used",
                    new FileInfo(reservation).GetAccessControl(AccessControlSections.Owner).GetOwner(typeof(SecurityIdentifier))?.Value
                    == WindowsIdentity.GetCurrent().User?.Value);
                var recordText = File.ReadAllText(reservation);
                var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(AdminContract.Project + "\0" + Email)));
                check("Node-compatible reservation hash and minimal no-address journal", Path.GetFileName(reservation) == $"reservation-{hash}.json"
                    && !recordText.Contains(Email, StringComparison.Ordinal) && !recordText.Contains(Token, StringComparison.Ordinal)
                    && !recordText.Contains("sb_secret_", StringComparison.Ordinal));
                await Refuses("link with wrong callback refused", () => good.DeliverAsync(Email, operation, "https://example.invalid/?token_hash=" + Token), "private");
                await Refuses("link with final newline refused", () => good.DeliverAsync(Email, operation,
                    AdminContract.Callback + "?token_hash=" + Token + "&type=invite\n"), "private");
                check("invalid link leaves durable reservation uncertain", await good.HasUncertainOperationAsync());
                DiagnosticStage = "encrypted-private-link-delivery";
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
            DiagnosticStage = "participant-handoff-annotation";
            await good.MarkHandedOverAsync(operation);
            check("manual participant handoff persisted separately", File.ReadAllText(Directory.GetFiles(good.DirectoryPath, "reservation-*.json").Single())
                .Contains("handedOverAt", StringComparison.Ordinal));
            await Refuses("handoff cannot silently replace a previous timestamp", () => good.MarkHandedOverAsync(operation), "private");
            using (await good.AcquireLockAsync())
                await Refuses("persistent target reservation blocks fresh operation after restart", () => good.ReserveAsync(Email, Human), "pending");

            DiagnosticStage = "append-only-recovery-and-node-compatibility";
            const string accountId = "22222222-2222-4222-8222-222222222222";
            var recoveryHuman = new RecoveryAttestations(true, true, true, true, true);
            var originalReservation = Directory.GetFiles(good.DirectoryPath, "reservation-*.json").Single();
            var originalBytes = File.ReadAllBytes(originalReservation);
            var originalDate = File.GetLastWriteTimeUtc(originalReservation);
            check("fully acknowledged V1 invitation allows recovery", !await good.HasRecoveryReservationAsync(Email));
            await Refuses("recovery reservation requires lock", () => good.ReserveRecoveryAsync(Email, accountId, recoveryHuman), "busy");
            Guid recovery;
            using (await good.AcquireLockAsync())
            {
                await NodeProbe(good.DirectoryPath, "lock-busy", check);
                await Refuses("recovery attestation cannot be inherited", () => good.ReserveRecoveryAsync(Email, accountId,
                    recoveryHuman with { IdentityCheckedViaKnownChannel = false }), "attestations");
                recovery = await good.ReserveRecoveryAsync(Email, accountId, recoveryHuman);
                check("new reservation remains uncertain after restart", await new WindowsPrivateStore(good.DirectoryPath, configPath, clock: () => now).HasUncertainOperationAsync());
            }
            await NodeProbe(good.DirectoryPath, "pending", check);
            using (await good.AcquireLockAsync())
            {
                await Refuses("new invite blocked by recovery uncertainty", () => good.ReserveAsync("other@example.invalid", Human), "pending");
                await Refuses("malformed recovery callback retains reservation", () => good.DeliverRecoveryAsync(Email, recovery,
                    AdminContract.Callback + "?token_hash=" + Token + "&type=invite"), "private");
                await good.DeliverRecoveryAsync(Email, recovery, AdminContract.Callback + "?token_hash=" + Token + "&type=recovery");
                await Refuses("recovery link cannot be overwritten", () => good.DeliverRecoveryAsync(Email, recovery,
                    AdminContract.Callback + "?token_hash=" + Token + "&type=recovery"), "private");
            }
            check("generation acknowledged but handover separately pending", !await good.HasUncertainOperationAsync() && await good.HasRecoveryReservationAsync(Email));
            var recoveryFile = Path.Combine(good.DirectoryPath, $"auth-link-{recovery:D}.txt");
            check("recovery file EFS encrypted", File.GetAttributes(recoveryFile).HasFlag(FileAttributes.Encrypted));
            await NodeProbe(good.DirectoryPath, "target-pending", check);
            var reservedEvent = Path.Combine(good.DirectoryPath, $"recovery-{recovery:D}-reserved.json");
            var reservedBytes = File.ReadAllBytes(reservedEvent);
            await good.MarkHandedOverAsync(recovery);
            await Refuses("handover timestamp cannot be replaced", () => good.MarkHandedOverAsync(recovery), "private");
            check("new request possible after separately recorded handover", !await good.HasRecoveryReservationAsync(Email));
            await NodeProbe(good.DirectoryPath, "clear", check);
            await NodeHoldsLock(good, check);
            File.Delete(recoveryFile); // This known synthetic link only, after handed-over.
            using (await good.AcquireLockAsync()) await good.ReserveRecoveryAsync(Email, accountId, recoveryHuman);
            check("all V1 evidence and original dates preserved", File.ReadAllBytes(originalReservation).SequenceEqual(originalBytes)
                && File.GetLastWriteTimeUtc(originalReservation) == originalDate && File.ReadAllBytes(reservedEvent).SequenceEqual(reservedBytes));
            foreach (var file in Directory.GetFiles(good.DirectoryPath, "recovery-*.json"))
            {
                var journal = File.ReadAllText(file);
                check("append-only journal contains no link email or key", !journal.Contains(Token) && !journal.Contains(Email) && !journal.Contains("sb_secret_"));
                WindowsPrivateStore.VerifyProtectedFile(file);
            }
            var lost = Store("lost-recovery-link"); Guid lostId;
            using (await lost.AcquireLockAsync())
            {
                lostId = await lost.ReserveRecoveryAsync(Email, accountId, recoveryHuman);
                await lost.DeliverRecoveryAsync(Email, lostId, AdminContract.Callback + "?token_hash=" + Token + "&type=recovery");
            }
            File.Delete(Path.Combine(lost.DirectoryPath, $"auth-link-{lostId:D}.txt"));
            await Refuses("lost private file blocks immediate regeneration", () => lost.HasRecoveryReservationAsync(Email), "private");
            await NodeProbe(lost.DirectoryPath, "private", check);
            var orphan = Store("orphan-recovery-receipt");
            WritePrivateFixture(Path.Combine(orphan.DirectoryPath, $"recovery-{Guid.NewGuid():D}-delivered-private.json"), "{}");
            await Refuses("orphan or corrupted recovery journal refused", () => orphan.HasUncertainOperationAsync(), "private");

            DiagnosticStage = "crash-and-restart-reservations";
            var crashed = Store("crashed");
            using (await crashed.AcquireLockAsync()) await crashed.ReserveAsync("crash@example.invalid", Human);
            var restarted = new WindowsPrivateStore(crashed.DirectoryPath, configPath, clock: () => now);
            check("crash after reservation survives restart", await restarted.HasUncertainOperationAsync());
            var staleLock = Path.Combine(crashed.DirectoryPath, "operation.lock");
            WritePrivateFixture(staleLock, "synthetic-interrupted-lock\n");
            check("interrupted lock blocks preparation after restart", await restarted.HasUncertainOperationAsync());
            await Refuses("interrupted lock is never cleared on startup", () => restarted.AcquireLockAsync(), "busy");
            check("interrupted lock remains present", File.Exists(staleLock));

            DiagnosticStage = "historical-node-reservation";
            var legacy = Store("node-reservation");
            var legacyHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(AdminContract.Project + "\0" + Email)));
            WritePrivateFixture(Path.Combine(legacy.DirectoryPath, $"reservation-{legacyHash}.json"), JsonSerializer.Serialize(new
            {
                version = 1, project = AdminContract.Project, operationId = Guid.NewGuid().ToString("D"), targetHash = legacyHash,
                type = "invite", status = "reserved", reservedAt = "2026-11-12T10:00:00.000Z"
            }));
            check("historical Node reservation recognized without added GUI fields", await legacy.HasUncertainOperationAsync());
            var completedLegacy = Store("completed-node-v1");
            var completedPath = Path.Combine(completedLegacy.DirectoryPath, $"reservation-{legacyHash}.json");
            WritePrivateFixture(completedPath, JsonSerializer.Serialize(new
            {
                version = 1, project = AdminContract.Project, operationId = Guid.NewGuid().ToString("D"), targetHash = legacyHash,
                type = "invite", status = "delivered-private", reservedAt = "2026-11-12T09:00:00.000Z", deliveredAt = "2026-11-12T09:01:00.000Z"
            }));
            var completedBytes = File.ReadAllBytes(completedPath); var completedDate = File.GetLastWriteTimeUtc(completedPath);
            check("completed V1 Node invitation does not require its withdrawn old link", !await completedLegacy.HasRecoveryReservationAsync(Email));
            using (await completedLegacy.AcquireLockAsync()) await completedLegacy.ReserveRecoveryAsync(Email, accountId, recoveryHuman);
            check("recovery preserves completed V1 Node fixture bytes and date", completedBytes.SequenceEqual(File.ReadAllBytes(completedPath))
                && File.GetLastWriteTimeUtc(completedPath) == completedDate);
            var malformed = Store("malformed");
            WritePrivateFixture(Path.Combine(malformed.DirectoryPath, "reservation-broken.json"), "{}");
            await Refuses("malformed reservation blocks new invitations", () => malformed.HasUncertainOperationAsync(), "private");

            DiagnosticStage = "unsafe-storage-rejections";
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

            DiagnosticStage = "synthetic-hardlink-setup-and-rejection";
            var hardlink = Path.Combine(temporaryRoot, "hardlink-operator.json");
            if (!CreateHardLink(hardlink, configPath, IntPtr.Zero)) throw new InvalidOperationException("Synthetic hardlink setup failed");
            await Refuses("hardlinked private file refused", () => { WindowsPrivateStore.VerifyProtectedFile(configPath); return Task.CompletedTask; }, "private");
            File.Delete(hardlink);

            DiagnosticStage = "synthetic-junction-setup-and-rejection";
            var junction = Path.Combine(temporaryRoot, "junction");
            var process = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cmd.exe"))
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
            process.ArgumentList.Add("/c"); process.ArgumentList.Add("mklink"); process.ArgumentList.Add("/J");
            process.ArgumentList.Add(junction); process.ArgumentList.Add(good.DirectoryPath);
            using (var child = Process.Start(process)!) { await child.WaitForExitAsync(); if (child.ExitCode != 0) throw new InvalidOperationException("Synthetic junction setup failed"); }
            await Refuses("junction ancestry refused", () => new WindowsPrivateStore(junction, configPath, clock: () => now).ValidateAsync(), "private");
            Directory.Delete(junction); // Remove this known junction itself, never its target.

            DiagnosticStage = "operator-preflight-date-and-approval-rejections";
            WriteConfig(configPath, now, finalNewline: true);
            await Refuses("operator date with final newline refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now.AddDays(-31));
            await Refuses("stale operator contact evidence refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now.AddMinutes(1));
            await Refuses("future operator evidence refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now, missingApproval: true);
            await Refuses("missing existing preflight approval refused", () => good.ValidateAsync(), "attestations");
            WriteConfig(configPath, now);
            DiagnosticStage = "completed";
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

    private static async Task NodeHoldsLock(WindowsPrivateStore store, Action<string, bool> check)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "scripts", "prod-auth", "private-store.mjs"))) root = root.Parent;
        if (root is null) throw new InvalidOperationException("Node fixture root absent");
        var start = new ProcessStartInfo("node") { WorkingDirectory = root.FullName, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true };
        start.ArgumentList.Add("--input-type=module"); start.ArgumentList.Add("-e");
        start.ArgumentList.Add("import {createPrivateStore} from './scripts/prod-auth/private-store.mjs';" +
            "await createPrivateStore(process.env.MON_BPREA_STORE_FIXTURE).withLock(async()=>{process.stdout.write('LOCKED\\n');await new Promise(r=>process.stdin.once('data',r));});");
        start.Environment.Clear(); start.Environment["SystemRoot"] = Environment.GetEnvironmentVariable("SystemRoot");
        start.Environment["PATH"] = Environment.GetEnvironmentVariable("PATH"); start.Environment["MON_BPREA_STORE_FIXTURE"] = store.DirectoryPath;
        using var child = Process.Start(start)!;
        try
        {
            DiagnosticStage = "node-lock-waiting-for-ready";
            var ready = new char[6];
            var received = await child.StandardOutput.ReadBlockAsync(ready, 0, 6).WaitAsync(TimeSpan.FromSeconds(45));
            var line = new string(ready, 0, received);
            DiagnosticStage = "node-lock-ready";
            check("real Node process holds shared operator lock", line == "LOCKED");
            var refused = false;
            try { using var unexpected = await store.AcquireLockAsync(); } catch (AdminException error) { refused = error.Code == "busy"; }
            check("C# cannot acquire lock held by real Node", refused);
            DiagnosticStage = "node-lock-releasing";
            await child.StandardInput.WriteLineAsync("release"); await child.StandardInput.FlushAsync();
            child.StandardInput.Close();
            DiagnosticStage = "node-lock-waiting-for-exit";
            await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(45));
            check("Node releases only its own operator lock", child.ExitCode == 0 && !File.Exists(Path.Combine(store.DirectoryPath, "operation.lock")));
        }
        finally { if (!child.HasExited) { child.Kill(); await child.WaitForExitAsync(); } }
    }

    private static async Task NodeProbe(string directory, string mode, Action<string, bool> check)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "scripts", "prod-auth", "private-store.mjs"))) root = root.Parent;
        if (root is null) throw new InvalidOperationException("Synthetic Node probe source missing");
        var start = new ProcessStartInfo("node") { WorkingDirectory = root.FullName, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true };
        start.ArgumentList.Add("--input-type=module"); start.ArgumentList.Add("-e");
        start.ArgumentList.Add("import { createPrivateStore } from './scripts/prod-auth/private-store.mjs'; " +
            "const mode=process.env.MON_BPREA_PROBE_MODE; " +
            "try { const s=createPrivateStore(process.env.MON_BPREA_STORE_FIXTURE); if(mode==='lock-busy'){await s.withLock(async()=>{});process.exitCode=2;} " +
            "else if(mode==='clear'){if(await s.read('synthetic-participant@example.invalid'))process.exitCode=3;} " +
            "else {await s.withLock(()=>s.reserve(mode==='pending'?'other@example.invalid':'synthetic-participant@example.invalid','recovery'));process.exitCode=4;} } " +
            "catch(e){const expected=mode==='lock-busy'?'busy':mode==='private'?'private':'pending';if(e.code!==expected){process.exitCode=5;process.stdout.write('FAIL:'+(/^[a-z_]{1,32}$/.test(e.code||'')?e.code:'unclassified'));}} " +
            "if(!process.exitCode)process.stdout.write('PASS');");
        start.Environment.Clear();
        start.Environment["SystemRoot"] = Environment.GetEnvironmentVariable("SystemRoot");
        start.Environment["PATH"] = Environment.GetEnvironmentVariable("PATH");
        start.Environment["MON_BPREA_STORE_FIXTURE"] = directory;
        start.Environment["MON_BPREA_PROBE_MODE"] = mode;
        using var child = Process.Start(start)!;
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        try { await child.WaitForExitAsync(deadline.Token); }
        catch { child.Kill(); await child.WaitForExitAsync(); throw; }
        var output = await child.StandardOutput.ReadToEndAsync();
        var safeCode = System.Text.RegularExpressions.Regex.IsMatch(output, @"^FAIL:[a-z_]{1,32}\z") ? output : "no-sensitive-diagnostic";
        check("real Node shared lock/journal compatibility " + mode + " " + safeCode, child.ExitCode == 0 && output == "PASS");
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
        WritePrivateFixture(path, new JsonObject
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

    private static void WritePrivateFixture(string path, string text)
    {
        if (File.Exists(path))
        {
            // Rewriting this test's existing fixture preserves its checked owner.
            File.WriteAllText(path, text);
            return;
        }
        var security = new FileSecurity();
        var sid = WindowsIdentity.GetCurrent().User!;
        security.SetOwner(sid);
        security.SetAccessRuleProtection(true, false);
        foreach (var identity in new[] { sid, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null) })
            security.AddAccessRule(new FileSystemAccessRule(identity, FileSystemRights.FullControl, AccessControlType.Allow));
        using var stream = FileSystemAclExtensions.Create(new FileInfo(path), FileMode.CreateNew,
            FileSystemRights.Read | FileSystemRights.Write, FileShare.None, 4096, FileOptions.WriteThrough, security);
        var bytes = Encoding.UTF8.GetBytes(text);
        stream.Write(bytes);
        stream.Flush(flushToDisk: true);
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CreateHardLinkW")]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateHardLink(string newName, string existingName, IntPtr security);
}
