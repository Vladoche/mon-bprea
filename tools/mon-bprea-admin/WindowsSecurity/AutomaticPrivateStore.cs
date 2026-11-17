using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

// Sensitive payloads use DPAPI CurrentUser, with project/environment entropy.
// The minimal append-only journal deliberately contains neither links nor emails.
public sealed class AutomaticPrivateStore : ISimplePrivateStore
{
    private readonly AdminTarget target;
    private readonly string directory;
    private readonly bool requireExisting;
    private bool initialized;
    private int locked;
    private static readonly JsonSerializerOptions Json = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    public string DirectoryPath => directory;

    public AutomaticPrivateStore(AdminTarget target, bool requireExisting = false) : this(target, Discover(target, requireExisting))
        => this.requireExisting = requireExisting;
    internal AutomaticPrivateStore(AdminTarget target, string path) { this.target = target; directory = path; }

    private static string Discover(AdminTarget target, bool requireExisting)
    {
        if (!OperatingSystem.IsWindows()) throw new AdminException("private");
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MonBPREAAdmin");
        if (target.IsLocal) return Path.Combine(root, "Qualification", target.Qualification!.Value.ToString("D"), "Private");
        using var registry = Registry.CurrentUser.OpenSubKey(@"Software\MonBPREAAdmin");
        var configured = new[] { Environment.GetEnvironmentVariable("SUPABASE_PROD_PRIVATE_DIR"), registry?.GetValue("PrivateDirectory") as string }
            .Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => Path.GetFullPath(p!)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        return ResolveDirectory(Path.Combine(root, "Private"), configured, requireExisting, Directory.Exists, File.Exists);
    }

    internal static string ResolveDirectory(string defaultDirectory, string[] configured, bool requireExisting,
        Func<string, bool> directoryExists, Func<string, bool> fileExists)
    {
        var candidates = configured.Append(defaultDirectory).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var existing = candidates.Where(p => directoryExists(p) || fileExists(p)).ToArray();
        if (existing.Length > 1) throw new AdminException("legacy_conflict");
        // An explicit historical pointer must never be replaced by a new store.
        if (configured.Any(p => !directoryExists(p)) || requireExisting && existing.Length == 0) throw new AdminException("legacy_conflict");
        return existing.SingleOrDefault() ?? defaultDirectory;
    }

    public void Initialize() => Safe(() =>
    {
        if (!Directory.Exists(directory))
        {
            if (requireExisting || initialized) throw new AdminException("legacy_conflict");
            WindowsPrivateStore.CreateV2Directory(directory);
        }
        Validate();
        var probe = Path.Combine(directory, $"dpapi-probe-{Guid.NewGuid():D}.bin");
        var sample = RandomNumberGenerator.GetBytes(32);
        try
        {
            var encrypted = Protect(sample, decrypt: false);
            Write(probe, encrypted);
            var restored = Protect(Read(probe, 4096), decrypt: true);
            try { if (!CryptographicOperations.FixedTimeEquals(sample, restored)) throw new AdminException("private"); }
            finally { CryptographicOperations.ZeroMemory(restored); }
            File.Delete(probe); // Only this invocation's verified, regenerable probe.
        }
        finally { CryptographicOperations.ZeroMemory(sample); }
        // Register only a validated existing directory, never a key or a link.
        if (!target.IsLocal)
        {
            using var registry = Registry.CurrentUser.CreateSubKey(@"Software\MonBPREAAdmin");
            registry.SetValue("PrivateDirectory", directory, RegistryValueKind.String);
        }
        initialized = true;
    });

    public void Validate() => Safe(() =>
    {
        WindowsPrivateStore.VerifyV2Directory(directory);
        foreach (var path in Directory.EnumerateFileSystemEntries(directory))
        {
            if ((File.GetAttributes(path) & (FileAttributes.ReparsePoint | FileAttributes.Directory | FileAttributes.Offline)) != 0)
                throw new AdminException("private");
            if (Path.GetFileName(path) == "operation.lock") { WindowsPrivateStore.VerifyV2Acl(path); continue; }
            WindowsPrivateStore.VerifyProtectedFile(path);
        }
        // Parse historical uncertainty without changing any old bytes/dates.
        _ = ReadReservations();
    });

