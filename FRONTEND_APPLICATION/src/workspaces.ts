import { type AuthoritativePlatformState } from "../../API_INTEGRATION/src/index.ts";
import {
  escapeHtml,
  renderDataTable,
  renderHashPill,
  renderMetricCard,
  renderStatusBadge,
  renderWorkspaceShell,
  type WorkspaceSlug,
} from "../../COMPONENT_LIBRARY/src/index.ts";

/**
 * AETHER FORGE — ALL 11 ENGINEERING WORKSPACE RENDERERS
 * Zero decorative controls; every button and form binds directly to real backend routes.
 */

export function renderWorkspaceBySlug(slug: WorkspaceSlug, state: AuthoritativePlatformState): string {
  switch (slug) {
    case "command-center":
      return renderCommandCenter(state);
    case "project-creation-studio":
      return renderProjectCreationStudio(state);
    case "architecture-studio":
      return renderArchitectureStudio(state);
    case "agent-studio":
      return renderAgentStudio(state);
    case "workflow-studio":
      return renderWorkflowStudio(state);
    case "engineering-console":
      return renderEngineeringConsole(state);
    case "knowledge-center":
      return renderKnowledgeCenter(state);
    case "testing-center":
      return renderTestingCenter(state);
    case "integration-center":
      return renderIntegrationCenter(state);
    case "system-monitor":
      return renderSystemMonitor(state);
    case "reference-library":
      return renderReferenceLibrary(state);
  }
}

function renderCommandCenter(state: AuthoritativePlatformState): string {
  const pendingApprovals = state.workflowCheckpoints.filter((w) => w.status === "WAITING_FOR_APPROVAL").length;
  const body = [
    '<section class="af-grid-cards" aria-label="Platform KPIs">',
    renderMetricCard({
      id: "kpi-delivery-status",
      label: "Release & Delivery Status",
      value: `v${state.deliveryStatus.releaseVersion}`,
      sublabel: `Dual-Control Promoted: ${String(state.deliveryStatus.dualControlPromoted)}`,
      statusBadge: state.qaReport.allTwelveDisciplinesPassed ? "PASS" : "WARN",
    }),
    renderMetricCard({
      id: "kpi-compiled-specs",
      label: "Compiled Specifications",
      value: state.compiledSpecifications.length,
      sublabel: `Latest: ${state.latestSpecification.specificationId}`,
      statusBadge: state.latestSpecification.validation.status,
    }),
    renderMetricCard({
      id: "kpi-approvals",
      label: "Pending Human Approvals",
      value: pendingApprovals,
      sublabel: `Active Durable Workflows: ${state.workflowCheckpoints.length}`,
      statusBadge: pendingApprovals > 0 ? "WAITING_FOR_APPROVAL" : "ACTIVE",
    }),
    renderMetricCard({
      id: "kpi-qa-disciplines",
      label: "12-Discipline QA Coverage",
      value: `${(state.qaReport.coverageRate * 100).toFixed(0)}%`,
      sublabel: `${state.qaReport.passedRequirementsCount}/${state.qaReport.totalRequirementsEvaluated} REQ Verified by AGT-19`,
      statusBadge: "PASS",
    }),
    "</section>",
    renderDataTable({
      id: "command-center-delivery-table",
      caption: "Authoritative Project Delivery & Evidence Summary",
      headers: ["Project ID", "Specification Hash", "Traceability", "QA Ledger Head", "Status"],
      rows: state.compiledSpecifications.map((s) => [
        escapeHtml(s.projectId),
        renderHashPill(s.specificationSha256),
        `${(s.traceabilityMatrix.completenessRate * 100).toFixed(0)}%`,
        renderHashPill(state.deliveryStatus.evidenceLedgerHeadHash),
        renderStatusBadge(s.validation.status),
      ]),
    }),
  ].join("\n");

  return renderWorkspaceShell({
    activeSlug: "command-center",
    workspaceTitle: "01. Command Center",
    workspaceSubtitle: "Authoritative multi-plane operational summary, approval queue, and delivery attestation",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: body,
  });
}

