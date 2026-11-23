# AETHER FORGE — CONFIGURATION GUIDE (`CONFIGURATION_GUIDE.md`)

- **Version:** `1.0.0` | **Authority:** `packages/config`, `services/policy`, `services/provider-gateway`

## 1. Environment & Secret Management Rules
- **Zero Client-Side Secrets:** Never place LLM API keys, OIDC signing keys, or database passwords in browser storage, prompts, or committed files. All secrets resolve server-side via `ServerSideSecretManager` (`services/provider-gateway/src/index.ts`) and are scrubbed via `redactSecrets()`.
- **Core Environment Variables:**
  - `AETHER_TENANT_ID`: Active tenant scope enforced across RLS and audit logs.
  - `AETHER_WORKSPACE_ROOT`: Canonical sandbox root for `ENGINEERING_RUNTIME` and `workers/windows-host`.
  - `AETHER_CHECKPOINT_DIR`: Durable directory for `<executionId>.wal.jsonl` and `<executionId>.checkpoint.json`.
  - `AETHER_OPA_BUNDLE_PATH`: Path to signed OPA policy bundle (`services/policy/bundles/v1/governance.rego`).
  - `AETHER_FL_STUDIO_INSTALL_DIR`: Default `C:\Program Files\Image-Line\FL Studio 2025`.
  - `AETHER_BUDGET_MAX_TOKENS` / `AETHER_BUDGET_MAX_USD`: Per-workflow execution budget circuit breakers.

## 2. Policy & Governance Configuration
- **OPA Default-Deny (`services/policy/bundles/v1/governance.rego`):** Rejects unloaded bundles (`POLICY_BUNDLE_UNLOADED`), missing/expired/consumed `ApprovalRecord` tokens on Tiers 2 & 3, and out-of-scope file mutations.
- **Autonomy Caps:** `AGT-01`..`AGT-19` autonomy levels (`L1`..`L3`) are configured in `AGENT_REGISTRY.md` and enforced by `PERMISSION_SYSTEM/src/index.ts`.
