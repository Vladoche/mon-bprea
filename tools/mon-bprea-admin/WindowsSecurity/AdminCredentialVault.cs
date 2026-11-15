using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

public interface IAdminCredentialVault
{
    void Save(string secret);
    string? Read();
    void Delete();
}

// LOCAL_MACHINE persists this user's credential across logons on this PC.
// Windows encrypts the credential set; other Windows users do not gain access.
public sealed class AdminCredentialVault : IAdminCredentialVault
{
    private const uint Generic = 1, LocalMachine = 2;
    private readonly string target;
    private readonly string sid;
    public AdminCredentialVault() : this(null) { }
    // Random test namespace cannot touch the application's real credential.
    internal AdminCredentialVault(Guid? testNamespace)
    {
        if (!OperatingSystem.IsWindows()) throw new AdminException("credential");
        sid = WindowsIdentity.GetCurrent().User?.Value ?? throw new AdminException("credential");
        target = (testNamespace is null ? "MonBPREAAdmin/PROD/" : $"MonBPREAAdmin/TEST/{testNamespace:D}/")
            + AdminContract.Project + "/AuthAdmin/v1/" + sid;
    }
    public void Save(string secret)
    {
        AdminContract.ValidateSecret(secret);
        var bytes = Encoding.Unicode.GetBytes(secret);
        var blob = Marshal.AllocHGlobal(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, blob, bytes.Length);
            var credential = new Credential { Type = Generic, TargetName = target, UserName = sid,
                CredentialBlobSize = (uint)bytes.Length, CredentialBlob = blob, Persist = LocalMachine };
            if (!CredWrite(ref credential, 0)) throw new AdminException("credential");
        }
        catch (AdminException) { throw; }
        catch { throw new AdminException("credential"); }
        finally
        {
            for (var i = 0; i < bytes.Length; i++) Marshal.WriteByte(blob, i, 0);
            Marshal.FreeHGlobal(blob); System.Security.Cryptography.CryptographicOperations.ZeroMemory(bytes);
        }
    }
    public string? Read()
    {
        if (!CredRead(target, Generic, 0, out var pointer))
        {
            if (Marshal.GetLastWin32Error() == 1168) return null;
            throw new AdminException("credential");
        }
        try
        {
            var c = Marshal.PtrToStructure<Credential>(pointer);
            if (c.Type != Generic || c.TargetName != target || c.UserName != sid || c.Persist != LocalMachine
                || c.CredentialBlobSize is < 2 or > 532 || c.CredentialBlobSize % 2 != 0 || c.CredentialBlob == IntPtr.Zero) throw new AdminException("credential");
            var secret = Marshal.PtrToStringUni(c.CredentialBlob, (int)c.CredentialBlobSize / 2);
            AdminContract.ValidateSecret(secret); return secret;
        }
        catch { throw new AdminException("credential"); }
        finally
        {
            var c = Marshal.PtrToStructure<Credential>(pointer);
            if (c.CredentialBlob != IntPtr.Zero && c.CredentialBlobSize <= 532)
                for (var i = 0; i < c.CredentialBlobSize; i++) Marshal.WriteByte(c.CredentialBlob, i, 0);
            CredFree(pointer);
        }
    }
    public void Delete()
    {
        if (!CredDelete(target, Generic, 0) && Marshal.GetLastWin32Error() != 1168) throw new AdminException("credential");
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential
    {
        public uint Flags, Type;
        [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
        [MarshalAs(UnmanagedType.LPWStr)] public string? Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist, AttributeCount;
        public IntPtr Attributes;
        [MarshalAs(UnmanagedType.LPWStr)] public string? TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CredWrite(ref Credential credential, uint flags);
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CredDelete(string target, uint type, uint flags);
    [DllImport("advapi32.dll")] private static extern void CredFree(IntPtr credential);
}