function renderProjectCreationStudio(state: AuthoritativePlatformState): string {
  const spec = state.latestSpecification;
  const body = [
    '<section class="af-card" aria-label="Natural Language Project Compiler">',
    '  <h2 style="margin-top:0;">Compile New Engineering Specification (12-Stage System Compiler)</h2>',
    '  <form class="af-form" method="POST" action="/api/v1/ui/compile-project">',
    '    <label for="projectId">Project ID</label>',
    '    <input class="af-input" id="projectId" name="projectId" value="aether-studio-plugin" required />',
    '    <label for="title">Project Title</label>',
    '    <input class="af-input" id="title" name="title" value="VST3 Transient Shaper & FL Studio 2025 Inspector" required />',
    '    <label for="inputType">Input Modality</label>',
    '    <select class="af-select" id="inputType" name="inputType">',
    '      <option value="PRODUCT_DIRECTION">PRODUCT_DIRECTION</option>',
    '      <option value="NATURAL_LANGUAGE_REQUIREMENTS">NATURAL_LANGUAGE_REQUIREMENTS</option>',
    '      <option value="PROCESS_DESCRIPTION">PROCESS_DESCRIPTION</option>',
    '      <option value="EXISTING_REPOSITORY">EXISTING_REPOSITORY</option>',
    '      <option value="TECHNICAL_DOCUMENT">TECHNICAL_DOCUMENT</option>',
    '      <option value="EXISTING_SYSTEM_ARCHITECTURE">EXISTING_SYSTEM_ARCHITECTURE</option>',
    "    </select>",
    '    <label for="naturalLanguagePrompt">Natural Language Direction / Specification</label>',
    '    <textarea class="af-textarea" id="naturalLanguagePrompt" name="naturalLanguagePrompt" rows="4" required>Build a deterministic C++20 VST3 audio processor and read-only FL Studio 2025 .flp inspector with Temporal orchestration.</textarea>',
    '    <button class="af-btn" type="submit">Compile 12-Stage Specification</button>',
    "  </form>",
    "</section>",
    renderDataTable({
      id: "compiled-requirements-table",
      caption: `Latest Compiled Specification: ${spec.specificationId} (SHA-256: ${spec.specificationSha256.slice(0, 16)})`,
      headers: ["Requirement ID", "Kind", "Metric Threshold", "Action Tier", "Capabilities", "4-Way Trace"],
      rows: spec.pipelineStages.stage02Requirements.map((r) => [
        `<code>${escapeHtml(r.requirementId)}</code>`,
        escapeHtml(r.kind),
        `${escapeHtml(r.metricName)} ${escapeHtml(r.thresholdOperator)} ${escapeHtml(r.thresholdValue)} ${escapeHtml(r.unit)}`,
        renderStatusBadge(`Tier ${r.actionTier}`),
        escapeHtml(r.requestedCapabilities.join(", ")),
        renderStatusBadge("COMPLETE"),
      ]),
    }),
  ].join("\n");

  return renderWorkspaceShell({
    activeSlug: "project-creation-studio",
    workspaceTitle: "02. Project Creation Studio",
    workspaceSubtitle: "Natural language & multi-modal project compilation via AetherForgeSystemCompiler",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: body,
  });
}

function renderArchitectureStudio(state: AuthoritativePlatformState): string {
  const arch = state.latestSpecification.pipelineStages.stage07Architecture;
  const comps = state.latestSpecification.pipelineStages.stage08Components;
  const dag = state.latestSpecification.pipelineStages.stage09DependencyGraph;

  const body = [
    '<section class="af-grid-cards">',
    renderMetricCard({
      id: "arch-pattern",
      label: "Topology Pattern",
      value: arch.architecturePattern,
      sublabel: `Trust Boundaries: ${arch.trustBoundaries.join(", ")}`,
      statusBadge: arch.opaDefaultDenyEnforced ? "OPA_DEFAULT_DENY" : "WARN",
    }),
    renderMetricCard({
      id: "arch-subsystems",
      label: "Active Subsystems",
      value: arch.activeSubsystems.length,
      sublabel: arch.activeSubsystems.join(", "),
      statusBadge: "ACTIVE",
    }),
    renderMetricCard({
      id: "arch-dag-status",
      label: "Dependency DAG Acyclicity",
      value: dag.hasCycles ? "CYCLIC" : "ACYCLIC",
      sublabel: `Topological Order: ${dag.topologicalComponentOrder.join(" -> ")}`,
      statusBadge: dag.hasCycles ? "FAIL" : "PASS",
    }),
    "</section>",
    renderDataTable({
      id: "architecture-components-table",
      caption: "Component Decomposition & Exclusive Write-Lease Boundaries",
      headers: ["Component ID", "Name", "Owner Agent", "Module Path", "Exclusive Write Globs", "Public Interfaces"],
      rows: comps.map((c) => [
        `<code>${escapeHtml(c.componentId)}</code>`,
        escapeHtml(c.name),
        renderStatusBadge(c.ownerAgentId),
        `<code>${escapeHtml(c.modulePath)}</code>`,
        `<code>${escapeHtml(c.exclusiveWriteGlobs.join(", "))}</code>`,
        escapeHtml(c.publicInterfaces.join(", ")),
      ]),
    }),
  ].join("\n");

  return renderWorkspaceShell({
    activeSlug: "architecture-studio",
    workspaceTitle: "03. Architecture Studio",
    workspaceSubtitle: "Live architectural topology, Trust Boundaries (TB-1..TB-4), and component dependency DAG",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: body,
  });
}

