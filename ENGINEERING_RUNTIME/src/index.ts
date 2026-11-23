import { ControlledToolGateway, type GatewayExecutionOutcome } from "../../TOOL_GATEWAY/src/index.ts";
import {
  type PlannedToolInvocationProposal,
  type PlannedToolInvocationProposalInput,
  PlannedToolInvocationProposalSchema,
} from "../../TOOL_GATEWAY/src/tool-schemas.ts";

/**
 * EngineeringExecutionRuntime enforces the architectural separation between:
 * - Phase A (Planning Phase): Agents construct and stage declarative proposals via `stageToolProposal()`.
 *   No filesystem, shell, or network side effects occur during planning.
 * - Phase B (Execution Phase): The runtime dispatches staged proposals through `ControlledToolGateway`
 *   via `executeStagedProposal()`, enforcing schema validation, permission/lease checks, human approvals,
 *   sandbox confinement, pre-write checkpointing, and hash-chained auditing.
 */

export class EngineeringExecutionRuntime {
  private readonly gateway: ControlledToolGateway;
  private readonly stagedProposals = new Map<string, PlannedToolInvocationProposal>();

  public constructor(options: { workspaceRoot: string }) {
    this.gateway = new ControlledToolGateway({ workspaceRoot: options.workspaceRoot });
  }

  public getGateway(): ControlledToolGateway {
    return this.gateway;
  }

  /**
   * PLANNING PHASE ONLY: Validates and stages a declarative tool invocation proposal.
   * Performs zero side effects on disk or external adapters.
   */
  public stageToolProposal(input: PlannedToolInvocationProposalInput): PlannedToolInvocationProposal {
    const parsed = PlannedToolInvocationProposalSchema.parse(input);
    this.stagedProposals.set(parsed.proposalId, parsed);
    return parsed;
  }

  /**
   * EXECUTION PHASE: Executes a previously staged proposal through ControlledToolGateway.
   */
  public executeStagedProposal<TOutput = unknown>(
    proposalId: string,
    attachedApprovalGrantId?: string
  ): GatewayExecutionOutcome<TOutput> {
    const proposal = this.stagedProposals.get(proposalId);
    if (!proposal) {
      throw new Error(
        `UNSTAGED_PROPOSAL_EXECUTION_FORBIDDEN: Proposal '${proposalId}' was not staged through the planning pipeline.`
      );
    }

    if (attachedApprovalGrantId) {
      proposal.approvalGrantId = attachedApprovalGrantId;
    }

    return this.gateway.executeProposal<TOutput>(proposal);
  }
}
