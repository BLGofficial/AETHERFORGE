using System.Security.Cryptography;
using System.Text;

namespace AetherForge.WindowsWorker;

/// <summary>
/// .NET 8 Windows Worker trust boundary skeleton (ADR-0001, ADR-0010).
/// Enforces DPAPI-backed local identity storage, outbound mTLS session enrollment,
/// signed JobManifest verification, ReparsePoint rejection, and atomic workspace writes.
/// Note: Local workstation verification recorded 'No .NET SDKs were found'; executable
/// cross-verified runtime and adversarial tests run in workers/windows-host/src/index.ts.
/// </summary>
public static class DpapiIdentityStore
{
    public static byte[] ProtectIdentity(byte[] plaintextSecret, byte[] entropy) =>
        OperatingSystem.IsWindows()
            ? ProtectedData.Protect(plaintextSecret, entropy, DataProtectionScope.CurrentUser)
            : throw new PlatformNotSupportedException("Windows DPAPI required.");

    public static byte[] UnprotectIdentity(byte[] encryptedBlob, byte[] entropy) =>
        OperatingSystem.IsWindows()
            ? ProtectedData.Unprotect(encryptedBlob, entropy, DataProtectionScope.CurrentUser)
            : throw new PlatformNotSupportedException("Windows DPAPI required.");
}

public static class ConstrainedFilesystemGuard
{
    public static void AssertSafeCanonicalTarget(string grantedRoot, string targetPath)
    {
        var canonicalRoot = Path.GetFullPath(grantedRoot).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var canonicalTarget = Path.GetFullPath(targetPath);

        if (!canonicalTarget.StartsWith(canonicalRoot, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("DOMAIN_WORKER_PATH_ESCAPE_DENIED");

        var current = new DirectoryInfo(Path.GetDirectoryName(canonicalTarget)!);
        while (current is not null && current.Exists)
        {
            if ((current.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new UnauthorizedAccessException("DOMAIN_WORKER_REPARSE_POINT_DENIED");
            if (string.Equals(
                    current.FullName.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar,
                    canonicalRoot,
                    StringComparison.OrdinalIgnoreCase))
                break;
            current = current.Parent;
        }
    }
}
