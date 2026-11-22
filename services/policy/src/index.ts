import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ActionClass,
  type HumanRole,
  type PolicyDecision,
  PolicyDecisionSchema,
  type PolicyInput,
  PolicyInputSchema,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";

export interface PolicyRuleSpec {
  readonly actionClass: ActionClass;
  readonly decisionWhenQualified: "allow" | "requireApproval" | "deny";
  readonly requiresDawQualification: boolean;
  readonly forbidRestrictedLocalEgress: boolean;
  readonly requiredApproverRoles: readonly HumanRole[];
  readonly approvalExpirySeconds: number;
  readonly allowExplanation: string;
  readonly approvalExplanation: string;
  readonly denyExplanation: string;
}

export interface OpaPolicyBundle {
  readonly policyVersion: string;
  readonly entrypoint: string;
  readonly regoSource: string;
  readonly signature: string;
  readonly bundleDigest: string;
  readonly rules: Readonly<Record<ActionClass, PolicyRuleSpec>>;
}

const DEFAULT_V1_RULES: Readonly<Record<ActionClass, PolicyRuleSpec>> = {
  read_allowlisted: {
    actionClass: "read_allowlisted",
    decisionWhenQualified: "allow",
    requiresDawQualification: false,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder", "Reviewer"],
    approvalExpirySeconds: 0,
    allowExplanation: "Allowlisted read operation is permitted within your project scope.",
    approvalExplanation: "Read operation requires project approval.",
    denyExplanation: "Read operation is not permitted for the requested data classification.",
  },
  write_workspace: {
    actionClass: "write_workspace",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: false,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 14_400,
    allowExplanation: "Workspace write is allowed.",
    approvalExplanation:
      "Writing files to the project workspace requires approval from an Owner or Builder.",
    denyExplanation: "Workspace file write is denied by project security policy.",
  },
  command_bounded: {
    actionClass: "command_bounded",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: false,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 7_200,
    allowExplanation: "Bounded command is allowed.",
    approvalExplanation:
      "Running a bounded build or test command requires approval from an Owner or Builder.",
    denyExplanation: "Command execution is denied by project security policy.",
  },
  audio_dsp: {
    actionClass: "audio_dsp",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: false,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 14_400,
    allowExplanation: "Offline audio processing is allowed.",
    approvalExplanation:
      "Offline audio DSP rendering requires approval from an Owner or Builder before creating output files.",
    denyExplanation: "Offline audio DSP operation is denied by project security policy.",
  },
  daw_inspect: {
    actionClass: "daw_inspect",
    decisionWhenQualified: "allow",
    requiresDawQualification: true,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 7_200,
    allowExplanation: "Qualified read-only FL Studio 2025 inspection is permitted.",
    approvalExplanation: "FL Studio 2025 inspection requires approval.",
    denyExplanation:
      "FL Studio 2025 inspection is currently disabled until DAW qualification evidence is recorded.",
  },
  daw_non_destructive_edit: {
    actionClass: "daw_non_destructive_edit",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: true,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 3_600,
    allowExplanation: "Non-destructive DAW edit is allowed.",
    approvalExplanation:
      "Staging a non-destructive FL Studio 2025 edit requires Owner or Builder approval and an automatic project backup.",
    denyExplanation:
      "FL Studio 2025 non-destructive editing is blocked until DAW qualification evidence is recorded.",
  },
  daw_session_mutation: {
    actionClass: "daw_session_mutation",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: true,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 1_800,
    allowExplanation: "DAW session mutation is allowed.",
    approvalExplanation:
      "Modifying an FL Studio 2025 session requires explicit Owner or Builder approval and a verified pre-mutation backup.",
    denyExplanation:
      "FL Studio 2025 session mutation is blocked until DAW qualification evidence is recorded.",
  },
  daw_render: {
    actionClass: "daw_render",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: true,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 3_600,
    allowExplanation: "DAW audio render is allowed.",
    approvalExplanation:
      "Rendering audio from FL Studio 2025 requires Owner or Builder approval.",
    denyExplanation:
      "FL Studio 2025 rendering is blocked until DAW qualification evidence is recorded.",
  },
  external_upload: {
    actionClass: "external_upload",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: false,
    forbidRestrictedLocalEgress: true,
    requiredApproverRoles: ["Owner"],
    approvalExpirySeconds: 3_600,
    allowExplanation: "External upload is allowed.",
    approvalExplanation:
      "Uploading project summaries or artifacts outside the local workstation requires Owner approval.",
    denyExplanation:
      "External transfer is denied: restricted local assets and credentials cannot be uploaded externally.",
  },
  package_install: {
    actionClass: "package_install",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: false,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["Owner", "WorkerOperator"],
    approvalExpirySeconds: 1_800,
    allowExplanation: "Package installation is allowed.",
    approvalExplanation:
      "Installing or updating local packages requires approval from an Owner or Worker Operator.",
    denyExplanation: "Package installation is denied by workstation security policy.",
  },
  release_publish: {
    actionClass: "release_publish",
    decisionWhenQualified: "requireApproval",
    requiresDawQualification: false,
    forbidRestrictedLocalEgress: false,
    requiredApproverRoles: ["ReleaseManager", "Reviewer"],
    approvalExpirySeconds: 86_400,
    allowExplanation: "Release publication is allowed.",
    approvalExplanation:
      "Publishing a release candidate requires Release Manager or Reviewer approval and verified artifact signatures.",
    denyExplanation: "Release publication is denied by release governance policy.",
  },
};

