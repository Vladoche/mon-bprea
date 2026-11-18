using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;
using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

internal static partial class Program
{
    private static async Task Adoption()
    {
        var id = Guid.NewGuid();
        var root = Path.Combine(Path.GetTempPath(), "mon-bprea-adoption-" + id.ToString("N"));
        WindowsPrivateStore.CreateV2Directory(root);
        var namespaces = new List<Guid>();
        (string Path, Guid Key) Fixture(string name)
        {
            var path = Path.Combine(root, name);
            WindowsPrivateStore.CreateV2Directory(path);
            var ns = Guid.NewGuid();
            namespaces.Add(ns);
            return (path, ns);
        }
        const string registry = @"Software\MonBPREAAdmin\Qualification\";
        static string Link(Guid operation, string folder) => Path.Combine(folder, $"auth-link-{operation:D}.txt");
        static string Put(string path, string contents)
        {
            using var file = WindowsPrivateStore.NewV2File(path);
            file.Write(Encoding.UTF8.GetBytes(contents)); file.Flush(true);
            return path;
        }
        static Dictionary<string, string> Fingerprints(string path) => Directory.EnumerateFiles(path).ToDictionary(
            file => Path.GetFileName(file), file => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file))));
        string V1(string folder, Guid operation, bool delivered = true)
        {
            var hash = ClosureContract.TargetHash(Operator);
            var journal = Put(Path.Combine(folder, $"reservation-{hash}.json"), JsonSerializer.Serialize(new {
                version = 1, project = AdminContract.Project, targetHash = hash, operationId = operation,
                type = "invite", reservedAt = Now, status = delivered ? "delivered-private" : "reserved",
                deliveredAt = delivered ? Now.AddMinutes(1) : (DateTimeOffset?)null
            }));
            if (delivered) Put(Link(operation, folder), AdminContract.Callback + "?token_hash=synthetic_token_000000000000&type=invite\n");
            return journal;
        }
        try
        {
            var (legacy, legacyKey) = Fixture("v1");
            var operation = Guid.NewGuid();
            var journal = V1(legacy, operation);
            var originals = Fingerprints(legacy);
            var store = new AutomaticPrivateStore(legacy, legacyKey);
            using (var beforePointer = store.AcquireInspection())
                await Reject("old executor lock blocks adoption", "busy", () => Task.Run(() => new AutomaticPrivateStore(legacy, legacyKey).Initialize()));
            Check("read-only inspection releases lock without changing originals", Fingerprints(legacy).SequenceEqual(originals));
            store.Initialize();
            Check("real V1 delivered-private recognized", store.InspectHistory() == new HistoryStatus(1, 1, 1));
            Check("V1 invitation evidence read without rewriting bytes",
                store.FindLegacyInvitation(Operator) == new LegacyInvitation(operation, Now, Now.AddMinutes(1))
                && Fingerprints(legacy).SequenceEqual(originals));
            Check("completed V1 permits another account check", !store.HasUncertainOperation());
            using (var pointer = Registry.CurrentUser.OpenSubKey(registry + legacyKey.ToString("D"), writable: true)!)
            {
                Check("same original history configured in Windows", (string?)pointer.GetValue("PrivateDirectory") == legacy);
                pointer.DeleteValue("PrivateDirectory"); // Fixtures only: interruption after sealing the anchor.
            }
            var reopened = new AutomaticPrivateStore(legacy, legacyKey);
            reopened.Initialize(); reopened.Initialize();
            Check("adoption resumes and is idempotent", Fingerprints(legacy).SequenceEqual(originals) && reopened.InspectHistory().Operations == 1);
            File.Delete(journal); // Synthetic test of a lost journal.
            await Reject("missing previously anchored journal remains blocked", "private", () => Task.Run(reopened.Initialize));
            Check("lost reservation is not regenerated", !File.Exists(journal));

            var (reserved, reservedKey) = Fixture("uncertain");
            V1(reserved, Guid.NewGuid(), delivered: false);
            var reservedBefore = Fingerprints(reserved);
            await Reject("V1 uncertain reservation blocks", "pending", () => Task.Run(new AutomaticPrivateStore(reserved, reservedKey).Initialize));
            Check("uncertain reservation preserved", Fingerprints(reserved).SequenceEqual(reservedBefore));

            var (v11, v11Key) = Fixture("v11");
            var recovery = Guid.NewGuid();
            var recoveryTarget = ClosureContract.TargetHash(Recipient);
            var reservations = new {
                version = 2, project = AdminContract.Project, type = "recovery", operationId = recovery,
                targetHash = recoveryTarget, status = "reserved", recordedAt = Now, accountId = RecoveryId,
                attestations = new { requestedByHolder = true, identityCheckedViaKnownChannel = true, selectedAddressConfirmed = true,
                    privateChannelAgreed = true, holderChoosesPassword = true }
            };
            Put(Path.Combine(v11, $"recovery-{recovery:D}-reserved.json"), JsonSerializer.Serialize(reservations));
            var recoveryText = AdminContract.Callback + "?token_hash=synthetic_token_111111111111&type=recovery\n";
            var recoveryFile = Put(Link(recovery, v11), recoveryText);
            File.Encrypt(recoveryFile);
            Put(Path.Combine(v11, $"recovery-{recovery:D}-delivered-private.json"), JsonSerializer.Serialize(new {
                version = 2, project = AdminContract.Project, type = "recovery", operationId = recovery, targetHash = recoveryTarget,
                status = "delivered-private", recordedAt = Now.AddMinutes(1), linkSha256 = BackupFiles.Hash(recoveryText)
            }));
            var fromV11 = new AutomaticPrivateStore(v11, v11Key);
            fromV11.Initialize();
            Check("V1.1 EFS recovery receipt and decryption verified", fromV11.InspectHistory() == new HistoryStatus(1, 1, 0));
            File.WriteAllText(recoveryFile, recoveryText.Replace("111111111111", "222222222222"));
            await Reject("V1.1 corrupted protected link blocks", "private", () => Task.Run(fromV11.Initialize));
            var fileSecurity = new FileInfo(recoveryFile).GetAccessControl();
            var savedSecurity = fileSecurity.GetSecurityDescriptorBinaryForm();
            fileSecurity.AddAccessRule(new FileSystemAccessRule(WindowsIdentity.GetCurrent().User!, FileSystemRights.ReadData, AccessControlType.Deny));
            new FileInfo(recoveryFile).SetAccessControl(fileSecurity);
            try { await Reject("existing EFS file inaccessible in Windows", "private", () => Task.Run(fromV11.Initialize)); }
            finally
            {
                fileSecurity.SetSecurityDescriptorBinaryForm(savedSecurity, AccessControlSections.Access);
                new FileInfo(recoveryFile).SetAccessControl(fileSecurity);
            }

            var (v2, v2Key) = Fixture("v2");
            var seeded = new AutomaticPrivateStore(AdminTarget.Production, v2);
            seeded.Initialize();
            using (seeded.AcquireLock())
            {
                var op = seeded.Reserve(Recipient, SimpleOperationKind.Invite, null, null, Now);
                seeded.Complete(new(op, "Lien fictif", "Archive de test",
                    [new(Recipient, AdminContract.Callback + "?token_hash=synthetic_token_222222222222&type=invite")],
                    Now, AccountId: RecoveryId));
            }
            var fromV2 = new AutomaticPrivateStore(v2, v2Key);
            fromV2.Initialize();
            Check("already initialized V2 DPAPI intact", fromV2.InspectHistory().Operations == 1 && !fromV2.HasUncertainOperation());
            var baseInvite = fromV2.InvitationHistory(Recipient).Single();
            var anchoredV2 = Fingerprints(v2);
            using (fromV2.AcquireLock())
            {
                var generated = Now.AddHours(24);
                var renewal = fromV2.Reserve(Recipient, SimpleOperationKind.RenewInvitation, RecoveryId, null, generated,
                    initialInvitation: baseInvite.Id);
                fromV2.Complete(new(renewal, "Lien fictif renouvelé", "Archive de test",
                    [new(Recipient, AdminContract.Callback + "?token_hash=synthetic_token_333333333333&type=invite")],
                    generated, 86400, RecoveryId, InvitationGeneratedAt: generated));
            }
            var renewedStore = new AutomaticPrivateStore(v2, v2Key);
            renewedStore.Initialize();
            var history = renewedStore.InvitationHistory(Recipient);
            Check("V2.2 protects and reopens old and new invitation receipts",
                history.Count == 2 && history[0] == baseInvite && history[1].InitialInvitation == baseInvite.Id
                && renewedStore.ReadResult(history[1].Id).ExpirySeconds == 86400
                && anchoredV2.All(record => Fingerprints(v2)[record.Key] == record.Value));

            var (invalid, invalidKey) = Fixture("bad-acl");
            V1(invalid, Guid.NewGuid());
            var security = new DirectoryInfo(invalid).GetAccessControl();
            security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.WorldSid, null),
                FileSystemRights.ReadAndExecute, AccessControlType.Allow));
            new DirectoryInfo(invalid).SetAccessControl(security);
            await Reject("foreign ACL blocks binding", "private", () => Task.Run(new AutomaticPrivateStore(invalid, invalidKey).Initialize));

            var (empty, emptyKey) = Fixture("missing");
            await Reject("empty directory cannot replace a missing history", "legacy_conflict",
                () => Task.Run(new AutomaticPrivateStore(empty, emptyKey).Initialize));
            await Reject("unavailable historical pointer", "legacy_conflict", () => Task.Run(() =>
                AutomaticPrivateStore.ResolveDirectory(empty, [Path.Combine(root, "missing-pointer")], true, Directory.Exists, File.Exists)));
            await Reject("multiple historical locations conflict", "legacy_conflict", () => Task.Run(() =>
                AutomaticPrivateStore.ResolveDirectory(empty, [reserved, v2], true, Directory.Exists, File.Exists)));
            using (var bad = Registry.CurrentUser.CreateSubKey(registry + emptyKey.ToString("D")))
                bad.SetValue("PrivateDirectory", Path.Combine(root, "absent"));
            await Reject("stale registry cannot be silently overwritten", "legacy_conflict",
                () => Task.Run(new AutomaticPrivateStore(empty, emptyKey).Initialize));
        }
        finally
        {
            foreach (var ns in namespaces)
                Registry.CurrentUser.DeleteSubKey(registry + ns.ToString("D"), throwOnMissingSubKey: false);
            if (Path.GetDirectoryName(Path.GetFullPath(root)) != Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')
                || Directory.EnumerateFileSystemEntries(root, "*", SearchOption.AllDirectories).Any(x => File.GetAttributes(x).HasFlag(FileAttributes.ReparsePoint)))
                throw new InvalidOperationException();
            Directory.Delete(root, recursive: true);
        }
    }
}