    public IDisposable AcquireLock()
    {
        if (File.Exists(Path.Combine(directory, "operation.lock"))) throw new AdminException("busy");
        Validate();
        if (Interlocked.CompareExchange(ref locked, 1, 0) != 0) throw new AdminException("busy");
        FileStream? stream = null;
        try
        {
            var path = Path.Combine(directory, "operation.lock");
            stream = WindowsPrivateStore.NewV2File(path);
            var bytes = Encoding.UTF8.GetBytes(Guid.NewGuid().ToString("D") + "\n");
            stream.Write(bytes); stream.Flush(true);
            return new Lease(this, path, stream);
        }
        catch { stream?.Dispose(); Volatile.Write(ref locked, 0); throw new AdminException("busy"); }
    }

    public bool HasUncertainOperation()
    {
        Validate();
        if (Volatile.Read(ref locked) == 0 && File.Exists(Path.Combine(directory, "operation.lock"))) return true;
        if (AdditionalClosureLedgerBlocks(directory)) return true;
        if (WindowsPrivateStore.LegacyUncertaintyV2(directory)) return true;
        // Closure intentions remain blocking even after active data checks: the
        // residual copies/reconciliation workflow has not disappeared.
        return ReadReservations().Any(r => r.Kind == SimpleOperationKind.Delete || r.Status != "complete");
    }

    public bool HasLegacyTarget(string email)
    {
        Validate();
        return WindowsPrivateStore.LegacyTargetV2(directory, email);
    }

    public SimpleReservation? Latest(string email, SimpleOperationKind kind) => ReadReservations()
        .Where(r => r.TargetHash == ClosureContract.TargetHash(email) && r.Kind == kind).OrderByDescending(r => r.CreatedAt).FirstOrDefault();

    public Guid Reserve(string email, SimpleOperationKind kind, string? accountId, string? newEmail, DateTimeOffset now, string? backupReference = null)
    {
        RequireLock(); Validate();
        if (kind == SimpleOperationKind.Delete && (backupReference is null || !Hash(backupReference) || accountId is null)) throw new AdminException("closure_backup");
        if (AdditionalClosureLedgerBlocks(directory) || ReadReservations().Any(r => r.Status != "complete")) throw new AdminException("pending");
        var id = Guid.NewGuid();
        var record = new SimpleReservation(id, kind, ClosureContract.TargetHash(email), accountId, now, "reserved",
            newEmail is null ? null : ClosureContract.TargetHash(newEmail));
        Write(RecordPath(id, "reserved.json"), Envelope(record));
        if (kind == SimpleOperationKind.Delete)
        {
            // Append a durable tombstone compatible with the existing ledger;
            // the historical contents are never replaced by a backup snapshot.
            var path = Path.Combine(directory, "deletions.json");
            var entries = File.Exists(path) ? JsonSerializer.Deserialize<List<JsonElement>>(Read(path, 1_000_000))! : [];
            entries.Add(JsonSerializer.SerializeToElement(new { version = 4, type = "closure", operationId = id, project = target.Project,
                projectRef = target.IsLocal ? "synthetic-admin-v2" : target.Project,
                userId = accountId, targetHash = record.TargetHash, status = "pending/uncertain", recordedAt = now,
                scope = "auth-and-ten-tables", backupReferences = new[] { backupReference },
                residuals = new[] { "backups-reconcile-before-restore", "jwt-until-expiry", "devices-and-downloads" },
                nextAction = "postcheck-and-residual-review", reviewDueAt = now.AddDays(1) }));
            var fresh = RecordPath(id, "ledger.new"); Write(fresh, JsonSerializer.SerializeToUtf8Bytes(entries, Json));
            File.Move(fresh, path, true);
            WindowsPrivateStore.VerifyProtectedFile(path);
        }
        return id;
    }

