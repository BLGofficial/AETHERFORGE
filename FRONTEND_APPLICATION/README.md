# AETHER FORGE — 11-WORKSPACE FRONTEND APPLICATION (`FRONTEND_APPLICATION/README.md`)

Full-stack TypeScript/HTTP server-rendered and JSON API engineering console implementing all **11 AETHER FORGE Workspaces**:
1. Command Center (`/workspaces/command-center`)
2. Project Creation Studio (`/workspaces/project-creation-studio`)
3. Architecture Studio (`/workspaces/architecture-studio`)
4. Agent Studio (`/workspaces/agent-studio`)
5. Workflow Studio (`/workspaces/workflow-studio`)
6. Engineering Console (`/workspaces/engineering-console`)
7. Knowledge Center (`/workspaces/knowledge-center`)
8. Testing Center (`/workspaces/testing-center`)
9. Integration Center (`/workspaces/integration-center`)
10. System Monitor (`/workspaces/system-monitor`)
11. Reference Library (`/workspaces/reference-library`)

Every interactive form and API action (`POST /api/v1/ui/compile-project`, `/workflows/start`, `/workflows/approve`, `/tools/execute`, `/knowledge/search`, `/daw/inspect`, `/system/emergency-stop`) executes real backend logic via `AetherForgeApplicationController` (`API_INTEGRATION/src/index.ts`).

## Files

- **[src/workspaces.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/FRONTEND_APPLICATION/src/workspaces.ts)**: All 11 workspace HTML renderers backed strictly by `AuthoritativePlatformState`.
- **[src/server.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/FRONTEND_APPLICATION/src/server.ts)**: Node.js HTTP server exposing SSR routes and JSON mutation/query APIs.
- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/FRONTEND_APPLICATION/src/index.ts)**: Package entry exports.
