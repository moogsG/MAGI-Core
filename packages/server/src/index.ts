import { openDB } from "./db/index.js";
import { startServer } from "./mcp.js";
import { HelperRegistry } from "./connections/registry.js";
import { loadHelpersFromConfig } from "./connections/loader.js";
import { mergeConfigWithEnv } from "./connections/config-loader.js";
import fs from "node:fs";
import path from "node:path";
import type { ToolDefinition } from "./connections/types.js";

const db = openDB(process.env.TASKS_DB_PATH);
const logger = { 
  info: (msg: string, meta?: Record<string, unknown>) => console.error(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg: string, meta?: Record<string, unknown>) => console.error(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string | Error, meta?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : '')
};

// Load config.json if present
let config: any = {};
try {
  const configPath = path.join(process.cwd(), "config.json");
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, "utf8");
    const baseConfig = JSON.parse(configContent);
    // Merge environment variables into config
    config = mergeConfigWithEnv(baseConfig);
    logger.info("Loaded config.json with env overrides", { helpers: config.helpers?.length ?? 0 });
  }
} catch (error) {
  logger.warn("Could not load config.json", { 
    error: error instanceof Error ? error.message : String(error) 
  });
}

// Load helpers
const registry = new HelperRegistry();
let helperTools: ToolDefinition[] = [];

try {
  await loadHelpersFromConfig(registry, config, logger);
  
  // Init helpers (without starting background services)
  await registry.initAll((name) => ({
    db,
    logger,
    config: (config?.helpers ?? []).find((h: any) => h.name === name)?.config ?? {},
    emit: (event: string, payload?: unknown) => logger.info(`event:${name}:${event}`, { payload })
  }));

  // Collect all helper tools
  for (const helper of registry.list()) {
    const tools = helper.tools();
    helperTools.push(...tools);
    logger.info(`Registered ${tools.length} tools from helper`, { helper: helper.name });
  }
} catch (error) {
  logger.error("Failed to load helpers", { 
    error: error instanceof Error ? error.message : String(error) 
  });
}

// Graceful shutdown handlers
const cleanup = () => {
  logger.info("Shutting down...");
  db.close();
};

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// Error handlers
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  cleanup();
  process.exit(1);
});

// Start MCP server with helper tools
await startServer(db, helperTools);
