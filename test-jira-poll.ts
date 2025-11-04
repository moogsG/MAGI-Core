#!/usr/bin/env bun
/**
 * Test Jira polling by running a single poll cycle
 */

import { Database } from "bun:sqlite";
import { JiraClient } from "./packages/connectors/jira/src/client.js";
import { upsertJiraIssue } from "./packages/connectors/jira/src/repo.js";
import type { JiraConfig } from "./packages/connectors/jira/src/types.js";

async function main() {
  console.log("🔄 Running Jira poll cycle...\n");

  // Initialize config
  const config: JiraConfig = {
    url: process.env.JIRA_URL || "",
    email: process.env.JIRA_EMAIL || "",
    api_token: process.env.JIRA_API_TOKEN || "",
    user_account_id: process.env.JIRA_USER_ACCOUNT_ID || "",
    poll_minutes: 5,
    project_keys: ["GDEV"],
  };

  // Initialize client
  const client = new JiraClient(config);
  
  // Open database
  const db = Database.open("./packages/server/tasks.db");

  console.log("📥 Fetching issues from Jira API...");
  const issues = await client.getIssuesAssignedToUser(config.user_account_id, {
    maxResults: 100,
    projectKeys: config.project_keys,
  });

  console.log(`  Found ${issues.length} issues\n`);

  console.log("💾 Storing issues in database...");
  for (const issue of issues) {
    upsertJiraIssue(db, issue);
  }
  console.log(`  ✅ Stored ${issues.length} issues\n`);

  // Verify
  const count = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM jira_issues"
  ).get();
  console.log(`📊 Total issues in database: ${count?.count || 0}`);

  // Show sample
  console.log("\n📋 Sample issues:");
  const samples = db.query<any, []>(
    "SELECT key, summary, status, priority FROM jira_issues ORDER BY updated DESC LIMIT 5"
  ).all();
  
  samples.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.key}: ${issue.summary}`);
    console.log(`     Status: ${issue.status}, Priority: ${issue.priority || "None"}`);
  });

  db.close();
  console.log("\n✅ Poll complete!");
}

main().catch((error) => {
  console.error("\n💥 Error:", error);
  process.exit(1);
});
