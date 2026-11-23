import { resolve } from "node:path";
import { AetherForgeApplicationController } from "../../API_INTEGRATION/src/index.ts";
import { createAetherForgeFrontendServer } from "./server.ts";

const port = Number(process.env["AETHER_STUDIO_PORT"] ?? process.env["PORT"] ?? 4173);
const host = process.env["AETHER_STUDIO_HOST"] ?? "127.0.0.1";
const workspaceRoot = process.cwd();
const checkpointDir = resolve(workspaceRoot, ".aetherforge", "checkpoints");

const controller = new AetherForgeApplicationController({
  workspaceRoot,
  checkpointDir,
});

const server = createAetherForgeFrontendServer(controller);

server.listen(port, host, () => {
  const baseUrl = `http://${host}:${port}`;
  console.log(`AETHER FORGE 11-Workspace Studio listening on ${baseUrl}`);
  console.log(`Command Center: ${baseUrl}/workspaces/command-center`);
  console.log(`Authoritative State API: ${baseUrl}/api/v1/ui/state`);
  console.log(`Durable Checkpoints Dir: ${checkpointDir}`);
});
