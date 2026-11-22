# ADR-0009 — FL Studio 2025 Adapter Is a Qualification Layer

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [GOVERNANCE.md](../../GOVERNANCE.md) · [REFERENCE-BOOK.md](../../REFERENCE-BOOK.md) · [Requirements](../product/requirements.md)

## Context

FL Studio 2025 is the first production DAW target for AETHER FORGE. Desktop DAWs expose heterogeneous integration surfaces (CLI arguments, MIDI/controller Python scripting, OSC, project file structures, and desktop UI) with varying degrees of determinism, safety, and vendor support. Assuming undocumented APIs or claiming universal control risks data loss in customer projects.

## Decision

The FL Studio 2025 adapter (`adapters/fl-studio-2025/`) implements the shared `adapters/daw-contract/` interface as a **strict capability qualification layer** divided into four incremental tiers:
1. `inspect` — Read-only verification of installed FL Studio 2025 version, environment prerequisites, and non-mutating project/session metadata.
2. `non_destructive_edit` — Sidecar preset generation, copy-on-write scratch session staging, or reversible script preparation without modifying the user's primary project file.
3. `session_mutation` — Controlled modification of an active or copied session after automated pre-mutation backup and checksum verification.
4. `render` — Controlled local audio export to a new atomic output path inside a granted workspace.

**Explicit Boundary Rules:**
- Every tier is **`deny` by default** until qualified by empirical evidence and automated/manual acceptance tests recorded in `docs/daws/fl-studio-2025-qualification.md` (Phase 09).
- Every executed DAW command returns structured `DawEvidence` plus a `reversible | irreversible` classification.
- UI automation is a **last resort**, explicitly opt-in, foreground-only, observable, immediately abortable via Emergency Stop, and strictly prohibited for destructive actions without final human confirmation.

## Alternatives Considered

- **Claiming universal headless DAW control out of the box:** Rejected as dishonest and technically fragile.
- **Treating raw mouse/keyboard UI macros as the primary API:** Rejected due to window-focus races, DPI sensitivity, and risk of accidental project corruption.
- **Deferring all DAW integration until a universal standard exists:** Rejected because tiered qualification delivers immediate verified value starting with `inspect` and safe offline rendering.

## Consequences

- **Positive:** Zero unverified DAW claims; customer `.flp` projects are protected by mandatory backups and tier gates.
- **Negative / Trade-offs:** Each capability tier requires dedicated discovery and qualification on an actual licensed FL Studio 2025 Windows 11 environment before activation.
