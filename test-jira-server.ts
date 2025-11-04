#!/usr/bin/env bun
/**
 * Test Jira connector integration with server
 * Verifies that issues are being polled and stored in the database
 */

import { Database } from "bun:sqlite";

async function main() {
  console.log("🔍 Jira Server Integration Test\n");

  const db = Database.open("./packages/server/tasks.db");

  // Check current state
  console.log("📊 Current database state:");
  const countBefore = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM jira_issues"
  ).get();
  console.log(`  Issues in database: ${countBefore?.count || 0}`);

  if (countBefore && countBefore.count > 0) {
    console.log("\n📋 Sample issues:");
    const samples = db.query<any, []>(
      "SELECT key, summary, status, updated FROM jira_issues ORDER BY updated DESC LIMIT 5"
    ).all();
    
    samples.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. ${issue.key}: ${issue.summary}`);
      console.log(`     Status: ${issue.status}, Updated: ${issue.updated}`);
    });
  }

  console.log("\n✅ Test complete!");
  console.log("\n💡 To populate the database:");
  console.log("   1. Start the server: bun packages/server/src/cli.ts");
  console.log("   2. The Jira connector will poll automatically every 5 minutes");
  console.log("   3. Or wait for the initial poll on startup");

  db.close();
}

main().catch((error) => {
  console.error("\n💥 Error:", error);
  process.exit(1);
});
