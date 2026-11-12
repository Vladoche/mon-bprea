using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

// Same lock and reservation names/schema as scripts/prod-auth/private-store.mjs.
// No stale-lock removal, reservation reset, secret export or retry is provided.
public sealed class WindowsPrivateStore : IPrivateStore
{
    private const string Project = "oqoqrxwfbkhtpksqimgd";
    private const string Callback = "https://vladoche.github.io/mon-bprea/authentification.html";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };
    private readonly string operatorConfigurationPath;
    private readonly string? repositoryPath;
    private readonly Func<DateTimeOffset> clock;
    private int lockHeld;
    public string DirectoryPath { get; }

    public WindowsPrivateStore(string directoryPath, string operatorConfigurationPath, string? repositoryPath = null,
        Func<DateTimeOffset>? clock = null)
    {
        // Consultation remains available before configuring invitation prerequisites.
        // All paths are checked before accessing storage, never in this constructor.
        DirectoryPath = directoryPath.TrimEnd(Path.DirectorySeparatorChar);
        this.operatorConfigurationPath = operatorConfigurationPath;
        this.repositoryPath = repositoryPath is null ? FindRepository(AppContext.BaseDirectory) : CanonicalPath(repositoryPath);
        this.clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    public Task ValidateAsync() => Safe(() =>
    {
        VerifyPrivateDirectory();
        OperatorPreflight.Validate(operatorConfigurationPath, clock());
        var probe = Path.Combine(DirectoryPath, $"private-probe-{Guid.NewGuid():D}.tmp");
        WriteExclusive(probe, "", encrypted: true);
        File.Delete(probe); // Only this invocation's empty, verified probe.
    });

    public Task<bool> HasUncertainOperationAsync() => Safe(() =>
    {
        VerifyPrivateDirectory();
        var lockPath = Path.Combine(DirectoryPath, "operation.lock");
        if (Volatile.Read(ref lockHeld) == 0 && (File.Exists(lockPath) || Directory.Exists(lockPath))) return true;
        foreach (var file in Directory.EnumerateFiles(DirectoryPath, "reservation-*.json", SearchOption.TopDirectoryOnly))
            if (ReadRecord(file)["status"]!.GetValue<string>() == "reserved") return true;
        return false;
    });

    public Task<bool> HasTargetReservationAsync(string email) => Safe(() =>
    {
        VerifyPrivateDirectory();
        var path = ReservationPath(email);
        if (!File.Exists(path)) return false;
        ReadRecord(path, TargetHash(email));
        return true;
    });

    public Task<IDisposable> AcquireLockAsync() => Safe<IDisposable>(() =>
    {
        VerifyPrivateDirectory();
        if (Interlocked.CompareExchange(ref lockHeld, 1, 0) != 0) throw new AdminException("busy");
        var path = Path.Combine(DirectoryPath, "operation.lock");
        FileStream? stream = null;
        try
        {
            stream = NewFile(path);
            VerifyPrivateFile(path, stream.SafeFileHandle);
            WriteAndFlush(stream, Guid.NewGuid().ToString("D") + "\n");
            return new OperatorLock(this, path, stream);
        }
        catch
        {
            stream?.Dispose();
            Volatile.Write(ref lockHeld, 0);
            throw new AdminException("busy");
        }
    });

    public Task<Guid> ReserveAsync(string email, HumanAttestations attestations) => Safe(() =>
    {
        RequireLock();
        VerifyPrivateDirectory();
        if (!attestations.Complete) throw new AdminException("attestations");
        foreach (var file in Directory.EnumerateFiles(DirectoryPath, "reservation-*.json", SearchOption.TopDirectoryOnly))
            if (ReadRecord(file)["status"]!.GetValue<string>() == "reserved") throw new AdminException("pending");
        var path = ReservationPath(email);
        if (File.Exists(path)) throw new AdminException("pending");
        var id = Guid.NewGuid();
        var now = clock().ToString("O");
        var record = new JsonObject
        {
            ["version"] = 1, ["project"] = Project, ["operationId"] = id.ToString("D"),
            ["targetHash"] = TargetHash(email), ["type"] = "invite", ["reservedAt"] = now, ["status"] = "reserved",
            ["attestations"] = new JsonObject
            {
                ["noticeVersion"] = attestations.NoticeVersion, ["recordedAt"] = now,
                ["noticeProvidedBeforeEmail"] = true, ["directRequestAndEmailConfirmed"] = true,
                ["privateChannelAgreed"] = true
            }
        };
        WriteExclusive(path, record.ToJsonString(JsonOptions), encrypted: false);
        return id;
    });

    public Task DeliverAsync(string email, Guid operationId, string link) => Safe(() =>
    {
        RequireLock();
        VerifyPrivateDirectory();
        ValidateLink(link);
        var reservation = ReservationPath(email);
        var record = ReadRecord(reservation, TargetHash(email));
        if (record["operationId"]!.GetValue<string>() != operationId.ToString("D")
            || record["type"]!.GetValue<string>() != "invite" || record["status"]!.GetValue<string>() != "reserved")
            throw new AdminException("private");
        WriteExclusive(Path.Combine(DirectoryPath, $"auth-link-{operationId:D}.txt"), link + "\n", encrypted: true);
        record["status"] = "delivered-private";
        record["deliveredAt"] = clock().ToString("O");
        ReplaceRecord(reservation, record, $"receipt-{operationId:D}.new");
    });

    // Handing over to the participant is distinct from creating the local file.
    public async Task MarkHandedOverAsync(Guid operationId)
    {
        using var held = await AcquireLockAsync();
        await Safe(() =>
        {
            VerifyPrivateDirectory();
            JsonObject? found = null;
            string? path = null;
            foreach (var candidate in Directory.EnumerateFiles(DirectoryPath, "reservation-*.json", SearchOption.TopDirectoryOnly))
            {
                var record = ReadRecord(candidate);
                if (record["operationId"]!.GetValue<string>() != operationId.ToString("D")) continue;
                if (found is not null || record["status"]!.GetValue<string>() != "delivered-private") throw new AdminException("private");
                found = record; path = candidate;
            }
            if (found is null || path is null || found["handedOverAt"] is not null) throw new AdminException("private");
            found["handedOverAt"] = clock().ToString("O");
            ReplaceRecord(path, found, $"handoff-{Guid.NewGuid():D}.new");
        });
    }

    public void OpenPrivateFolder()
    {
        try
        {
            VerifyPrivateDirectory();
            var explorer = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "explorer.exe");
            var start = new ProcessStartInfo(explorer) { UseShellExecute = false };
            start.ArgumentList.Add(DirectoryPath);
            Process.Start(start)?.Dispose();
        }
        catch { throw new AdminException("private"); }
    }

    public static string CreateDefaultPrivateDirectory()
    {
        try
        {
            var parent = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MonBPREAAdmin");
            VerifyAncestors(parent, allowAbsentLeaf: true);
            Directory.CreateDirectory(parent);
            var directory = Path.Combine(parent, "Private");
            if (Directory.Exists(directory) || File.Exists(directory)) throw new AdminException("private");
            var security = new DirectorySecurity();
            security.SetAccessRuleProtection(true, false);
            var sid = WindowsIdentity.GetCurrent().User ?? throw new AdminException("private");
            security.SetOwner(sid);
            foreach (var identity in new[] { sid, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null) })
                security.AddAccessRule(new FileSystemAccessRule(identity, FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            FileSystemAclExtensions.Create(new DirectoryInfo(directory), security);
            VerifyAcl(directory, directory: true);
            if (!EncryptFile(directory, 0)) throw new AdminException("private");
            return directory;
        }
        catch { throw new AdminException("private"); }
    }

    public static void VerifyProtectedFile(string path)
    {
        var canonical = CanonicalPath(path);
        VerifyAncestors(Path.GetDirectoryName(canonical)!);
        VerifyLocalUnsharedPath(canonical);
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        VerifyPrivateFile(path, stream.SafeFileHandle);
    }

    private void VerifyPrivateDirectory()
    {
        if (!OperatingSystem.IsWindows()) throw new AdminException("private");
        CanonicalPath(DirectoryPath);
        VerifyAncestors(DirectoryPath);
        if (DirectoryPath == Path.GetPathRoot(DirectoryPath)) throw new AdminException("private");
        if (repositoryPath is not null && (Inside(repositoryPath, DirectoryPath) || Inside(DirectoryPath, repositoryPath)))
            throw new AdminException("private");
        // Also reject repositories not at the source build path, e.g. downloaded exe in a checkout.
        if (FindRepository(DirectoryPath) is not null) throw new AdminException("private");
        VerifyLocalUnsharedPath(DirectoryPath);
        VerifyAcl(DirectoryPath, directory: true);
    }

    private static void VerifyLocalUnsharedPath(string path)
    {
        foreach (var variable in new[] { "OneDrive", "OneDriveCommercial", "OneDriveConsumer", "Dropbox", "GoogleDrive" })
        {
            var cloud = Environment.GetEnvironmentVariable(variable);
            if (!string.IsNullOrWhiteSpace(cloud) && Inside(CanonicalPath(cloud), path)) throw new AdminException("private");
        }
        if (path.Split(Path.DirectorySeparatorChar).Any(segment =>
            segment.Equals("OneDrive", StringComparison.OrdinalIgnoreCase) || segment.StartsWith("OneDrive - ", StringComparison.OrdinalIgnoreCase)
            || segment.Equals("Dropbox", StringComparison.OrdinalIgnoreCase) || segment.Equals("Google Drive", StringComparison.OrdinalIgnoreCase)
            || segment.Equals("GoogleDrive", StringComparison.OrdinalIgnoreCase))) throw new AdminException("private");
        var drive = new DriveInfo(Path.GetPathRoot(path)!);
        if (drive.DriveType != DriveType.Fixed || !drive.DriveFormat.Equals("NTFS", StringComparison.OrdinalIgnoreCase)) throw new AdminException("private");
    }

    private JsonObject ReadRecord(string path, string? expectedHash = null)
    {
        VerifyProtectedFile(path);
        var info = new FileInfo(path);
        if (info.Length is <= 0 or > 65536) throw new AdminException("private");
        var record = JsonNode.Parse(File.ReadAllText(path, Encoding.UTF8))?.AsObject() ?? throw new AdminException("private");
        var hash = record["targetHash"]?.GetValue<string>() ?? "";
        if (record["version"]?.GetValue<int>() != 1 || record["project"]?.GetValue<string>() != Project
            || !Regex.IsMatch(hash, @"^[a-f0-9]{64}\z", RegexOptions.CultureInvariant)
            || expectedHash is not null && hash != expectedHash
            || Path.GetFileName(path) != $"reservation-{hash}.json"
            || !Guid.TryParseExact(record["operationId"]?.GetValue<string>(), "D", out _)
            || record["type"]?.GetValue<string>() is not ("invite" or "recovery")
            || record["status"]?.GetValue<string>() is not ("reserved" or "delivered-private")) throw new AdminException("private");
        return record;
    }

    private void ReplaceRecord(string path, JsonObject record, string temporaryName)
    {
        var temporary = Path.Combine(DirectoryPath, temporaryName);
        WriteExclusive(temporary, record.ToJsonString(JsonOptions), encrypted: false);
        VerifyProtectedFile(path);
        File.Move(temporary, path, overwrite: true); // Same directory, atomic rename; only own validated reservation.
        VerifyProtectedFile(path);
    }

    private static FileStream NewFile(string path) => new(path, FileMode.CreateNew, FileAccess.ReadWrite,
        FileShare.None, 4096, FileOptions.WriteThrough);

    private static void WriteExclusive(string path, string text, bool encrypted)
    {
        using (var empty = NewFile(path)) VerifyPrivateFile(path, empty.SafeFileHandle);
        if (encrypted && !EncryptFile(path, 0)) throw new AdminException("private");
        using (var stream = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None, 4096, FileOptions.WriteThrough))
        {
            VerifyPrivateFile(path, stream.SafeFileHandle);
            if (stream.Length != 0 || encrypted && !File.GetAttributes(path).HasFlag(FileAttributes.Encrypted)) throw new AdminException("private");
            WriteAndFlush(stream, text);
        }
        VerifyProtectedFile(path);
    }

    private static void WriteAndFlush(FileStream stream, string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        try { stream.Write(bytes); stream.Flush(flushToDisk: true); }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }

    private static void VerifyPrivateFile(string path, SafeFileHandle handle)
    {
        var attributes = File.GetAttributes(path);
        if ((attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint | FileAttributes.Offline)) != 0
            || !GetFileInformationByHandle(handle, out var info) || info.NumberOfLinks != 1) throw new AdminException("private");
        VerifyAcl(path, directory: false);
    }

    private static void VerifyAcl(string path, bool directory)
    {
        var security = directory
            ? (FileSystemSecurity)new DirectoryInfo(path).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access)
            : new FileInfo(path).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access);
        var sid = WindowsIdentity.GetCurrent().User?.Value ?? throw new AdminException("private");
        if (security.GetOwner(typeof(SecurityIdentifier))?.Value != sid) throw new AdminException("private");
        foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
            if (rule.AccessControlType == AccessControlType.Allow && rule.IdentityReference.Value != sid
                && rule.IdentityReference.Value != "S-1-5-18") throw new AdminException("private");
    }

    private static string CanonicalPath(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Any(c => char.IsControl(c)) || !Path.IsPathFullyQualified(value)
            || value.StartsWith(@"\\", StringComparison.Ordinal) || value.StartsWith("//", StringComparison.Ordinal)
            || value.Length <= 3 || value[1] != ':' || value[2] != '\\' || value[3..].Contains(':')
            || value.Split('\\').Any(segment => segment.EndsWith(' ') || segment.EndsWith('.')))
            throw new AdminException("private");
        var full = Path.GetFullPath(value).TrimEnd(Path.DirectorySeparatorChar);
        if (!full.Equals(value.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase)) throw new AdminException("private");
        return full;
    }

    private static void VerifyAncestors(string path, bool allowAbsentLeaf = false)
    {
        var current = path;
        if (allowAbsentLeaf && !Directory.Exists(current)) current = Path.GetDirectoryName(current)!;
        while (!string.IsNullOrEmpty(current))
        {
            var attributes = File.GetAttributes(current);
            if (!attributes.HasFlag(FileAttributes.Directory) || (attributes & (FileAttributes.ReparsePoint | FileAttributes.Offline)) != 0)
                throw new AdminException("private");
            current = Path.GetDirectoryName(current);
        }
    }

    private static bool Inside(string parent, string child) => child.Equals(parent, StringComparison.OrdinalIgnoreCase)
        || child.StartsWith(parent.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase);

    private static string? FindRepository(string path)
    {
        for (var current = new DirectoryInfo(path); current is not null; current = current.Parent)
            if (Directory.Exists(Path.Combine(current.FullName, ".git")) || File.Exists(Path.Combine(current.FullName, ".git"))) return current.FullName;
        return null;
    }

    private static string TargetHash(string email)
    {
        // Caller uses the same strict, lower-case target normalization as the Node contract.
        var normalized = AdminContract.NormalizeEmail(email);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(Project + "\0" + normalized)));
    }

    private string ReservationPath(string email) => Path.Combine(DirectoryPath, $"reservation-{TargetHash(email)}.json");
    private void RequireLock() { if (Volatile.Read(ref lockHeld) != 1) throw new AdminException("busy"); }

    private static void ValidateLink(string value)
    {
        if (!Regex.IsMatch(value, "^" + Regex.Escape(Callback) + @"\?token_hash=[A-Za-z0-9_-]{20,512}&type=invite\z", RegexOptions.CultureInvariant))
            throw new AdminException("private");
    }

    private static Task Safe(Action operation)
    {
        try { operation(); return Task.CompletedTask; }
        catch (AdminException) { throw; }
        catch { throw new AdminException("private"); }
    }
    private static Task<T> Safe<T>(Func<T> operation)
    {
        try { return Task.FromResult(operation()); }
        catch (AdminException) { throw; }
        catch { throw new AdminException("private"); }
    }

    private sealed class OperatorLock(WindowsPrivateStore owner, string path, FileStream stream) : IDisposable
    {
        private int disposed;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref disposed, 1) != 0) return;
            try { stream.Dispose(); File.Delete(path); }
            catch { /* Leave an interrupted lock in place; never expose filesystem exception text. */ }
            finally { Volatile.Write(ref owner.lockHeld, 0); }
        }
    }

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "EncryptFileW")]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EncryptFile(string path, uint reserved);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInformation information);
    [StructLayout(LayoutKind.Sequential)]
    private struct FileInformation
    {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime, LastAccessTime, LastWriteTime;
        public uint VolumeSerialNumber, FileSizeHigh, FileSizeLow, NumberOfLinks, FileIndexHigh, FileIndexLow;
    }
}
