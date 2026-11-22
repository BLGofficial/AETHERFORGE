import type { PolicyDecisionKind } from "@aether-forge/contracts";

export function formatPolicyDecisionBadgeLabel(decision: PolicyDecisionKind): string {
  switch (decision) {
    case "allow":
      return "AUTO-ALLOWED";
    case "requireApproval":
      return "APPROVAL REQUIRED";
    case "deny":
      return "DENIED (FAIL-CLOSED)";
  }
}