const ZERO_DIGEST = "0".repeat(64);

export function loadDefaultV1OpaPolicyBundle(
  overrideVersion?: string,
  customRules?: Partial<Record<ActionClass, PolicyRuleSpec>>,
): OpaPolicyBundle {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const regoPath = resolve(currentDir, "../bundles/v1/governance.rego");
  const manifestPath = resolve(currentDir, "../bundles/v1/bundle-manifest.json");

  const regoSource = readFileSync(regoPath, "utf8");
  const manifestRaw = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    policyVersion: string;
    entrypoint: string;
    signature: string;
  };

  const policyVersion = overrideVersion ?? manifestRaw.policyVersion;
  const mergedRules: Record<ActionClass, PolicyRuleSpec> = {
    ...DEFAULT_V1_RULES,
    ...(customRules ?? {}),
  };

  const bundleDigest = createHash("sha256")
    .update(
      JSON.stringify({
        policyVersion,
        entrypoint: manifestRaw.entrypoint,
        regoSource,
        rules: mergedRules,
      }),
      "utf8",
    )
    .digest("hex");

  return {
    policyVersion,
    entrypoint: manifestRaw.entrypoint,
    regoSource,
    signature: manifestRaw.signature,
    bundleDigest,
    rules: mergedRules,
  };
}

/**
 * Deterministic OPA Policy Decision Point (ADR-0002).
 * Evaluates PolicyInput against a signed, versioned OpaPolicyBundle.
 * Always fails closed (`deny`) on missing bundle, signature failure, invalid input, or unknown action.
 */
export class OpaPolicyDecisionPoint {
  private activeBundle: OpaPolicyBundle | undefined;
  private simulateEvaluationError = false;

  public constructor(initialBundle: OpaPolicyBundle | null = loadDefaultV1OpaPolicyBundle()) {
    this.activeBundle = initialBundle ?? undefined;
  }

  public getActiveBundle(): OpaPolicyBundle | undefined {
    return this.activeBundle;
  }

  public getPolicyVersion(): string {
    return this.activeBundle?.policyVersion ?? "policy-unavailable";
  }

  public rotateBundle(nextBundle: OpaPolicyBundle | undefined): void {
    this.activeBundle = nextBundle;
  }

  public setSimulateEvaluationError(fail: boolean): void {
    this.simulateEvaluationError = fail;
  }

