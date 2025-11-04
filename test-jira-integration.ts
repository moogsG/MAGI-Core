#!/usr/bin/env bun
/**
 * Full integration test - simulates what the server does
 */

import { Database } from "bun:sqlite";
import { HelperRegistry } from "./packages/server/src/connections/registry.js";
import { loadHelpersFromConfig } from "./packages/server/src/connections/loader.js";
import { mergeConfigWithEnv } from "./packages/server/src/connections/config-loader.js";
import fs from "node:fs";
import path from "node:path";

const logger = { 
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta, null, 2) : ''),
  warn: (msg: string, meta?: Record<string, unknown>) => console.log(`[WARN] ${msg}`, meta ? JSON.stringify(meta, null, 2) : ''),
  error: (msg: string | Error, meta?: Record<string, unknown>) => console.log(`[ERROR] ${msg}`, meta ? JSON.stringify(meta, null, 2) : '')
};

async function main() {
  console.log("🧪 Full Jira Integration Test\n");

  // Open database
  const db = Database.open("./packages/server/tasks.db");

  // Load config
  const configPath = path.join(process.cwd(), "config.json");
  const configContent = fs.readFileSync(configPath, "utf8");
  const baseConfig = JSON.parse(configContent);
  const config = mergeConfigWithEnv(baseConfig);

  console.log("📋 Loaded config:");
  console.log(`  Helpers: ${config.helpers?.length ?? 0}`);
  config.helpers?.forEach((h: any) => {
    console.log(`    - ${h.name}: ${h.module}`);
  });

  // Load helpers
  const registry = new HelperRegistry();
  await loadHelpersFromConfig(registry, config, logger);

  console.log("\n🔌 Initializing and starting helpers...");
  await registry.initAll((name) => ({
    db,
    logger,
    config: (config?.helpers ?? []).find((h: any) => h.name === name)?.config ?? {},
    emit: (event: string, payload?: unknown) => logger.info(`event:${name}:${event}`, { payload })
  }));

  console.log("\n⏳ Waiting 5 seconds for initial poll...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check database
  const count = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM jira_issues"
  ).get();
  console.log(`\n📊 Issues in database: ${count?.count || 0}`);

  if (count && count.count > 0) {
    const samples = db.query<any, []>(
      "SELECT key, summary, status FROM jira_issues ORDER BY updated DESC LIMIT 3"
    ).all();
    
    console.log("\n📋 Sample issues:");
    samples.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. ${issue.key}: ${issue.summary}`);
      console.log(`     Status: ${issue.status}`);
    });
  }

  console.log("\n🛑 Helpers will stop when process exits...");

  db.close();
  console.log("\n✅ Integration test complete!");
}

main().catch((error) => {
  console.error("\n💥 Error:", error);
  process.exit(1);
});
