import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildJsonSchemaCatalog, buildOpenApiSpec } from "../src/api/index.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const generatedDir = resolve(currentDir, "../generated");

mkdirSync(generatedDir, { recursive: true });

const jsonSchemaPath = resolve(generatedDir, "json-schema.json");
const openApiPath = resolve(generatedDir, "openapi.json");

writeFileSync(jsonSchemaPath, `${JSON.stringify(buildJsonSchemaCatalog(), null, 2)}\n`, "utf8");
writeFileSync(openApiPath, `${JSON.stringify(buildOpenApiSpec(), null, 2)}\n`, "utf8");

console.log(`Generated JSON Schema: ${jsonSchemaPath}`);
console.log(`Generated OpenAPI 3.1: ${openApiPath}`);
