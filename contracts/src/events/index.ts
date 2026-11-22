import { z } from "zod";
import {
  ApprovalSchema,
  AuditEventSchema,
  BriefSchema,
  EvidenceRefSchema,
  ExecutionPlanSchema,
  IsoUtcTimestampSchema,
  NonEmptyIdSchema,
  ProductSpecSchema,
} from "../domain/index.ts";
import { JobReceiptSchema, WorkerJobSchema } from "../worker/index.ts";

export const EVENT_NAMES = {
  BRIEF_SUBMITTED: "aetherforge.brief.submitted.v1",
  SPEC_CREATED: "aetherforge.spec.created.v1",
  PLAN_PROPOSED: "aetherforge.plan.proposed.v1",
  POLICY_EVALUATED: "aetherforge.policy.evaluated.v1",
  APPROVAL_REQUESTED: "aetherforge.approval.requested.v1",
  APPROVAL_DECIDED: "aetherforge.approval.decided.v1",
  WORKFLOW_STARTED: "aetherforge.workflow.started.v1",
  WORKER_JOB_DISPATCHED: "aetherforge.worker.job.dispatched.v1",
  WORKER_JOB_COMPLETED: "aetherforge.worker.job.completed.v1",
  EVIDENCE_RECORDED: "aetherforge.evidence.recorded.v1",
  EMERGENCY_STOP_TRIGGERED: "aetherforge.system.emergency_stop.triggered.v1",
} as const;

export const EventNameSchema = z.enum([
  EVENT_NAMES.BRIEF_SUBMITTED,
  EVENT_NAMES.SPEC_CREATED,
  EVENT_NAMES.PLAN_PROPOSED,
  EVENT_NAMES.POLICY_EVALUATED,
  EVENT_NAMES.APPROVAL_REQUESTED,
  EVENT_NAMES.APPROVAL_DECIDED,
  EVENT_NAMES.WORKFLOW_STARTED,
  EVENT_NAMES.WORKER_JOB_DISPATCHED,
  EVENT_NAMES.WORKER_JOB_COMPLETED,
  EVENT_NAMES.EVIDENCE_RECORDED,
  EVENT_NAMES.EMERGENCY_STOP_TRIGGERED,
]);
export type EventName = z.infer<typeof EventNameSchema>;

export type CloudEventEnvelope<T> = {
  specversion: "1.0";
  id: string;
  source: string;
  type: EventName;
  time: string;
  datacontenttype: "application/json";
  subject?: string | undefined;
  traceparent: string;
  tenantid: string;
  idempotencykey: string;
  data: T;
};

export function createCloudEventSchema<T extends z.ZodType<unknown>>(
  eventType: EventName,
  dataSchema: T,
): z.ZodType<CloudEventEnvelope<z.infer<T>>> {
  return z.object({
    specversion: z.literal("1.0"),
    id: NonEmptyIdSchema,
    source: z.string().min(1).max(256),
    type: z.literal(eventType),
    time: IsoUtcTimestampSchema,
    datacontenttype: z.literal("application/json"),
    subject: z.string().min(1).max(256).optional(),
    traceparent: z
      .string()
      .regex(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/, "Expected W3C traceparent"),
    tenantid: NonEmptyIdSchema,
    idempotencykey: NonEmptyIdSchema,
    data: dataSchema,
  }) as unknown as z.ZodType<CloudEventEnvelope<z.infer<T>>>;
}

export const BriefSubmittedEventSchema = createCloudEventSchema(
  EVENT_NAMES.BRIEF_SUBMITTED,
  BriefSchema,
);
export const SpecCreatedEventSchema = createCloudEventSchema(
  EVENT_NAMES.SPEC_CREATED,
  ProductSpecSchema,
);
export const PlanProposedEventSchema = createCloudEventSchema(
  EVENT_NAMES.PLAN_PROPOSED,
  ExecutionPlanSchema,
);
export const ApprovalDecidedEventSchema = createCloudEventSchema(
  EVENT_NAMES.APPROVAL_DECIDED,
  ApprovalSchema,
);
export const WorkerJobDispatchedEventSchema = createCloudEventSchema(
  EVENT_NAMES.WORKER_JOB_DISPATCHED,
  WorkerJobSchema,
);
export const WorkerJobCompletedEventSchema = createCloudEventSchema(
  EVENT_NAMES.WORKER_JOB_COMPLETED,
  JobReceiptSchema,
);
export const EvidenceRecordedEventSchema = createCloudEventSchema(
  EVENT_NAMES.EVIDENCE_RECORDED,
  EvidenceRefSchema,
);
export const EmergencyStopTriggeredEventSchema = createCloudEventSchema(
  EVENT_NAMES.EMERGENCY_STOP_TRIGGERED,
  AuditEventSchema,
);
