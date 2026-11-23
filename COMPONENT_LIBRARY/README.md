# AETHER FORGE — ACCESSIBLE ENGINEERING COMPONENT LIBRARY (`COMPONENT_LIBRARY/README.md`)

Reusable, XSS-safe, WCAG 2.1 AA accessible HTML5 component primitives (`ARCH-10`) rendering the 11 AETHER FORGE workspaces from authoritative backend state.

## Components

- `escapeHtml()`: Strict HTML entity encoding preventing XSS injection.
- `renderStatusBadge()`: Renders semantic status pills (`PASS`, `WARN`, `FAIL`, `QUARANTINED`, `INFO`).
- `renderHashPill()`: Renders truncated cryptographic `SHA-256` digests with full digest tooltip.
- `renderMetricCard()`: Renders quantitative KPI and SLO cards.
- `renderDataTable()`: Renders accessible `<table>` views with `<thead>`/`<th scope="col">`.
- `renderWorkspaceShell()`: Renders the 11-workspace navigation sidebar, emergency stop status banner, and `<main>` landmark.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/COMPONENT_LIBRARY/src/index.ts)**
