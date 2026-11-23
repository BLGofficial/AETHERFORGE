# AETHER FORGE — OPERATOR MANUAL (`OPERATOR_MANUAL.md`)

- **Version:** `1.0.0` | **Target Audience:** Platform Operators, Security Reviewers (`Reviewer`), Release Managers (`ReleaseManager`)

## 1. Operating the 11 Engineering Workspaces
1. **Command Center (`/workspaces/command-center`):** Monitor authoritative backend SHA-256 state, compiled specifications, pending Tier 2/3 approvals, and 12-discipline QA pass rates.
2. **Project Creation Studio (`/workspaces/project-creation-studio`):** Enter product direction or requirements to execute the 12-stage `AetherForgeSystemCompiler`. Resolve any `HALTED_BLOCKING_AMBIGUITY` prompts before workflow dispatch.
3. **Architecture & Agent Studios (`/workspaces/architecture-studio`, `/workspaces/agent-studio`):** Inspect component boundaries, exclusive write-lease globs, DAG acyclicity, and specialist agent assignments (`AGT-01`..`AGT-19`).
4. **Workflow Studio (`/workspaces/workflow-studio`):** Start durable workflows and inspect WAL hash heads. When a workflow enters `WAITING_FOR_APPROVAL` on a Tier 2/3 action, a **distinct `Reviewer` principal (`approverPrincipalId !== requesterPrincipalId`)** must inspect the diff/scope and submit `APPROVED` or `REJECTED`.
5. **Engineering Console (`/workspaces/engineering-console`):** Stage and execute controlled tools (`repo.inspect`, `code.review`, etc.) via `ControlledToolGateway` and audit SHA-256 hash-chained logs.
6. **Knowledge & Testing Centers (`/workspaces/knowledge-center`, `/workspaces/testing-center`):** Query authoritative `VERIFIED_FACT` / `ENGINEERING_DECISION` records (unverified `GENERATED_ARTIFACT` entries are quarantined) and inspect `AGT-19` 12-discipline evidence hashes.
7. **Integration Center (`/workspaces/integration-center`):** Run read-only `.flp` / `.rpp` inspections and monitor VST3 host compatibility status.
8. **System Monitor (`/workspaces/system-monitor`):** Trigger the **Emergency Stop Kill-Switch** (`POST /api/v1/ui/system/emergency-stop`) to lock all mutating endpoints with `HTTP 423 WORKSPACE_LOCKED_EMERGENCY_STOP` within `< 100 ms`.
9. **Reference Library (`/workspaces/reference-library`):** Browse active ADRs (`ADR-0001..0012`) and Reference Book records.

## 2. Emergency Procedures (Ref: `docs/operations/runbooks.md`)
- **Active Security Violation / Runaway Workflow:** Trigger Emergency Stop immediately in Workspace 10; inspect `EXECUTION_AUDIT` and `<executionId>.wal.jsonl`; execute LIFO rollback before clearing stop lock.