    public void RecordStep(Guid id, string step)
    {
        RequireLock();
        if (step != "email-modified" || ReadReservations().All(r => r.Id != id)) throw new AdminException("private");
        Write(RecordPath(id, "step-email-modified.json"), Envelope(new { Id = id, Step = step, RecordedAt = DateTimeOffset.UtcNow }));
    }

    public void Complete(SimpleResult result)
    {
        RequireLock();
        var reserved = ReadReservations().Single(r => r.Id == result.Operation);
        var plain = JsonSerializer.SerializeToUtf8Bytes(result, Json);
        try { Write(RecordPath(result.Operation, "payload.bin"), Protect(plain, decrypt: false)); }
        finally { CryptographicOperations.ZeroMemory(plain); }
        // The encrypted payload is reread and authenticated before completion.
        var saved = ReadResult(result.Operation);
        if (saved.Operation != result.Operation) throw new AdminException("private");
        Write(RecordPath(result.Operation, "complete.json"), Envelope(new {
            Id = result.Operation, Status = "complete", RecordedAt = DateTimeOffset.UtcNow,
            PayloadHash = Convert.ToHexStringLower(SHA256.HashData(Read(RecordPath(result.Operation, "payload.bin"), 65536))) }));
    }

    public SimpleResult ReadResult(Guid id)
    {
        var plain = Protect(Read(RecordPath(id, "payload.bin"), 65536), decrypt: true);
        try
        {
            var result = JsonSerializer.Deserialize<SimpleResult>(plain) ?? throw new AdminException("private");
            if (result.Operation != id) throw new AdminException("private");
            return result;
        }
        finally { CryptographicOperations.ZeroMemory(plain); }
    }

    public string DeletionLedgerHash()
    {
        var path = Path.Combine(directory, "deletions.json");
        if (!File.Exists(path)) return ClosureContract.Hash("[]");
        using var json = JsonDocument.Parse(Read(path, 1_000_000)); SimpleJson.Unique(json.RootElement);
        if (json.RootElement.ValueKind != JsonValueKind.Array) throw new AdminException("private");
        return ClosureContract.Hash(JsonSerializer.Serialize(json.RootElement, Json));
    }

    private List<SimpleReservation> ReadReservations()
    {
        var results = new List<SimpleReservation>();
        foreach (var path in Directory.EnumerateFiles(directory, "admin-v2-*-reserved.json"))
        {
            using var doc = JsonDocument.Parse(Read(path, 65536)); var item = Unwrap(doc.RootElement);
            var r = item.Deserialize<SimpleReservation>() ?? throw new AdminException("private");
            if (r.Id == Guid.Empty || !Enum.IsDefined(r.Kind) || r.Status != "reserved" || !Hash(r.TargetHash)
                || r.NextHash is not null && !Hash(r.NextHash) || r.AccountId is not null && !ClosureContract.Uuid(r.AccountId)
                || path != RecordPath(r.Id, "reserved.json") || results.Any(x => x.Id == r.Id)) throw new AdminException("private");
            var complete = RecordPath(r.Id, "complete.json");
            if (File.Exists(complete))
            {
                using var receipt = JsonDocument.Parse(Read(complete, 65536)); var value = Unwrap(receipt.RootElement);
                if (value.GetProperty("Id").GetGuid() != r.Id || value.GetProperty("Status").GetString() != "complete"
                    || value.GetProperty("PayloadHash").GetString() != Convert.ToHexStringLower(SHA256.HashData(Read(RecordPath(r.Id, "payload.bin"), 65536))))
                    throw new AdminException("private");
                r = r with { Status = "complete" };
            }
            results.Add(r);
        }
        // Orphan receipts/steps/payloads are not ignored to escape uncertainty.
        foreach (var path in Directory.EnumerateFiles(directory, "admin-v2-*"))
        {
            var name = Path.GetFileName(path);
            if (name.Length < 45 || !Guid.TryParseExact(name.Substring(9, 36), "D", out var id)
                || results.All(r => r.Id != id)) throw new AdminException("private");
            if (!new[] { "reserved.json", "complete.json", "payload.bin", "step-email-modified.json" }
                .Any(suffix => name == $"admin-v2-{id:D}-{suffix}")) throw new AdminException("private");
        }
        return results;
    }