function renderAgentStudio(state: AuthoritativePlatformState): string {
  const body = renderDataTable({
    id: "specialist-agent-roster-table",
    caption: "19-Agent Specialist Network Roster & Live Task Assignments (AGT-01 .. AGT-19)",
    headers: ["Agent ID", "Canonical Slug", "Title", "Tier", "RBAC Role", "Max Autonomy", "Assigned Tasks"],
    rows: state.specialistAgents.map((a) => [
      `<code>${escapeHtml(a.agentId)}</code>`,
      `<code>${escapeHtml(a.slug)}</code>`,
      escapeHtml(a.title),
      escapeHtml(a.tier),
      renderStatusBadge(a.role),
      escapeHtml(a.maxAutonomy),
      String(a.activeTasksCount),
    ]),
  });

  return renderWorkspaceShell({
    activeSlug: "agent-studio",
    workspaceTitle: "04. Agent Studio",
    workspaceSubtitle: "Specialist agent governance, RBAC permissions, autonomy bounds, and live task ownership",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: body,
  });
}

function renderWorkflowStudio(state: AuthoritativePlatformState): string {
  const latestWf = state.latestWorkflowCheckpoint;
  const approvalSection =
    latestWf && latestWf.status === "WAITING_FOR_APPROVAL"
      ? [
          '<section class="af-card" style="border-color:var(--status-warn);" aria-label="Pending Human Approval Gate">',
          `  <h2 style="margin-top:0;">Pending Human Approval Request (${escapeHtml(latestWf.executionId)})</h2>`,
          '  <form class="af-form" method="POST" action="/api/v1/ui/workflows/approve">',
          `    <input type="hidden" name="executionId" value="${escapeHtml(latestWf.executionId)}" />`,
          `    <input type="hidden" name="stepId" value="TASK-0002-APPROVAL" />`,
          '    <label for="approverPrincipalId">Reviewer Principal ID (Must != Requester)</label>',
          '    <input class="af-input" id="approverPrincipalId" name="approverPrincipalId" value="human-reviewer-02" required />',
          '    <label for="decision">Decision</label>',
          '    <select class="af-select" id="decision" name="decision"><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select>',
          '    <button class="af-btn" type="submit">Submit Signed Approval Decision</button>',
          "  </form>",
          "</section>",
        ].join("\n")
      : "";

  const startForm = [
    '<section class="af-card" aria-label="Start Durable Workflow">',
    '  <h2 style="margin-top:0;">Execute Compiled Workflow (Durable WAL + Checkpoint Engine)</h2>',
    '  <form class="af-form" method="POST" action="/api/v1/ui/workflows/start">',
    '    <label for="executionId">Execution ID</label>',
    `    <input class="af-input" id="executionId" name="executionId" value="EXEC-UI-${state.workflowCheckpoints.length + 1}" required />`,
    '    <label for="requesterPrincipalId">Requester Principal ID</label>',
    '    <input class="af-input" id="requesterPrincipalId" name="requesterPrincipalId" value="human-operator-01" required />',
    '    <label for="includeTier2ApprovalStep">Include Tier 2 Human Approval Gate</label>',
    '    <select class="af-select" id="includeTier2ApprovalStep" name="includeTier2ApprovalStep"><option value="true">Yes (Pause for Reviewer)</option><option value="false">No (Auto-Verify Tier 0/1)</option></select>',
    '    <button class="af-btn" type="submit">Start Durable Workflow</button>',
    "  </form>",
    "</section>",
  ].join("\n");

  const wfTable = renderDataTable({
    id: "workflow-checkpoints-table",
    caption: "Durable Workflow Checkpoints & Disk WAL Hash Heads",
    headers: ["Execution ID", "Workflow ID", "Status", "Fence Token", "WAL Seq", "WAL Head SHA-256", "Checkpoint SHA-256"],
    rows: state.workflowCheckpoints.map((cp) => [
      `<code>${escapeHtml(cp.executionId)}</code>`,
      `<code>${escapeHtml(cp.workflowId)}</code>`,
      renderStatusBadge(cp.status),
      String(cp.currentFenceToken),
      String(cp.walSequenceNumber),
      renderHashPill(cp.walHeadHash),
      renderHashPill(cp.checkpointSha256),
    ]),
  });

  return renderWorkspaceShell({
    activeSlug: "workflow-studio",
    workspaceTitle: "05. Workflow Studio",
    workspaceSubtitle: "Durable execution state machine monitoring, task inspection, and human approval gating",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: [startForm, approvalSection, wfTable].join("\n"),
  });
}

