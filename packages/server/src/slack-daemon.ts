import { openDB } from "./db/index.js";
import { HelperRegistry } from "./connections/registry.js";
import { loadHelpersFromConfig } from "./connections/loader.js";
import fs from "node:fs";
import path from "node:path";

const db = openDB(process.env.TASKS_DB_PATH);
const logger = { 
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[INFO] ${msg}`, meta ?? {}),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, meta ?? {}),
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

// Graceful shutdown handlers
process.on('SIGINT', () => {
  logger.info("SIGINT received, shutting down...");
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info("SIGTERM received, shutting down...");
  db.close();
  process.exit(0);
});

// Error handlers
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  db.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  db.close();
  process.exit(1);
});

const registry = new HelperRegistry();
await loadHelpersFromConfig(registry, config, logger);

// Init helpers
await registry.initAll((name) => ({
  db,
  logger,
  config: (config?.helpers ?? []).find((h: any) => h.name === name)?.config ?? {},
  emit: (event: string, payload?: unknown) => logger.info(`event:${name}:${event}`, { payload })
}));

logger.info("Slack daemon started - press Ctrl+C to stop");

// Keep alive
await new Promise(() => {});
