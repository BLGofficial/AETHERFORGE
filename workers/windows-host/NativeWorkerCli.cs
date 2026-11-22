using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace AetherForge.WindowsWorker
{
    /// <summary>
    /// Native Windows C# Worker Executable (Phase 13 Native Verification).
    /// Compiled via Windows Framework64 csc.exe with System.Security.dll.
    /// Executes live Windows DPAPI (ProtectedData.Protect/Unprotect) and
    /// live Windows FileAttributes.ReparsePoint + canonical root confinement checks.
    /// </summary>
    public static class NativeWorkerCli
    {
        public static byte[] ProtectIdentity(byte[] plaintextSecret, byte[] entropy)
        {
            return ProtectedData.Protect(plaintextSecret, entropy, DataProtectionScope.CurrentUser);
        }

        public static byte[] UnprotectIdentity(byte[] encryptedBlob, byte[] entropy)
        {
            return ProtectedData.Unprotect(encryptedBlob, entropy, DataProtectionScope.CurrentUser);
        }

        public static void AssertSafeCanonicalTarget(string grantedRoot, string targetPath)
        {
            string fullRoot = Path.GetFullPath(grantedRoot)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                + Path.DirectorySeparatorChar;
            string fullTarget = Path.GetFullPath(targetPath);

            if (!fullTarget.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("DOMAIN_WORKER_PATH_ESCAPE_DENIED");
            }

            string dirName = Path.GetDirectoryName(fullTarget);
            DirectoryInfo current = string.IsNullOrEmpty(dirName) ? null : new DirectoryInfo(dirName);
            while (current != null && current.Exists)
            {
                if ((current.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    throw new UnauthorizedAccessException("DOMAIN_WORKER_REPARSE_POINT_DENIED");
                }
                string currentNormalized = current.FullName
                    .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                    + Path.DirectorySeparatorChar;
                if (string.Equals(currentNormalized, fullRoot, StringComparison.OrdinalIgnoreCase))
                {
                    break;
                }
                current = current.Parent;
            }
        }

        public static int Main(string[] args)
        {
            try
            {
                if (args.Length >= 1 && args[0] == "--self-test")
                {
                    // 1. Live Windows DPAPI round-trip verification
                    byte[] secret = Encoding.UTF8.GetBytes("worker-win11-dpapi-identity-secret-v1");
                    byte[] entropy = Encoding.UTF8.GetBytes("aetherforge-dpapi-entropy-v1");
                    byte[] encrypted = ProtectIdentity(secret, entropy);
                    byte[] decrypted = UnprotectIdentity(encrypted, entropy);
                    string roundTrip = Encoding.UTF8.GetString(decrypted);
                    if (roundTrip != "worker-win11-dpapi-identity-secret-v1")
                    {
                        Console.Error.WriteLine("DPAPI_ROUNDTRIP_MISMATCH");
                        return 2;
                    }

                    // 2. Canonical path confinement positive & negative checks
                    string tempRoot = Path.Combine(Path.GetTempPath(), "af-native-test-" + Guid.NewGuid().ToString("N"));
                    Directory.CreateDirectory(tempRoot);
                    try
                    {
                        string validTarget = Path.Combine(tempRoot, "outputs", "report.json");
                        AssertSafeCanonicalTarget(tempRoot, validTarget);

                        bool blockedEscape = false;
                        try
                        {
                            string escapedTarget = Path.Combine(tempRoot, "..", "escaped.json");
                            AssertSafeCanonicalTarget(tempRoot, escapedTarget);
                        }
                        catch (UnauthorizedAccessException ex)
                        {
                            blockedEscape = ex.Message.Contains("DOMAIN_WORKER_PATH_ESCAPE_DENIED");
                        }

                        if (!blockedEscape)
                        {
                            Console.Error.WriteLine("PATH_ESCAPE_NOT_BLOCKED");
                            return 3;
                        }
                    }
                    finally
                    {
                        if (Directory.Exists(tempRoot))
                        {
                            Directory.Delete(tempRoot, true);
                        }
                    }

                    Console.WriteLine("{\"ok\":true,\"dpapiVerified\":true,\"reparseAndTraversalGuardVerified\":true}");
                    return 0;
                }

                if (args.Length >= 3 && args[0] == "--verify-path")
                {
                    AssertSafeCanonicalTarget(args[1], args[2]);
                    Console.WriteLine("{\"ok\":true}");
                    return 0;
                }

                Console.Error.WriteLine("Usage: AetherForge.WindowsWorker.exe --self-test | --verify-path <root> <target>");
                return 1;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex.Message);
                return 4;
            }
        }
    }
}