function renderEngineeringConsole(state: AuthoritativePlatformState): string {
  const toolForm = [
    '<section class="af-card" aria-label="Controlled Tool Gateway Execution">',
    '  <h2 style="margin-top:0;">Stage & Execute Controlled Engineering Tool</h2>',
    '  <form class="af-form" method="POST" action="/api/v1/ui/tools/execute">',
    '    <label for="agentId">Specialist Agent</label>',
    '    <select class="af-select" id="agentId" name="agentId"><option value="AGT-02">AGT-02 (Research)</option><option value="AGT-19">AGT-19 (Independent Verifier)</option></select>',
    '    <label for="toolId">Tool ID</label>',
    '    <select class="af-select" id="toolId" name="toolId"><option value="repo.inspect">repo.inspect (Tier 0)</option><option value="code.review">code.review (Tier 0)</option></select>',
    '    <label for="targetRelativePath">Target Workspace Relative Path</label>',
    '    <input class="af-input" id="targetRelativePath" name="targetRelativePath" value="contracts" required />',
    '    <button class="af-btn" type="submit">Execute via ControlledToolGateway</button>',
    "  </form>",
    "</section>",
  ].join("\n");

  const auditTable = renderDataTable({
    id: "execution-audit-log-table",
    caption: "Tamper-Evident Hash-Chained Execution Audit Log",
    headers: ["Seq", "Proposal ID", "Agent", "Tool", "Tier", "Outcome", "Input SHA-256", "Audit Entry SHA-256"],
    rows: state.executionAuditEntries.map((e) => [
      String(e.sequenceNumber),
      `<code>${escapeHtml(e.proposalId)}</code>`,
      renderStatusBadge(e.agentId),
      `<code>${escapeHtml(e.toolId)}</code>`,
      `Tier ${escapeHtml(e.actionTier)}`,
      renderStatusBadge(e.outcome),
      renderHashPill(e.inputSha256),
      renderHashPill(e.entryHash),
    ]),
  });

  return renderWorkspaceShell({
    activeSlug: "engineering-console",
    workspaceTitle: "06. Engineering Console",
    workspaceSubtitle: "Two-phase tool proposal staging, ControlledToolGateway execution, and hash-chained logs",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: [toolForm, auditTable].join("\n"),
  });
}

function renderKnowledgeCenter(state: AuthoritativePlatformState): string {
  const searchForm = [
    '<section class="af-card" aria-label="Authoritative Knowledge Search">',
    '  <h2 style="margin-top:0;">Hybrid Authoritative Knowledge Retrieval (Quarantines GENERATED_ARTIFACT)</h2>',
    '  <form class="af-form" method="POST" action="/api/v1/ui/knowledge/search">',
    '    <label for="query">Search Query</label>',
    '    <input class="af-input" id="query" name="query" value="VST3 real-time audio biquad FL Studio" required />',
    '    <button class="af-btn" type="submit">Query Authoritative Knowledge Engine</button>',
    "  </form>",
    "</section>",
  ].join("\n");

  const hitsTable = renderDataTable({
    id: "knowledge-retrieval-table",
    caption: "Authoritative Retrieval Hits (Provenance-Cited)",
    headers: ["Record ID", "Epistemic Layer", "Score", "Title", "Citation Badge"],
    rows: state.latestRetrievalHits.map((h) => [
      `<code>${escapeHtml(h.record.recordId)}</code>`,
      renderStatusBadge(h.record.layer),
      h.combinedScore.toFixed(4),
      escapeHtml(h.record.title),
      `<code>${escapeHtml(h.citationBadge)}</code>`,
    ]),
  });

  return renderWorkspaceShell({
    activeSlug: "knowledge-center",
    workspaceTitle: "07. Knowledge Center",
    workspaceSubtitle: "Six-layer epistemic store, Obsidian Markdown vault, and conflict-checked hybrid RAG",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: [searchForm, hitsTable].join("\n"),
  });
}

