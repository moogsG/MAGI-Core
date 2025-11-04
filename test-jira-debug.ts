#!/usr/bin/env bun
/**
 * Debug script for Jira connector
 * Tests authentication, API calls, and data retrieval
 */

import { JiraClient } from "./packages/connectors/jira/src/client.js";
import type { JiraConfig } from "./packages/connectors/jira/src/types.js";

async function main() {
  console.log("🔍 Jira Connector Debug Script\n");

  // Step 1: Check environment variables
  console.log("📋 Step 1: Checking environment variables...");
  const config: JiraConfig = {
    url: process.env.JIRA_URL || "",
    email: process.env.JIRA_EMAIL || "",
    api_token: process.env.JIRA_API_TOKEN || "",
    user_account_id: process.env.JIRA_USER_ACCOUNT_ID || "",
    poll_minutes: parseInt(process.env.JIRA_POLL_MINUTES || "5"),
    project_keys: process.env.JIRA_PROJECT_KEYS?.split(",") || undefined,
  };

  console.log("  URL:", config.url ? "✅ Set" : "❌ Missing");
  console.log("  Email:", config.email ? "✅ Set" : "❌ Missing");
  console.log("  API Token:", config.api_token ? "✅ Set" : "❌ Missing");
  console.log("  User Account ID:", config.user_account_id ? "✅ Set" : "❌ Missing");
  console.log("  Poll Minutes:", config.poll_minutes);
  console.log("  Project Keys:", config.project_keys || "None (will fetch all projects)");

  if (!config.url || !config.email || !config.api_token || !config.user_account_id) {
    console.error("\n❌ Missing required environment variables!");
    console.error("Please set: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_USER_ACCOUNT_ID");
    process.exit(1);
  }

  // Step 2: Initialize client
  console.log("\n📡 Step 2: Initializing Jira client...");
  const client = new JiraClient(config);
  console.log("  ✅ Client initialized");

  // Step 3: Test API connectivity with a simple search
  console.log("\n🔌 Step 3: Testing API connectivity...");
  try {
    const testJql = `assignee = "${config.user_account_id}" ORDER BY updated DESC`;
    console.log(`  JQL Query: ${testJql}`);
    
    const response = await client.searchIssues(testJql, 1);
    console.log(`  ✅ API connection successful!`);
    console.log(`  Total issues found: ${response.total}`);
    console.log(`  Returned: ${response.issues.length} issue(s)`);
  } catch (error: any) {
    console.error("  ❌ API connection failed!");
    console.error("  Error:", error.message);
    
    if (error.message.includes("401")) {
      console.error("\n💡 Tip: Check your email and API token are correct");
    } else if (error.message.includes("404")) {
      console.error("\n💡 Tip: Check your JIRA_URL is correct (e.g., https://your-domain.atlassian.net)");
    } else if (error.message.includes("400")) {
      console.error("\n💡 Tip: Check your JIRA_USER_ACCOUNT_ID is correct");
    }
    
    process.exit(1);
  }

  // Step 4: Fetch issues assigned to user
  console.log("\n📥 Step 4: Fetching issues assigned to user...");
  try {
    const issues = await client.getIssuesAssignedToUser(config.user_account_id, {
      maxResults: 10,
      projectKeys: config.project_keys,
    });

    console.log(`  ✅ Found ${issues.length} issue(s)`);
    
    if (issues.length === 0) {
      console.log("\n⚠️  No issues found!");
      console.log("  Possible reasons:");
      console.log("  - No issues are assigned to this user");
      console.log("  - Project keys filter is too restrictive");
      console.log("  - User account ID is incorrect");
    } else {
      console.log("\n📋 Issues:");
      issues.forEach((issue, idx) => {
        console.log(`\n  ${idx + 1}. ${issue.key}: ${issue.summary}`);
        console.log(`     Status: ${issue.status}`);
        console.log(`     Priority: ${issue.priority || "None"}`);
        console.log(`     Project: ${issue.project_key} (${issue.project_name})`);
        console.log(`     Updated: ${issue.updated}`);
        console.log(`     URL: ${issue.web_url}`);
        if (issue.description) {
          const preview = issue.description.slice(0, 100);
          console.log(`     Description: ${preview}${issue.description.length > 100 ? "..." : ""}`);
        }
      });
    }
  } catch (error: any) {
    console.error("  ❌ Failed to fetch issues!");
    console.error("  Error:", error.message);
    process.exit(1);
  }

  // Step 5: Test with different project filters
  if (config.project_keys && config.project_keys.length > 0) {
    console.log("\n🔍 Step 5: Testing without project filter...");
    try {
      const allIssues = await client.getIssuesAssignedToUser(config.user_account_id, {
        maxResults: 10,
      });
      console.log(`  ✅ Found ${allIssues.length} issue(s) across all projects`);
      
      if (allIssues.length > 0) {
        const projects = new Set(allIssues.map(i => i.project_key));
        console.log(`  Projects: ${Array.from(projects).join(", ")}`);
      }
    } catch (error: any) {
      console.error("  ❌ Failed:", error.message);
    }
  }

  console.log("\n✅ Debug complete!");
}

main().catch((error) => {
  console.error("\n💥 Unexpected error:", error);
  process.exit(1);
});
