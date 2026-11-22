import type { AuditEvent } from "@aether-forge/sdk";
import type { GovernedWorkflowState } from "@aether-forge/orchestration";

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface WebControlPlaneViewModel {
  readonly tenantId: string;
  readonly projectId: string;
  readonly workflow?: GovernedWorkflowState | undefined;
  readonly auditTimeline: readonly AuditEvent[];
  readonly errorBanner?: string | undefined;
}

/**
 * Renders the 4 governed Web Control Plane screens:
 * 1. Brief Submission Screen
 * 2. Plan Review & Policy Explanation Screen
 * 3. Approval & Emergency Stop Screen
 * 4. Evidence & Audit Timeline Screen
 */
export function renderControlPlaneDashboardHtml(vm: WebControlPlaneViewModel): string {
  const wf = vm.workflow;

  const errorHtml = vm.errorBanner
    ? `<div role="alert" data-testid="error-banner">${escapeHtml(vm.errorBanner)}</div>`
    : "";

  const planReviewHtml = wf
    ? `<section aria-labelledby="heading-plan-review" data-testid="screen-plan-review">
        <h2 id="heading-plan-review">2. Plan Review &amp; Policy Evaluation</h2>
        <p><strong>Plan ID:</strong> <span data-testid="plan-id">${escapeHtml(wf.plan.planId)}</span></p>
        <p><strong>Plan Hash (SHA-256):</strong> <code data-testid="plan-hash">${escapeHtml(wf.plan.planHash)}</code></p>
        <p><strong>Policy Version:</strong> <code data-testid="policy-version">${escapeHtml(wf.plan.policyVersion)}</code></p>
        <table>
          <thead>
            <tr>
              <th>Step ID</th>
              <th>Action Class</th>
              <th>Policy Decision</th>
              <th>User Policy Explanation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${wf.stepEvaluations
              .map((ev) => {
                const executed = wf.executedStepIds.includes(ev.step.stepId);
                return `<tr data-testid="plan-step-${escapeHtml(ev.step.stepId)}">
                  <td>${escapeHtml(ev.step.stepId)}</td>
                  <td><code>${escapeHtml(ev.step.actionClass)}</code></td>
                  <td data-testid="decision-${escapeHtml(ev.step.stepId)}">${escapeHtml(ev.policyDecision.decision)}</td>
                  <td data-testid="explanation-${escapeHtml(ev.step.stepId)}">${escapeHtml(ev.policyDecision.userExplanation)}</td>
                  <td data-testid="step-status-${escapeHtml(ev.step.stepId)}">${executed ? "EXECUTED" : "PENDING"}</td>
                </tr>`;
              })
              .join("\n")}
          </tbody>
        </table>
      </section>`
    : `<section aria-labelledby="heading-plan-review" data-testid="screen-plan-review">
        <h2 id="heading-plan-review">2. Plan Review &amp; Policy Evaluation</h2>
        <p>Submit a brief to generate a governed specification and execution plan.</p>
      </section>`;

  const approvalScreenHtml = wf
    ? `<section aria-labelledby="heading-approval" data-testid="screen-approval">
        <h2 id="heading-approval">3. Approval Gate &amp; Emergency Stop</h2>
        <p><strong>Workflow Status:</strong> <span data-testid="workflow-status">${escapeHtml(wf.status)}</span></p>
        ${
          wf.pendingApprovalId
            ? `<div data-testid="pending-approval-card">
                <p><strong>Pending Approval ID:</strong> <code data-testid="pending-approval-id">${escapeHtml(wf.pendingApprovalId)}</code></p>
                <form method="POST" action="/ui/approve" data-testid="form-approve">
                  <input type="hidden" name="workflowId" value="${escapeHtml(wf.workflowId)}" />
                  <input type="hidden" name="approvalId" value="${escapeHtml(wf.pendingApprovalId)}" />
                  <label for="rationale-input">Approval Rationale</label>
                  <input id="rationale-input" name="rationale" type="text" required value="Verified workspace target path and policy hash binding." />
                  <button type="submit" name="decision" value="APPROVED" data-testid="btn-approve">Approve Step Execution</button>
                  <button type="submit" name="decision" value="REJECTED" data-testid="btn-reject">Reject Step</button>
                </form>
              </div>`
            : `<p data-testid="no-pending-approvals">No pending approvals required.</p>`
        }
        <form method="POST" action="/ui/emergency-stop" data-testid="form-emergency-stop">
          <input type="hidden" name="projectId" value="${escapeHtml(vm.projectId)}" />
          <button type="submit" data-testid="btn-emergency-stop">EMERGENCY STOP</button>
        </form>
      </section>`
    : `<section aria-labelledby="heading-approval" data-testid="screen-approval">
        <h2 id="heading-approval">3. Approval Gate &amp; Emergency Stop</h2>
        <p>No active workflow.</p>
      </section>`;

  const evidenceTimelineHtml = `<section aria-labelledby="heading-evidence" data-testid="screen-evidence-timeline">
    <h2 id="heading-evidence">4. Evidence &amp; Immutable Audit Timeline</h2>
    <p><strong>Simulated Write Count:</strong> <span data-testid="simulated-write-count">${wf ? String(wf.simulatedWriteCount) : "0"}</span></p>
    <h3>Recorded Execution Evidence</h3>
    <ul data-testid="evidence-list">
      ${
        wf && wf.evidence.length > 0
          ? wf.evidence
              .map(
                (e) =>
                  `<li data-testid="evidence-item-${escapeHtml(e.evidenceId)}">
                    <code>${escapeHtml(e.evidenceId)}</code> [${escapeHtml(e.producer)}] —
                    SHA-256: <code>${escapeHtml(e.artifactHash)}</code> —
                    Location: <code>${escapeHtml(e.verifiableLocation)}</code>${e.summary ? ` — ${escapeHtml(e.summary)}` : ""}
                  </li>`,
              )
              .join("\n")
          : `<li>No execution evidence recorded yet.</li>`
      }
    </ul>
    <h3>Correlated Audit Trail</h3>
    <ol data-testid="audit-timeline-list">
      ${vm.auditTimeline
        .map(
          (a) =>
            `<li data-testid="audit-event-${escapeHtml(a.eventId)}" data-event-type="${escapeHtml(a.eventType)}">
              <code>${escapeHtml(a.eventType)}</code> — Outcome: <strong>${escapeHtml(a.outcome)}</strong> —
              Policy: <code>${escapeHtml(a.policyVersion)}</code> —
              Trace: <code>${escapeHtml(a.traceId)}</code>
            </li>`,
        )
        .join("\n")}
    </ol>
  </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AETHER FORGE — Web Control Plane</title>
</head>
<body>
  <header>
    <h1>AETHER FORGE — Governed Control Plane</h1>
    <p>Tenant: <code data-testid="active-tenant">${escapeHtml(vm.tenantId)}</code> · Project: <code data-testid="active-project">${escapeHtml(vm.projectId)}</code></p>
  </header>
  <main>
    ${errorHtml}
    <section aria-labelledby="heading-brief-submission" data-testid="screen-brief-submission">
      <h2 id="heading-brief-submission">1. Submit Governed Brief</h2>
      <form method="POST" action="/ui/submit-brief" data-testid="form-submit-brief">
        <label for="brief-title">Brief Title</label>
        <input id="brief-title" name="title" type="text" required value="Governed Vertical Slice Stem Normalization Brief" />
        <label for="brief-objective">Objective</label>
        <textarea id="brief-objective" name="objective" required>Inspect workspace metadata and execute one approval-gated simulated workspace write with full audit trail.</textarea>
        <label for="brief-constraint">Primary Constraint</label>
        <input id="brief-constraint" name="constraint" type="text" required value="Require explicit approval before any workspace mutation" />
        <button type="submit" data-testid="btn-submit-brief">Submit Brief &amp; Generate Plan</button>
      </form>
    </section>
    ${planReviewHtml}
    ${approvalScreenHtml}
    ${evidenceTimelineHtml}
  </main>
</body>
</html>`;
}
