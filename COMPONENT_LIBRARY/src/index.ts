import {
  generateAetherStudioStylesheet,
  mapStatusToBadgeTone,
} from "../../DESIGN_SYSTEM/src/index.ts";

/**
 * AETHER FORGE — ACCESSIBLE COMPONENT LIBRARY (v1.0.0)
 * Zero-XSS semantic HTML primitives bound exclusively to authoritative backend state.
 */

export const WORKSPACE_NAVIGATION_ITEMS = [
  { slug: "command-center", number: 1, title: "Command Center", route: "/workspaces/command-center" },
  { slug: "project-creation-studio", number: 2, title: "Project Creation Studio", route: "/workspaces/project-creation-studio" },
  { slug: "architecture-studio", number: 3, title: "Architecture Studio", route: "/workspaces/architecture-studio" },
  { slug: "agent-studio", number: 4, title: "Agent Studio", route: "/workspaces/agent-studio" },
  { slug: "workflow-studio", number: 5, title: "Workflow Studio", route: "/workspaces/workflow-studio" },
  { slug: "engineering-console", number: 6, title: "Engineering Console", route: "/workspaces/engineering-console" },
  { slug: "knowledge-center", number: 7, title: "Knowledge Center", route: "/workspaces/knowledge-center" },
  { slug: "testing-center", number: 8, title: "Testing Center", route: "/workspaces/testing-center" },
  { slug: "integration-center", number: 9, title: "Integration Center", route: "/workspaces/integration-center" },
  { slug: "system-monitor", number: 10, title: "System Monitor", route: "/workspaces/system-monitor" },
  { slug: "reference-library", number: 11, title: "Reference Library", route: "/workspaces/reference-library" },
] as const;

export type WorkspaceSlug = (typeof WORKSPACE_NAVIGATION_ITEMS)[number]["slug"];

export function escapeHtml(raw: string | number | boolean | null | undefined): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderStatusBadge(statusText: string): string {
  const tone = mapStatusToBadgeTone(statusText);
  return `<span class="af-badge af-badge-${tone}" data-status="${escapeHtml(statusText)}">${escapeHtml(statusText)}</span>`;
}

export function renderHashPill(sha256: string, prefixLen = 16): string {
  const clean = String(sha256);
  const short = clean.slice(0, prefixLen);
  return `<code class="af-hash-pill" title="SHA-256: ${escapeHtml(clean)}">${escapeHtml(short)}</code>`;
}

export function renderMetricCard(params: {
  id: string;
  label: string;
  value: string | number;
  sublabel: string;
  statusBadge?: string;
}): string {
  return [
    `<article class="af-card" id="${escapeHtml(params.id)}" aria-label="${escapeHtml(params.label)}">`,
    `  <div style="display:flex;justify-content:space-between;align-items:center;">`,
    `    <span style="color:var(--text-secondary);font-size:0.82rem;font-weight:600;">${escapeHtml(params.label)}</span>`,
    params.statusBadge ? `    ${renderStatusBadge(params.statusBadge)}` : "",
    `  </div>`,
    `  <div style="font-size:1.55rem;font-weight:700;margin:8px 0;font-family:var(--font-mono);">${escapeHtml(params.value)}</div>`,
    `  <div style="color:var(--text-secondary);font-size:0.78rem;">${escapeHtml(params.sublabel)}</div>`,
    `</article>`,
  ].join("\n");
}

export function renderDataTable(params: {
  id: string;
  caption: string;
  headers: string[];
  rows: string[][]; // Pre-escaped or component HTML cells
}): string {
  const headerCells = params.headers
    .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
    .join("");
  const bodyRows = params.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("\n");

  return [
    `<div class="af-card">`,
    `  <table class="af-table" id="${escapeHtml(params.id)}">`,
    `    <caption style="text-align:left;font-weight:600;margin-bottom:10px;color:var(--text-primary);">${escapeHtml(params.caption)}</caption>`,
    `    <thead><tr>${headerCells}</tr></thead>`,
    `    <tbody>${bodyRows}</tbody>`,
    `  </table>`,
    `</div>`,
  ].join("\n");
}

export function renderWorkspaceShell(params: {
  activeSlug: WorkspaceSlug;
  workspaceTitle: string;
  workspaceSubtitle: string;
  emergencyStopped: boolean;
  emergencyReason: string | null;
  stateSnapshotSha256: string;
  mainContentHtml: string;
}): string {
  const navLinks = WORKSPACE_NAVIGATION_ITEMS.map((item) => {
    const isCurrent = item.slug === params.activeSlug ? ' aria-current="page"' : "";
    return `<li><a class="af-nav-link" href="${item.route}"${isCurrent}>${String(item.number).padStart(2, "0")}. ${escapeHtml(item.title)}</a></li>`;
  }).join("\n");

  const emergencyBanner = params.emergencyStopped
    ? `<div role="alert" aria-live="assertive" class="af-card" style="border-color:var(--status-fail);background:rgba(239,68,68,0.14);"><strong>EMERGENCY STOP ACTIVE (HTTP 423):</strong> All mutating operations preempted — Reason: ${escapeHtml(params.emergencyReason ?? "Operator triggered")}</div>`
    : `<div role="status" aria-live="polite" style="font-size:0.8rem;color:var(--text-secondary);">Authoritative Backend State SHA-256: ${renderHashPill(params.stateSnapshotSha256)} | Zero-Trust OPA Gate: ${renderStatusBadge("ACTIVE")}</div>`;

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>AETHER FORGE — ${escapeHtml(params.workspaceTitle)}</title>`,
    `  <style>${generateAetherStudioStylesheet()}</style>`,
    "</head>",
    "<body>",
    '  <div class="af-shell">',
    '    <aside class="af-sidebar" aria-label="Workspace Navigation">',
    '      <div class="af-brand">AETHER FORGE v1.0.0</div>',
    '      <nav aria-label="11 Engineering Workspaces">',
    `        <ul class="af-nav-list">${navLinks}</ul>`,
    "      </nav>",
    "    </aside>",
    '    <main class="af-main" id="main-workspace-content">',
    '      <header class="af-header">',
    "        <div>",
    `          <h1 style="margin:0;font-size:1.4rem;">${escapeHtml(params.workspaceTitle)}</h1>`,
    `          <p style="margin:4px 0 0 0;color:var(--text-secondary);font-size:0.88rem;">${escapeHtml(params.workspaceSubtitle)}</p>`,
    "        </div>",
    `        <div>${renderStatusBadge(params.emergencyStopped ? "WORKSPACE_LOCKED_EMERGENCY_STOP" : "SYSTEM_OPERATIONAL")}</div>`,
    "      </header>",
    `      ${emergencyBanner}`,
    `      ${params.mainContentHtml}`,
    "    </main>",
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
}