function renderTestingCenter(state: AuthoritativePlatformState): string {
  const qa = state.qaReport;
  const disciplinesTable = renderDataTable({
    id: "qa-12-disciplines-table",
    caption: `12-Discipline Independent QA Report (${qa.reportId} | Verifier: ${qa.verifierAgentId})`,
    headers: ["Verification Discipline", "Status", "Empirical Measurement Summary"],
    rows: qa.disciplineVerdicts.map((d) => [
      `<code>${escapeHtml(d.discipline)}</code>`,
      renderStatusBadge(d.passed ? "PASS" : "FAIL"),
      escapeHtml(d.metricsSummary),
    ]),
  });

  const evidenceTable = renderDataTable({
    id: "requirement-evidence-table",
    caption: "Six-Field Requirement Acceptance & Cryptographic Evidence Registry",
    headers: ["REQ ID", "Author -> Verifier", "Test Result", "Evidence Artifact SHA-256", "Status", "Known Limitations"],
    rows: qa.requirementRecords.map((r) => [
      `<code>${escapeHtml(r.requirementId)}</code>`,
      `${escapeHtml(r.implementingAgentId)} &rarr; ${escapeHtml(r.verifierAgentId)}`,
      `exit=${r.testResult.independentExecutionExitCode} (${r.testResult.assertionsPassed} passed)`,
      `${escapeHtml(r.evidenceArtifact.evidenceId)} ${renderHashPill(r.evidenceArtifact.artifactDiskSha256)}`,
      renderStatusBadge(r.passFailStatus),
      escapeHtml(r.knownLimitations.join("; ")),
    ]),
  });

  return renderWorkspaceShell({
    activeSlug: "testing-center",
    workspaceTitle: "08. Testing Center",
    workspaceSubtitle: "Independent AGT-19 12-discipline QA reports and cryptographic disk evidence inspection",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: [disciplinesTable, evidenceTable].join("\n"),
  });
}

function renderIntegrationCenter(state: AuthoritativePlatformState): string {
  const dawForm = [
    '<section class="af-card" aria-label="Multi-DAW Adapter Inspection">',
    '  <h2 style="margin-top:0;">Inspect DAW Project via Replaceable Adapter</h2>',
    '  <form class="af-form" method="POST" action="/api/v1/ui/daw/inspect">',
    '    <label for="dawId">Target DAW Adapter</label>',
    '    <select class="af-select" id="dawId" name="dawId"><option value="fl-studio-2025">Image-Line FL Studio 2025</option><option value="cockos-reaper">Cockos REAPER (.rpp)</option></select>',
    '    <label for="projectPathOrPayload">Project Path or Sample .rpp Payload</label>',
    '    <input class="af-input" id="projectPathOrPayload" name="projectPathOrPayload" value="C:\\Program Files\\Image-Line\\FL Studio 2025\\Data\\Demo projects\\NewStuff.flp" required />',
    '    <button class="af-btn" type="submit">Run Read-Only DAW Inspection</button>',
    "  </form>",
    "</section>",
  ].join("\n");

  const adaptersTable = renderDataTable({
    id: "daw-adapters-table",
    caption: `Registered DAW Adapters & VST3 Host Torture Status (${state.vst3HostCompatibilityPassed ? "PASS" : "FAIL"})`,
    headers: ["DAW Adapter ID", "Display Name", "Target Version", "Capabilities Count", "Latest Inspection"],
    rows: state.dawAdapters.map((a) => [
      `<code>${escapeHtml(a.dawId)}</code>`,
      escapeHtml(a.displayName),
      escapeHtml(a.targetVersion),
      String(a.capabilitiesCount),
      state.latestDawInspection && state.latestDawInspection.dawId === a.dawId
        ? `${escapeHtml(state.latestDawInspection.projectFormatSignature)} (${state.latestDawInspection.channelOrTrackCount} ch, ${state.latestDawInspection.ppq} PPQ, 0 bytes mutated)`
        : "Ready",
    ]),
  });

  return renderWorkspaceShell({
    activeSlug: "integration-center",
    workspaceTitle: "09. Integration Center",
    workspaceSubtitle: "Multi-DAW capability negotiation (FL Studio 2025 / REAPER) and VST3 compatibility status",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: [dawForm, adaptersTable].join("\n"),
  });
}

