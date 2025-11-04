import { openDB } from "./db/index.js";
import { startServer } from "./mcp.js";
import { HelperRegistry } from "./connections/registry.js";
import { loadHelpersFromConfig } from "./connections/loader.js";
import fs from "node:fs";
import path from "node:path";

const db = openDB(process.env.TASKS_DB_PATH);
const logger = { 
  info: (msg: string, meta?: Record<string, unknown>) => console.error(`[INFO] ${msg}`, meta ?? {}),
  warn: (msg: string, meta?: Record<string, unknown>) => console.error(`[WARN] ${msg}`, meta ?? {}),
  error: (msg: string | Error, meta?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, meta ?? {})
};

// Load config.json if present
let config: any = {};
try {
  const configPath = path.join(process.cwd(), "config.json");
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(configContent);
  }
} catch (error) {
  logger.warn("Could not load config.json", { 
    error: error instanceof Error ? error.message : String(error) 
  });
}

const registry = new HelperRegistry();
await loadHelpersFromConfig(registry, config, logger);

// Init helpers
await registry.initAll((name) => ({
  db,
  logger,
  config: (config?.helpers ?? []).find((h: any) => h.name === name)?.config ?? {},
  emit: (event: string, payload?: unknown) => logger.info(`event:${name}:${event}`, { payload })
}));

// Start MCP server
await startServer(db);
