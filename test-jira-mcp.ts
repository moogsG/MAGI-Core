#!/usr/bin/env bun
/**
 * Test Jira MCP tools
 */

import { Database } from "bun:sqlite";
import { getJiraIssues, getJiraIssue } from "./packages/connectors/jira/src/repo.js";

async function main() {
  console.log("🧪 Testing Jira MCP Tools\n");

  const db = Database.open("./packages/server/tasks.db");

  // Test 1: List all issues
  console.log("📋 Test 1: List all issues (limit 5)");
  const allIssues = getJiraIssues(db, {
    assignee: process.env.JIRA_USER_ACCOUNT_ID,
    limit: 5,
  });
  console.log(`  Found ${allIssues.length} issues`);
  allIssues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.key}: ${issue.summary}`);
    console.log(`     Status: ${issue.status}, Priority: ${issue.priority || "None"}`);
    console.log(`     Freshness: ${issue.approx_freshness_seconds}s ago`);
  });

  // Test 2: Filter by status
  console.log("\n📋 Test 2: Filter by status (QA Testing)");
  const qaIssues = getJiraIssues(db, {
    assignee: process.env.JIRA_USER_ACCOUNT_ID,
    status: ["QA Testing"],
    limit: 3,
  });
  console.log(`  Found ${qaIssues.length} issues in QA Testing`);
  qaIssues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.key}: ${issue.summary}`);
  });

  // Test 3: Filter by project
  console.log("\n📋 Test 3: Filter by project (GDEV)");
  const projectIssues = getJiraIssues(db, {
    assignee: process.env.JIRA_USER_ACCOUNT_ID,
    project_keys: ["GDEV"],
    limit: 3,
  });
  console.log(`  Found ${projectIssues.length} issues in GDEV project`);
  projectIssues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.key}: ${issue.summary}`);
  });

  // Test 4: Get single issue
  if (allIssues.length > 0) {
    const testKey = allIssues[0].key;
    console.log(`\n📋 Test 4: Get single issue (${testKey})`);
    const issue = getJiraIssue(db, testKey);
    if (issue) {
      console.log(`  ✅ Found issue: ${issue.key}`);
      console.log(`     Summary: ${issue.summary}`);
      console.log(`     Status: ${issue.status}`);
      console.log(`     Priority: ${issue.priority || "None"}`);
      console.log(`     Assignee: ${issue.assignee_display_name || "None"}`);
      console.log(`     Project: ${issue.project_key} (${issue.project_name})`);
      console.log(`     URL: ${issue.web_url}`);
      if (issue.description) {
        console.log(`     Description: ${issue.description.slice(0, 100)}...`);
      }
    } else {
      console.log(`  ❌ Issue not found`);
    }
  }

  db.close();
  console.log("\n✅ All tests complete!");
}

main().catch((error) => {
  console.error("\n💥 Error:", error);
  process.exit(1);
});
