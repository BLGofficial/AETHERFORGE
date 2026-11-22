import type { ActionClass, HumanRole, PolicyDecisionKind } from "@aether-forge/contracts";

export interface ActionTaxonomyRule {
  readonly actionClass: ActionClass;
  readonly defaultDecision: PolicyDecisionKind;
  readonly allowedApproverRoles: readonly HumanRole[];
  readonly approvalExpirySeconds: number;
  readonly backupRequired: boolean;
  readonly qualifiedInPhase02: boolean;
}

/**
 * Deterministic action taxonomy defined in GOVERNANCE.md §3.
 * Unknown or unqualified action classes fail closed (`deny`).
 */
export const ACTION_TAXONOMY: Readonly<Record<ActionClass, ActionTaxonomyRule>> = {
  read_allowlisted: {
    actionClass: "read_allowlisted",
    defaultDecision: "allow",
    allowedApproverRoles: ["Owner", "Builder", "Reviewer"],
    approvalExpirySeconds: 0,
    backupRequired: false,
    qualifiedInPhase02: true,
  },
  write_workspace: {
    actionClass: "write_workspace",
    defaultDecision: "requireApproval",
    allowedApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 14_400,
    backupRequired: true,
    qualifiedInPhase02: true,
  },
  command_bounded: {
    actionClass: "command_bounded",
    defaultDecision: "requireApproval",
    allowedApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 7_200,
    backupRequired: false,
    qualifiedInPhase02: true,
  },
  audio_dsp: {
    actionClass: "audio_dsp",
    defaultDecision: "requireApproval",
    allowedApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 14_400,
    backupRequired: false,
    qualifiedInPhase02: true,
  },
  daw_inspect: {
    actionClass: "daw_inspect",
    defaultDecision: "deny",
    allowedApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 7_200,
    backupRequired: false,
    qualifiedInPhase02: false,
  },
  daw_non_destructive_edit: {
    actionClass: "daw_non_destructive_edit",
    defaultDecision: "deny",
    allowedApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 3_600,
    backupRequired: true,
    qualifiedInPhase02: false,
  },
  daw_session_mutation: {
    actionClass: "daw_session_mutation",
    defaultDecision: "deny",
    allowedApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 1_800,
    backupRequired: true,
    qualifiedInPhase02: false,
  },
  daw_render: {
    actionClass: "daw_render",
    defaultDecision: "deny",
    allowedApproverRoles: ["Owner", "Builder"],
    approvalExpirySeconds: 3_600,
    backupRequired: false,
    qualifiedInPhase02: false,
  },
  external_upload: {
    actionClass: "external_upload",
    defaultDecision: "requireApproval",
    allowedApproverRoles: ["Owner"],
    approvalExpirySeconds: 3_600,
    backupRequired: false,
    qualifiedInPhase02: true,
  },
  package_install: {
    actionClass: "package_install",
    defaultDecision: "requireApproval",
    allowedApproverRoles: ["Owner", "WorkerOperator"],
    approvalExpirySeconds: 1_800,
    backupRequired: true,
    qualifiedInPhase02: true,
  },
  release_publish: {
    actionClass: "release_publish",
    defaultDecision: "requireApproval",
    allowedApproverRoles: ["ReleaseManager", "Reviewer"],
    approvalExpirySeconds: 86_400,
    backupRequired: true,
    qualifiedInPhase02: true,
  },
};

export function resolveActionTaxonomyRule(actionClass: string): ActionTaxonomyRule | undefined {
  if (Object.prototype.hasOwnProperty.call(ACTION_TAXONOMY, actionClass)) {
    return ACTION_TAXONOMY[actionClass as ActionClass];
  }
  return undefined;
}
