# AETHER FORGE — TROUBLESHOOTING GUIDE (`TROUBLESHOOTING_GUIDE.md`)

- **Version:** `1.0.0` | **Companion:** `docs/operations/runbooks.md`

| Error Code / Symptom | Root Cause | Exact Remediation |
| :--- | :--- | :--- |
| **`pnpm.ps1 cannot be loaded because running scripts is disabled`** | Windows PowerShell restricted ExecutionPolicy blocks `.ps1` shims. | Invoke `.cmd` shims (`pnpm.cmd`, `npm.cmd`, `npx.cmd`) or direct executables (`node`, `git`). |
| **`WORKSPACE_LOCKED_EMERGENCY_STOP` (HTTP 423)** | Emergency Stop Kill-Switch is active in `EmergencyStopRegistry`. | Inspect active incident in Workspace 10 (`System Monitor`), resolve root cause, and submit `active: false` with operator audit reason. |
| **`SELF_APPROVAL_FORBIDDEN`** | The same principal attempted to approve their own Tier 2/3 workflow step or release promotion. | Assign a distinct `Reviewer` or `ReleaseManager` principal (`requesterId !== approverId`). |
| **`DIRECT_GATEWAY_BYPASS_FORBIDDEN`** | Caller invoked `ControlledExecutionAdapters` without a valid single-use HMAC `GatewayExecutionSeal`. | Route all executions through `EngineeringExecutionRuntime.stageToolProposal()` → `executeStagedProposal()`. |
| **`STALE_FENCE_TOKEN_REJECTED` / `CONCURRENT_WRITE_GLOB_CONFLICT`** | Concurrent tasks contended on overlapping `exclusiveWriteGlobs` or presented an outdated lease `fenceToken`. | Serialize overlapping steps in the workflow DAG or refresh `TaskOwnershipLease` from `ORCHESTRATION_ENGINE`. |
| **`UNVERIFIED_GENERATED_CONTENT_PROMOTION_DENIED`** | Attempted to treat a `GENERATED_ARTIFACT` as authoritative or promote it without an `AGT-19` `PASS` evidence record. | Run independent verification via `VERIFICATION_ENGINE` (`AGT-19`) to emit a Layer 6 `EXECUTION_EVIDENCE` record first. |
| **`DAW_CAPABILITY_UNSUPPORTED`** | Requested forbidden DAW operation (`direct_flp_binary_mutation`, `fl_engine_dll_memory_injection`). | Use sanctioned read-only `.flp` inspection or Python MIDI Controller script bridge (`ADR-0009`). |
| **`BLOCKED_MISSING_PREREQUISITES` (VST3 / Rust binary)** | Host workstation lacks `cl.exe`, `C:\JUCE`, `C:\VST_SDK`, `pluginval.exe`, or `cargo`. | Execute native build on CI runner provisioned per `INSTALLATION_GUIDE.md` & `RELEASE_BLOCKERS.md`. |
| **`WAL_HASH_CHAIN_TAMPERED` / `CHECKPOINT_TAMPER_DETECTED`** | Disk `.wal.jsonl` or `.checkpoint.json` was modified out-of-band. | Quarantine corrupted execution directory; inspect OS file audit logs; re-run from last verified Git commit. |
