# FL Studio 2025 — Discovery & Tiered Qualification Record

**Version:** 1.0.0  
**Status:** Phase 09 Empirical Qualification Record  
**Date:** 2026-11-22  
**Governing ADR:** [ADR-0009](../adr/0009-fl-studio-2025-qualification-layer.md) · [GOVERNANCE.md](../../GOVERNANCE.md) · [REFERENCE-BOOK.md](../../REFERENCE-BOOK.md)

---

## 1. Empirical Workstation Discovery (`verified_facts`)

Direct read-only filesystem and PE header inspection on the target Windows 11 workstation established the following installed Image-Line binaries:

| Installation Root | Binary | Size (Bytes) | PE `FileVersion` | PE `ProductVersion` | SHA-256 Prefix (16 hex) |
|---|---|---:|---|---|---|
| `C:\Program Files\Image-Line\FL Studio 2025` | `FL64.exe` | `1,120,112` | `25.1.6.4997` | `25.1.6.4997` | `273ECDC1C2421628` |
| `C:\Program Files\Image-Line\FL Studio 2025` | `FLEngine_x64.dll` | `63,013,744` | `25.1.6.4997` | `25.1.6.4997` | `7753BB8B16752F0B` |
| `C:\Program Files\Image-Line\FL Studio 2026` | `FL64.exe` | `593,400` | `26.1.1.5547` | `26.1.1.5547` | `697890ABCF929737` |
| `C:\Program Files\Image-Line\FL Studio 2026` | `FLEngine_x64.dll` | `26,946,040` | `26.1.1.5547` | `26.1.1.5547` | `B618E459C1FEC94B` |

---

## 2. Capability Tier Qualification Matrix (`INV-04`)

Per [ADR-0009](../adr/0009-fl-studio-2025-qualification-layer.md), no capability tier may be advertised or enabled without empirical qualification evidence and a passing acceptance suite.

| Capability Tier | Phase 09 Qualification Status | Qualified Operations | Integration Route | Reversibility & Backup Rule |
|---|---|---|---|---|
| `inspect` | **QUALIFIED (`true`)** | `inspect_version_and_session_header` | Direct read-only verification of `FL64.exe` / `FLEngine_x64.dll` installation binary metadata + deterministic binary parsing of `.flp` (`FLhd` header chunk: format version, channel count, PPQ time division, and `FLdt` event chunk framing + SHA-256 digest). | Strictly read-only (`reversible`); zero file mutations or GUI process launches. |
| `non_destructive_edit` | **QUALIFIED (`true`)** | `stage_non_destructive_session_copy` | Copy-on-write scratch session staging inside granted workspace: validates source `.flp` structure, writes a mandatory pre-action backup snapshot (`.bak`), and stages an isolated scratch `.flp` copy via atomic filesystem write. | `reversible`; requires `backupRequired: true`; source `.flp` SHA-256 is verified immutable before and after execution. |
| `session_mutation` | **UNQUALIFIED / BLOCKED (`false`)** | None (`DOMAIN_DAW_CAPABILITY_UNQUALIFIED`) | Image-Line does not publish an official headless project-mutation SDK for `.flp` binary event streams (`FLdt`). Direct binary mutation or unattended UI automation is blocked to prevent project corruption. | Hard-blocked at adapter boundary (`fail closed`). |
| `render` | **UNQUALIFIED / BLOCKED (`false`)** | None (`DOMAIN_DAW_CAPABILITY_UNQUALIFIED`) | Headless CLI rendering from a background Windows Service risks ASIO driver contention, modal plugin license prompts, and foreground window hijack. Blocked until isolated render-session qualification is performed. | Hard-blocked at adapter boundary (`fail closed`). |

---

## 3. Operating Prerequisites & Limitations

1. **Prerequisites:**
   - Windows 11 x64 workstation with `C:\Program Files\Image-Line\FL Studio 2025\FL64.exe` and `FLEngine_x64.dll` (`25.1.6.4997`).
   - Target `.flp` files must reside strictly inside the `CapabilityGrant.canonicalPathScope` directory granted to the Windows Worker.
2. **Known Limitations:**
   - `.flp` header inspection reads standard `FLhd` (6-byte payload: format, channels, PPQ) and verifies `FLdt` framing; it does not decode proprietary third-party VST state blobs inside `FLdt`.
   - Live in-process MIDI/Python controller scripts operate only when FL Studio 2025 is running interactively with an assigned MIDI controller port and are not invoked headlessly by the worker.

---

## 4. Rollback, Backup, and UI Automation Guardrails

- **Mandatory Pre-Action Backup:** Any `non_destructive_edit` operation rejects execution (`DOMAIN_DAW_BACKUP_REQUIRED`) unless `backupRequired === true`. The adapter creates an atomic backup artifact and records both `backupHash` and `sourceHash` in `DawExecutionProof`.
- **UI Automation Prohibition:** Any command requesting `foregroundUiFallbackOptIn: true` for destructive or unqualified operations fails closed (`DOMAIN_DAW_UI_AUTOMATION_PROHIBITED`).
- **Immediate Abortability:** Checking `isCancelled()` aborts execution before any staged file commit and purges temporary files.

---

## 5. Reproducibility Evidence

- Automated qualification suite: `tests/security/src/phase09-fl-studio-2025.test.ts`
- Verified against live `C:\Program Files\Image-Line\FL Studio 2025` binary installation (`25.1.6.4997`) and deterministic `.flp` (`FLhd`/`FLdt`) fixtures inside constrained worker workspaces.