    internal static bool BlocksLegacy(string path, string? email = null)
    {
        if (AdditionalClosureLedgerBlocks(path)) return true;
        var operations = new AutomaticPrivateStore(AdminTarget.Production, path).ReadReservations();
        var hash = email is null ? null : ClosureContract.TargetHash(email);
        return operations.Any(r => r.Status != "complete" || r.Kind == SimpleOperationKind.Delete
            || hash is not null && (r.TargetHash == hash || r.NextHash == hash));
    }

    private static bool AdditionalClosureLedgerBlocks(string directory)
    {
        var path = Path.Combine(directory, "deletions.json");
        if (!File.Exists(path)) return false;
        using var document = JsonDocument.Parse(Read(path, 1_000_000));
        SimpleJson.Unique(document.RootElement);
        if (document.RootElement.ValueKind != JsonValueKind.Array) throw new AdminException("private");
        foreach (var entry in document.RootElement.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Object) throw new AdminException("private");
            if (!entry.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String || type.GetString() != "closure") continue;
            // V3 keeps its existing strict event/ledger validation. V4 and
            // unknown versions remain blocking even without their event files.
            if (!entry.TryGetProperty("version", out var version) || version.ValueKind != JsonValueKind.Number
                || !version.TryGetInt32(out var number) || number != 3) return true;
        }
        return false;
    }

    private byte[] Envelope<T>(T value) => JsonSerializer.SerializeToUtf8Bytes(new { Version = 4, Project = target.Project, Data = value }, Json);
    private JsonElement Unwrap(JsonElement value)
    {
        SimpleJson.Unique(value);
        if (value.GetProperty("Version").GetInt32() != 4 || value.GetProperty("Project").GetString() != target.Project) throw new AdminException("private");
        return value.GetProperty("Data");
    }
    private static bool Hash(string value) => value.Length == 64 && value.All(c => char.IsAsciiHexDigitLower(c));
    private string RecordPath(Guid id, string suffix) => Path.Combine(directory, $"admin-v2-{id:D}-{suffix}");
    private void RequireLock() { if (Volatile.Read(ref locked) != 1) throw new AdminException("busy"); }
    private static void Safe(Action action)
    { try { action(); } catch (AdminException) { throw; } catch { throw new AdminException("private"); } }
    private static byte[] Read(string path, int maximum)
    {
        WindowsPrivateStore.VerifyProtectedFile(path);
        if (new FileInfo(path).Length is <= 0 || new FileInfo(path).Length > maximum) throw new AdminException("private");
        return File.ReadAllBytes(path);
    }
    private static void Write(string path, byte[] bytes)
    {
        using (var file = WindowsPrivateStore.NewV2File(path)) { file.Write(bytes); file.Flush(true); }
        WindowsPrivateStore.VerifyProtectedFile(path);
    }

    private byte[] Protect(byte[] input, bool decrypt)
    {
        var entropy = Encoding.UTF8.GetBytes("MonBPREAAdmin/v2/" + target.Project + "/" + target.Qualification);
        var data = Blob.From(input); var salt = Blob.From(entropy); var output = new Blob();
        try
        {
            var ok = decrypt ? CryptUnprotectData(ref data, IntPtr.Zero, ref salt, IntPtr.Zero, IntPtr.Zero, 1, out output)
                : CryptProtectData(ref data, null, ref salt, IntPtr.Zero, IntPtr.Zero, 1, out output);
            if (!ok || output.Size is <= 0 or > 65536) throw new AdminException("private");
            var result = new byte[output.Size]; Marshal.Copy(output.Data, result, 0, result.Length); return result;
        }
        finally
        {
            data.Free(); salt.Free(); CryptographicOperations.ZeroMemory(entropy);
            if (output.Data != IntPtr.Zero) { for (var i = 0; i < output.Size; i++) Marshal.WriteByte(output.Data, i, 0); LocalFree(output.Data); }
        }
    }
    private sealed class Lease(AutomaticPrivateStore owner, string path, FileStream stream) : IDisposable
    {
        private int done;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref done, 1) != 0) return;
            try { stream.Dispose(); File.Delete(path); } catch { /* A leftover lock remains blocking. */ }
            finally { Volatile.Write(ref owner.locked, 0); }
        }
    }
    [StructLayout(LayoutKind.Sequential)] private struct Blob
    {
        public int Size; public IntPtr Data;
        public static Blob From(byte[] bytes) { var p = Marshal.AllocHGlobal(bytes.Length); Marshal.Copy(bytes, 0, p, bytes.Length); return new() { Size = bytes.Length, Data = p }; }
        public void Free() { if (Data == IntPtr.Zero) return; for (var i = 0; i < Size; i++) Marshal.WriteByte(Data, i, 0); Marshal.FreeHGlobal(Data); }
    }
    [DllImport("crypt32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(ref Blob data, string? description, ref Blob entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
    [DllImport("crypt32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptUnprotectData(ref Blob data, IntPtr description, ref Blob entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
}

public sealed partial class WindowsPrivateStore
{
    internal static bool LegacyUncertaintyV2(string path)
    {
        var old = new WindowsPrivateStore(path, "");
        foreach (var file in Directory.EnumerateFiles(path, "reservation-*.json"))
            if (old.ReadRecord(file)["status"]!.GetValue<string>() == "reserved") return true;
        return old.ReadClosures().Count != 0 || old.ReadRecoveries().Any(r => r.Status == "reserved");
    }
    internal static bool LegacyTargetV2(string path, string email)
    {
        var old = new WindowsPrivateStore(path, "");
        if (old.ReadClosures().Count != 0) return true;
        var reservation = old.ReservationPath(email);
        if (File.Exists(reservation) && old.ReadRecord(reservation)["status"]!.GetValue<string>() == "reserved") return true;
        return old.ReadRecoveries().Any(r => r.Hash == TargetHash(email) && r.Status != "handed-over");
    }
    internal static void VerifyV2Directory(string directory) => new WindowsPrivateStore(directory, "").VerifyPrivateDirectory();
    internal static void VerifyV2Acl(string path) => VerifyAcl(path, false);
    internal static FileStream NewV2File(string path) => NewFile(path);
    internal static void CreateV2Directory(string path)
    {
        // Validate every existing ancestor before creating each missing segment.
        var missing = new Stack<string>(); var current = path;
        while (!Directory.Exists(current)) { missing.Push(current); current = Path.GetDirectoryName(current) ?? throw new AdminException("private"); }
        VerifyAncestors(current); VerifyLocalUnsharedPath(path);
        if (FindRepository(path) is not null) throw new AdminException("private");
        var sid = WindowsIdentity.GetCurrent().User ?? throw new AdminException("private");
        while (missing.TryPop(out var next))
        {
            var security = new DirectorySecurity(); security.SetOwner(sid); security.SetAccessRuleProtection(true, false);
            foreach (var id in new[] { sid, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null) })
                security.AddAccessRule(new FileSystemAccessRule(id, FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            FileSystemAclExtensions.Create(new DirectoryInfo(next), security);
            VerifyAcl(next, true);
        }
        VerifyV2Directory(path);
    }
}
