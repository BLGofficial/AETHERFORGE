# AETHER FORGE — INDEPENDENT VERIFICATION ENGINE (`VERIFICATION_ENGINE/README.md`)

Executable **Independent Verification Engine (`ARCH-07`, `AGT-19`)** enforcing:
1. **Separation of Duty:** `implementingAgentId !== verifierAgentId` and `verifierAgentId === "AGT-19"`.
2. **Anti-Self-Report / Anti-Compile-Only Completion Law:** Deterministically rejects any completion claim whose basis is `CODE_GENERATED_ONLY`, `COMPILATION_SUCCEEDED_ONLY`, or `AGENT_SELF_REPORT_ONLY`. Requires independent runtime oracle execution (`exitCode === 0`), static/security analysis pass, and live on-disk `SHA-256` verification.
3. **Six-Field Requirement Acceptance Certification:** Produces `RequirementAcceptanceRecord` entries with `expectedBehavior`, `verificationMethod`, `testResult`, `evidenceArtifact`, `passFailStatus`, and `knownLimitations`.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/VERIFICATION_ENGINE/src/index.ts)**: `IndependentVerificationEngine`.
