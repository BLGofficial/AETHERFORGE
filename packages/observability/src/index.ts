import { randomBytes } from "node:crypto";
import type { AuditEvent, EvidenceRef } from "@aether-forge/contracts";

export type TelemetryBoundary = "web" | "api" | "temporal" | "worker" | "adapter";

export interface OtelSpanRecord {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string | undefined;
  readonly traceparent: string;
  readonly boundary: TelemetryBoundary;
  readonly operationName: string;
  readonly tenantId: string;
  readonly projectId?: string | undefined;
  readonly startedAtIso: string;
  readonly durationMs: number;
  readonly status: "OK" | "ERROR";
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export function formatW3cTraceparent(traceId: string, spanId: string): string {
  const cleanTrace = traceId.replace(/[^a-f0-9]/gi, "").padEnd(32, "0").slice(0, 32).toLowerCase();
  const cleanSpan = spanId.replace(/[^a-f0-9]/gi, "").padEnd(16, "0").slice(0, 16).toLowerCase();
  return `00-${cleanTrace}-${cleanSpan}-01`;
}

export function parseW3cTraceparent(
  traceparent: string,
): { readonly traceId: string; readonly parentSpanId: string } | undefined {
  const match = /^00-([a-f0-9]{32})-([a-f0-9]{16})-[a-f0-9]{2}$/.exec(traceparent);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return {
    traceId: match[1],
    parentSpanId: match[2],
  };
}

/**
 * OpenTelemetry W3C Trace Context collector propagating traceId across
 * web -> api -> temporal -> worker -> adapter boundaries.
 */
export class OtelTraceCollector {
  private readonly spans: OtelSpanRecord[] = [];

  public recordSpan(params: {
    readonly traceId: string;
    readonly parentTraceparent?: string | undefined;
    readonly boundary: TelemetryBoundary;
    readonly operationName: string;
    readonly tenantId: string;
    readonly projectId?: string | undefined;
    readonly durationMs?: number;
    readonly status?: "OK" | "ERROR";
    readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  }): OtelSpanRecord {
    const parsedParent = params.parentTraceparent
      ? parseW3cTraceparent(params.parentTraceparent)
      : undefined;
    const effectiveTraceId = parsedParent?.traceId ?? params.traceId;
    const spanId = randomBytes(8).toString("hex");
    const traceparent = formatW3cTraceparent(effectiveTraceId, spanId);

    const span: OtelSpanRecord = {
      traceId: effectiveTraceId,
      spanId,
      ...(parsedParent ? { parentSpanId: parsedParent.parentSpanId } : {}),
      traceparent,
      boundary: params.boundary,
      operationName: params.operationName,
      tenantId: params.tenantId,
      ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
      startedAtIso: new Date().toISOString(),
      durationMs: params.durationMs ?? 2,
      status: params.status ?? "OK",
      attributes: params.attributes ?? {},
    };
    this.spans.push(span);
    return span;
  }

  public getSpansByTraceId(tenantId: string, traceId: string): readonly OtelSpanRecord[] {
    return this.spans.filter((s) => s.tenantId === tenantId && s.traceId === traceId);
  }
}

export interface AlertFiring {
  readonly alertId:
    | "ALERT_FORGED_MANIFEST_DETECTED"
    | "ALERT_EMERGENCY_STOP_ACTIVE"
    | "ALERT_PROVIDER_OUTAGE"
    | "ALERT_POLICY_DENIAL_SPIKE"
    | "ALERT_ARTIFACT_TAMPER_DETECTED";
  readonly severity: "CRITICAL" | "HIGH";
  readonly summary: string;
  readonly traceId: string;
  readonly firedAtIso: string;
}

export class ObservabilityMetricsEngine {
  private readonly counters = new Map<string, number>();
  private readonly alerts: AlertFiring[] = [];

  public incrementCounter(metricName: string, delta = 1): number {
    const next = (this.counters.get(metricName) ?? 0) + delta;
    this.counters.set(metricName, next);
    return next;
  }

  public getCounter(metricName: string): number {
    return this.counters.get(metricName) ?? 0;
  }

  public fireAlert(params: Omit<AlertFiring, "firedAtIso">): AlertFiring {
    const alert: AlertFiring = {
      ...params,
      firedAtIso: new Date().toISOString(),
    };
    this.alerts.push(alert);
    return alert;
  }

  public getAlerts(): readonly AlertFiring[] {
    return this.alerts;
  }
}

export interface CorrelatedJobDashboardView {
  readonly tenantId: string;
  readonly traceId: string;
  readonly coveredBoundaries: readonly TelemetryBoundary[];
  readonly allFiveBoundariesCorrelated: boolean;
  readonly spanCount: number;
  readonly auditEventCount: number;
  readonly evidenceCount: number;
  readonly spans: readonly OtelSpanRecord[];
  readonly auditTimeline: readonly AuditEvent[];
  readonly evidenceList: readonly EvidenceRef[];
}

const REQUIRED_BOUNDARIES: readonly TelemetryBoundary[] = [
  "web",
  "api",
  "temporal",
  "worker",
  "adapter",
];

/**
 * Correlates one end-to-end governed job across all 5 runtime boundaries,
 * audit events, and execution evidence references.
 */
export function correlateEndToEndJobDashboard(params: {
  readonly tenantId: string;
  readonly traceId: string;
  readonly traceCollector: OtelTraceCollector;
  readonly auditEvents: readonly AuditEvent[];
  readonly evidence: readonly EvidenceRef[];
}): CorrelatedJobDashboardView {
  const spans = params.traceCollector.getSpansByTraceId(params.tenantId, params.traceId);
  const matchingAudit = params.auditEvents.filter(
    (a) => a.tenantId === params.tenantId && a.traceId === params.traceId,
  );
  const matchingEvidence = params.evidence.filter((e) => e.traceId === params.traceId);

  const coveredSet = new Set<TelemetryBoundary>(spans.map((s) => s.boundary));
  const coveredBoundaries = REQUIRED_BOUNDARIES.filter((b) => coveredSet.has(b));

  return {
    tenantId: params.tenantId,
    traceId: params.traceId,
    coveredBoundaries,
    allFiveBoundariesCorrelated: coveredBoundaries.length === REQUIRED_BOUNDARIES.length,
    spanCount: spans.length,
    auditEventCount: matchingAudit.length,
    evidenceCount: matchingEvidence.length,
    spans,
    auditTimeline: matchingAudit,
    evidenceList: matchingEvidence,
  };
}