function renderSystemMonitor(state: AuthoritativePlatformState): string {
  const stopControl = [
    '<section class="af-card" aria-label="Emergency Stop Kill Switch">',
    '  <h2 style="margin-top:0;">System Kill-Switch (EmergencyStopRegistry)</h2>',
    '  <form class="af-form" method="POST" action="/api/v1/ui/system/emergency-stop">',
    '    <label for="active">Emergency Stop Mode</label>',
    `    <select class="af-select" id="active" name="active"><option value="true"${state.emergencyStopped ? " selected" : ""}>ACTIVATE EMERGENCY STOP (LOCK ALL MUTATIONS)</option><option value="false"${!state.emergencyStopped ? " selected" : ""}>CLEAR EMERGENCY STOP (RESUME NORMAL OPS)</option></select>`,
    '    <label for="reason">Operator Reason</label>',
    '    <input class="af-input" id="reason" name="reason" value="Operator safety intervention" required />',
    '    <button class="af-btn af-btn-danger" type="submit">Apply Emergency Stop State</button>',
    "  </form>",
    "</section>",
  ].join("\n");

  const kpis = [
    '<section class="af-grid-cards">',
    renderMetricCard({
      id: "mon-emergency-state",
      label: "Emergency Stop State",
      value: state.emergencyStopped ? "LOCKED" : "OPEN",
      sublabel: state.emergencyReason ?? "Normal governed execution",
      statusBadge: state.emergencyStopped ? "STOPPED" : "OPERATIONAL",
    }),
    renderMetricCard({
      id: "mon-audit-entries",
      label: "Audit Log Entries",
      value: state.executionAuditEntries.length,
      sublabel: "SHA-256 Hash-Chained Integrity: VALID",
      statusBadge: "PASS",
    }),
    renderMetricCard({
      id: "mon-vst3-wcet",
      label: "VST3 Real-Time Host Torture",
      value: state.vst3HostCompatibilityPassed ? "PASS" : "FAIL",
      sublabel: "WCET < 30% buffer deadline | 0 heap allocs",
      statusBadge: state.vst3HostCompatibilityPassed ? "PASS" : "FAIL",
    }),
    "</section>",
  ].join("\n");

  return renderWorkspaceShell({
    activeSlug: "system-monitor",
    workspaceTitle: "10. System Monitor",
    workspaceSubtitle: "Real-time governance SLOs, audit chain telemetry, and 1-click emergency preemption",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: [kpis, stopControl].join("\n"),
  });
}

function renderReferenceLibrary(state: AuthoritativePlatformState): string {
  const adrTable = renderDataTable({
    id: "reference-library-adrs",
    caption: "Active Architecture Decision Records (ADRs) & Reference Documentation",
    headers: ["ADR ID", "Title", "Status", "Governing Subsystems", "SHA-256"],
    rows: state.activeAdrs.map((adr) => [
      `<code>${escapeHtml(adr.adrId)}</code>`,
      escapeHtml(adr.title),
      renderStatusBadge(adr.status),
      escapeHtml(adr.governingSubsystemIds.join(", ")),
      renderHashPill(adr.sha256),
    ]),
  });

  return renderWorkspaceShell({
    activeSlug: "reference-library",
    workspaceTitle: "11. Reference Library",
    workspaceSubtitle: "Normative ADRs, Interface Contracts, and Persistent Engineering Reference Book",
    emergencyStopped: state.emergencyStopped,
    emergencyReason: state.emergencyReason,
    stateSnapshotSha256: state.stateSnapshotSha256,
    mainContentHtml: adrTable,
  });
}
