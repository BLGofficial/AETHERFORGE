# Antigravity Prompt — PHASE 06: Windows Worker Trust Boundary

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-06--windows-worker-trust-boundary)

```text
Implement .NET 8 Windows Worker skeleton with enrollment, machine identity, outbound mTLS session, signed JobManifest verification, DPAPI-backed local identity storage, heartbeat, capability grant validation, cancellation and evidence return. Use a mock gateway in tests; do not require a live cloud environment.

Implement a constrained workspace filesystem operation as the first real worker activity: read manifest and atomic write only inside an explicitly granted canonical path. Defend against traversal, symlinks/reparse points, TOCTOU and expired/revoked grants. Gate: adversarial path tests pass; unenrolled, unsigned, expired and out-of-scope jobs fail closed.
```
