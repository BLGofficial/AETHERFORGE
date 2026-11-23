/**
 * AETHER FORGE — INDUSTRIAL ENGINEERING DESIGN SYSTEM (v1.0.0)
 * Design tokens, status semantics, and studio CSS generator for the 11 workspaces.
 */

export const AETHER_DESIGN_TOKENS = {
  colors: {
    canvasBg: "#0B0F17",
    surfacePrimary: "#111827",
    surfaceElevated: "#1E293B",
    borderSubtle: "#334155",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    accentPrimary: "#38BDF8",
    statusPassEmerald: "#10B981",
    statusWarningAmber: "#F59E0B",
    statusFailCrimson: "#EF4444",
    statusQuarantinePurple: "#A855F7",
  },
  typography: {
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
} as const;

export type SemanticBadgeTone = "PASS" | "WARN" | "FAIL" | "INFO" | "QUARANTINED";

export function mapStatusToBadgeTone(status: string): SemanticBadgeTone {
  const upper = status.toUpperCase();
  if (
    upper.includes("PASS") ||
    upper.includes("COMPLETED") ||
    upper.includes("VALID") ||
    upper.includes("VERIFIED_FACT") ||
    upper.includes("ACTIVE") ||
    upper.includes("OPERATIONAL")
  ) {
    return "PASS";
  }
  if (
    upper.includes("WAIT") ||
    upper.includes("APPROVAL") ||
    upper.includes("PAUSED") ||
    upper.includes("BLOCKED") ||
    upper.includes("TIER 2") ||
    upper.includes("TIER 3")
  ) {
    return "WARN";
  }
  if (upper.includes("GENERATED_ARTIFACT") || upper.includes("QUARANTINE")) {
    return "QUARANTINED";
  }
  if (
    upper.includes("FAIL") ||
    upper.includes("REJECT") ||
    upper.includes("ERROR") ||
    upper.includes("STOP") ||
    upper.includes("LOCKED")
  ) {
    return "FAIL";
  }
  return "INFO";
}

export function generateAetherStudioStylesheet(): string {
  const t = AETHER_DESIGN_TOKENS;
  return `
:root {
  --bg-canvas: ${t.colors.canvasBg};
  --bg-surface: ${t.colors.surfacePrimary};
  --bg-elevated: ${t.colors.surfaceElevated};
  --border-subtle: ${t.colors.borderSubtle};
  --text-primary: ${t.colors.textPrimary};
  --text-secondary: ${t.colors.textSecondary};
  --accent-primary: ${t.colors.accentPrimary};
  --status-pass: ${t.colors.statusPassEmerald};
  --status-warn: ${t.colors.statusWarningAmber};
  --status-fail: ${t.colors.statusFailCrimson};
  --status-quarantine: ${t.colors.statusQuarantinePurple};
  --font-sans: ${t.typography.fontSans};
  --font-mono: ${t.typography.fontMono};
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-sans);
  line-height: 1.5;
}
.af-shell {
  display: grid;
  grid-template-columns: 270px 1fr;
  min-height: 100vh;
}
.af-sidebar {
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  padding: 20px 14px;
}
.af-brand {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.06em;
  color: var(--accent-primary);
  margin-bottom: 18px;
}
.af-nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.af-nav-link {
  display: block;
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.88rem;
  border: 1px solid transparent;
}
.af-nav-link[aria-current="page"] {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-color: var(--accent-primary);
  font-weight: 600;
}
.af-main {
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.af-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 16px;
}
.af-grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.af-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px;
}
.af-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 600;
}
.af-badge-PASS { background: rgba(16,185,129,0.16); color: var(--status-pass); border: 1px solid var(--status-pass); }
.af-badge-WARN { background: rgba(245,158,11,0.16); color: var(--status-warn); border: 1px solid var(--status-warn); }
.af-badge-FAIL { background: rgba(239,68,68,0.16); color: var(--status-fail); border: 1px solid var(--status-fail); }
.af-badge-QUARANTINED { background: rgba(168,85,247,0.16); color: var(--status-quarantine); border: 1px solid var(--status-quarantine); }
.af-badge-INFO { background: rgba(56,189,248,0.16); color: var(--accent-primary); border: 1px solid var(--accent-primary); }
.af-hash-pill {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--accent-primary);
}
.af-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}
.af-table th, .af-table td {
  border-bottom: 1px solid var(--border-subtle);
  padding: 10px 12px;
  text-align: left;
}
.af-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.af-input, .af-textarea, .af-select {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 8px 12px;
  border-radius: 6px;
  font-family: var(--font-sans);
}
.af-btn {
  background: var(--accent-primary);
  color: #030712;
  border: none;
  padding: 9px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.af-btn-danger {
  background: var(--status-fail);
  color: #FFFFFF;
}
`.trim();
}
