import {
  type ActorRef,
  type DomainError,
  type HumanRole,
  type RequestContext,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";

export interface OidcVerifiedClaims {
  readonly sub: string;
  readonly tenantId: string;
  readonly roles: readonly HumanRole[];
  readonly projectIds: readonly string[];
  readonly displayName?: string | undefined;
  readonly expUnixSeconds: number;
}

export interface OidcVerifierSeam {
  verifyBearerToken(token: string, nowUnixSeconds?: number): OidcVerifiedClaims | undefined;
}

/**
 * Configurable OIDC test double / integration seam for Phase 02.
 * Validates registered tokens and expiry without requiring live external IdP credentials.
 */
export class ConfigurableOidcVerifier implements OidcVerifierSeam {
  private readonly tokens = new Map<string, OidcVerifiedClaims>();

  public registerToken(token: string, claims: OidcVerifiedClaims): void {
    this.tokens.set(token, claims);
  }

  public verifyBearerToken(
    token: string,
    nowUnixSeconds: number = Math.floor(Date.now() / 1000),
  ): OidcVerifiedClaims | undefined {
    const claims = this.tokens.get(token);
    if (!claims) {
      return undefined;
    }
    if (nowUnixSeconds >= claims.expUnixSeconds) {
      return undefined;
    }
    return claims;
  }
}

export interface TenantMemberRecord {
  readonly tenantId: string;
  readonly actorId: string;
  readonly roles: readonly HumanRole[];
  readonly projectIds: readonly string[];
}

export class TenantMembershipRegistry {
  private readonly members = new Map<string, TenantMemberRecord>();

  private static key(tenantId: string, actorId: string): string {
    return `${tenantId}::${actorId}`;
  }

  public registerMember(record: TenantMemberRecord): void {
    this.members.set(TenantMembershipRegistry.key(record.tenantId, record.actorId), record);
  }

  public getMembership(tenantId: string, actorId: string): TenantMemberRecord | undefined {
    return this.members.get(TenantMembershipRegistry.key(tenantId, actorId));
  }
}

export type AuthorizationOutcome =
  | { readonly authorized: true; readonly actor: ActorRef }
  | { readonly authorized: false; readonly error: DomainError };

/**
 * Enforces tenant and project isolation BEFORE any data read or state mutation.
 * Cross-tenant access attempts return NOT_FOUND (404 semantics) to prevent resource enumeration.
 */
export function authorizeTenantAndRole(params: {
  readonly context: RequestContext;
  readonly claims: OidcVerifiedClaims | undefined;
  readonly membershipRegistry: TenantMembershipRegistry;
  readonly resourceTenantId: string;
  readonly resourceProjectId?: string | undefined;
  readonly requiredRoles: readonly HumanRole[];
}): AuthorizationOutcome {
  const {
    context,
    claims,
    membershipRegistry,
    resourceTenantId,
    resourceProjectId,
    requiredRoles,
  } = params;

  if (!claims || claims.sub !== context.actor.actorId) {
    return {
      authorized: false,
      error: {
        schemaVersion: SCHEMA_VERSION_V1,
        code: "DOMAIN_OIDC_AUTHENTICATION_FAILED",
        message: "Missing, expired, or mismatched OIDC bearer token.",
        category: "AUTHENTICATION",
        traceId: context.traceId,
      },
    };
  }

  if (claims.tenantId !== context.tenantId || context.tenantId !== resourceTenantId) {
    return {
      authorized: false,
      error: {
        schemaVersion: SCHEMA_VERSION_V1,
        code: "DOMAIN_RESOURCE_NOT_FOUND",
        message: "Target resource does not exist in caller tenant scope.",
        category: "NOT_FOUND",
        traceId: context.traceId,
      },
    };
  }

  const membership = membershipRegistry.getMembership(context.tenantId, context.actor.actorId);
  if (!membership) {
    return {
      authorized: false,
      error: {
        schemaVersion: SCHEMA_VERSION_V1,
        code: "DOMAIN_RESOURCE_NOT_FOUND",
        message: "Actor is not a registered member of the target tenant.",
        category: "NOT_FOUND",
        traceId: context.traceId,
      },
    };
  }

  if (
    resourceProjectId !== undefined &&
    !membership.projectIds.includes(resourceProjectId) &&
    !membership.roles.includes("Owner")
  ) {
    return {
      authorized: false,
      error: {
        schemaVersion: SCHEMA_VERSION_V1,
        code: "DOMAIN_RESOURCE_NOT_FOUND",
        message: "Target project is not accessible to actor within tenant scope.",
        category: "NOT_FOUND",
        traceId: context.traceId,
      },
    };
  }

  const hasRole = requiredRoles.some(
    (role) => membership.roles.includes(role) && claims.roles.includes(role),
  );
  if (!hasRole) {
    return {
      authorized: false,
      error: {
        schemaVersion: SCHEMA_VERSION_V1,
        code: "DOMAIN_ROLE_AUTHORIZATION_DENIED",
        message: `Actor lacks required role (${requiredRoles.join(" | ")}).`,
        category: "AUTHORIZATION",
        traceId: context.traceId,
      },
    };
  }

  return {
    authorized: true,
    actor: context.actor,
  };
}