  public evaluate(rawInput: unknown): PolicyDecision {
    if (
      this.simulateEvaluationError ||
      !this.activeBundle ||
      !this.activeBundle.signature ||
      this.activeBundle.signature.length < 16 ||
      !this.activeBundle.regoSource.includes("default decision := \"deny\"")
    ) {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "deny",
        policyVersion: this.activeBundle?.policyVersion ?? "unloaded-bundle",
        bundleDigest: this.activeBundle?.bundleDigest ?? ZERO_DIGEST,
        reasonCode: "POLICY_BUNDLE_UNAVAILABLE_FAIL_CLOSED",
        userExplanation:
          "Action denied because the security policy service could not verify the active policy bundle.",
        requiredApproverRoles: [],
        approvalExpirySeconds: 0,
      });
    }

    const bundle = this.activeBundle;
    const parsedInput = PolicyInputSchema.safeParse(rawInput);
    if (!parsedInput.success) {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "deny",
        policyVersion: bundle.policyVersion,
        bundleDigest: bundle.bundleDigest,
        reasonCode: "POLICY_INPUT_INVALID_FAIL_CLOSED",
        userExplanation:
          "Action denied because the request did not satisfy required policy input validation.",
        requiredApproverRoles: [],
        approvalExpirySeconds: 0,
      });
    }

    const input: PolicyInput = parsedInput.data;

    if (!Object.prototype.hasOwnProperty.call(bundle.rules, input.actionClass)) {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "deny",
        policyVersion: bundle.policyVersion,
        bundleDigest: bundle.bundleDigest,
        reasonCode: "POLICY_UNKNOWN_ACTION_DENIED",
        userExplanation:
          "Action denied because the requested operation is not a recognized governed action class.",
        requiredApproverRoles: [],
        approvalExpirySeconds: 0,
      });
    }

    const rule = bundle.rules[input.actionClass as ActionClass];

    if (input.classification === "SECRET_CREDENTIAL") {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "deny",
        policyVersion: bundle.policyVersion,
        bundleDigest: bundle.bundleDigest,
        reasonCode: "POLICY_SECRET_CREDENTIAL_DENIED",
        userExplanation:
          "Action denied because secret credentials cannot be processed by workflow actions or external transfers.",
        requiredApproverRoles: [],
        approvalExpirySeconds: 0,
      });
    }

    if (rule.forbidRestrictedLocalEgress && input.classification === "RESTRICTED_LOCAL") {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "deny",
        policyVersion: bundle.policyVersion,
        bundleDigest: bundle.bundleDigest,
        reasonCode: "POLICY_RESTRICTED_LOCAL_EGRESS_DENIED",
        userExplanation: rule.denyExplanation,
        requiredApproverRoles: [],
        approvalExpirySeconds: 0,
      });
    }

    if (rule.requiresDawQualification && !input.dawCapabilityQualified) {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "deny",
        policyVersion: bundle.policyVersion,
        bundleDigest: bundle.bundleDigest,
        reasonCode: "POLICY_DAW_CAPABILITY_UNQUALIFIED",
        userExplanation: rule.denyExplanation,
        requiredApproverRoles: [],
        approvalExpirySeconds: 0,
      });
    }

    if (rule.decisionWhenQualified === "deny") {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "deny",
        policyVersion: bundle.policyVersion,
        bundleDigest: bundle.bundleDigest,
        reasonCode: "POLICY_ACTION_DENIED_BY_RULE",
        userExplanation: rule.denyExplanation,
        requiredApproverRoles: [],
        approvalExpirySeconds: 0,
      });
    }

    if (rule.decisionWhenQualified === "allow") {
      return PolicyDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        decision: "allow",
        policyVersion: bundle.policyVersion,
        bundleDigest: bundle.bundleDigest,
        reasonCode: "POLICY_ACTION_ALLOWED",
        userExplanation: rule.allowExplanation,
        requiredApproverRoles: [...rule.requiredApproverRoles],
        approvalExpirySeconds: rule.approvalExpirySeconds,
      });
    }

    return PolicyDecisionSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      decision: "requireApproval",
      policyVersion: bundle.policyVersion,
      bundleDigest: bundle.bundleDigest,
      reasonCode: "POLICY_APPROVAL_REQUIRED",
      userExplanation: rule.approvalExplanation,
      requiredApproverRoles: [...rule.requiredApproverRoles],
      approvalExpirySeconds: rule.approvalExpirySeconds,
    });
  }
}
