# ADR-0005 — Agent Roles Are Bounded Tools Behind a Planner

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [ADR-0002](./0002-controlled-autonomy-policy-engine.md) · [ADR-0004](./0004-typed-protocol-first.md) · [ADR-0006](./0006-provider-gateway-redaction-routing.md)

## Context

Unconstrained autonomous agents that converse freely or invoke shell commands directly from LLM completions create unpredictable execution paths, unbounded token consumption, and severe security risks.

## Decision

Agent intelligence is structured as a **Bounded Planner + Registered Tool Catalog**:
1. The Planner accepts a validated `PlanningInput` (derived from `ProductSpec` and cited `GroundedContext`) and outputs a declarative `ExecutionPlan` consisting of typed `PlanStep` objects.
2. Each `PlanStep` references an explicitly registered `ToolManifest` entry with declared `actionClass`, input/output schema, resource budget, and required capability scope.
3. Specialized agent roles (e.g., Specification Analyst, Code/Test Planner, Audio Chain Planner, DAW Inspection Planner) operate strictly as bounded proposers or validators over registered tools.

**Explicit Boundary Rule:** Agents **cannot** mint `CapabilityGrant` tokens, modify OPA policy, approve actions, access secrets, or execute direct shell/DAW calls outside the Temporal → Policy → Approval → Worker pipeline.

## Alternatives Considered

- **Single monolithic super-agent with shell access:** Rejected as opaque, non-auditable, and unsafe.
- **Unbounded multi-agent chat loops:** Rejected due to non-termination risks, cost blowups, and lack of deterministic plan hashing.

## Consequences

- **Positive:** Every plan can be deterministically hashed (`planHash`), inspected by humans, evaluated by OPA policy, and tested against static evaluation fixtures.
- **Negative / Trade-offs:** New capabilities require registering a versioned `ToolManifest` and policy rule before the planner can schedule them.
