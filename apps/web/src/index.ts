import type {
  Brief,
  DecideApprovalRequest,
  DecideApprovalResponse,
  RequestContext,
  Result,
  SpecRef,
  TriggerEmergencyStopRequest,
  TriggerEmergencyStopResponse,
} from "@aether-forge/sdk";
import type { GovernedDomainApiService } from "@aether-forge/api";

export * from "./screens.ts";
export * from "./server.ts";

/**
 * Minimal Web Control Plane identity/command client boundary (Phase 02 / Phase 04).
 * Browser holds only the user's OIDC bearer token; never provider secrets or worker signing keys.
 */
export class WebControlPlaneClient {
  private readonly api: GovernedDomainApiService;
  private readonly bearerToken: string;

  public constructor(api: GovernedDomainApiService, bearerToken: string) {
    this.api = api;
    this.bearerToken = bearerToken;
  }

  public submitBrief(context: RequestContext, brief: Brief): Result<SpecRef> {
    return this.api.submitBrief({ context, brief }, { bearerToken: this.bearerToken });
  }

  public decideApproval(request: DecideApprovalRequest): DecideApprovalResponse {
    return this.api.decideApproval(request, { bearerToken: this.bearerToken });
  }

  public triggerEmergencyStop(request: TriggerEmergencyStopRequest): TriggerEmergencyStopResponse {
    return this.api.triggerEmergencyStop(request, { bearerToken: this.bearerToken });
  }
}
