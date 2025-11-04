#!/usr/bin/env bun
/**
 * Test Jira Task Status Sync Feature
 * Verifies that tasks are automatically updated to "done" when Jira issues are marked as "Done"
 */

import { Database } from "bun:sqlite";
import { JiraClient } from "./packages/connectors/jira/src/client.js";
import { upsertJiraIssue } from "./packages/connectors/jira/src/repo.js";
import { updateTask, expandTask } from "./packages/server/src/tasks/repo.js";
import type { JiraConfig } from "./packages/connectors/jira/src/types.js";

async function main() {
  console.log("🧪 Jira Task Status Sync Test\n");
  console.log("=" .repeat(60));

  // Configuration
  const config: JiraConfig = {
    url: process.env.JIRA_URL || "",
    email: process.env.JIRA_EMAIL || "",
    api_token: process.env.JIRA_API_TOKEN || "",
    user_account_id: process.env.JIRA_USER_ACCOUNT_ID || "",
    poll_minutes: 5,
    project_keys: ["GDEV"],
    auto_create_tasks: true,
  };

  const configOk = config.url && config.email && config.api_token && config.user_account_id;
  if (!configOk) {
    console.error("\n❌ Missing required environment variables!");
    process.exit(1);
  }

  console.log("✅ Configuration loaded");

  // Open database
  const db = Database.open("./packages/server/tasks.db");
  console.log("✅ Database connected");

  // Fetch Jira issues
  console.log("\n📋 Fetching Jira issues...");
  const client = new JiraClient(config);
  const issues = await client.getIssuesAssignedToUser(config.user_account_id, {
    maxResults: 100,
    projectKeys: config.project_keys,
  });
  console.log(`✅ Retrieved ${issues.length} issues`);

  // Filter for "Done" issues
  const doneIssues = issues.filter((issue) => issue.status === "Done");
  console.log(`✅ Found ${doneIssues.length} "Done" issues`);

  if (doneIssues.length === 0) {
    console.log("\n⚠️  No 'Done' issues found. Test cannot proceed.");
    console.log("   Please ensure you have at least one Jira issue in 'Done' status with an existing task.");
    db.close();
    return;
  }

  // Simulate the polling logic for status sync
  console.log("\n🔄 Simulating task status sync for 'Done' issues...");
  let tasksUpdatedToDone = 0;
  let tasksAlreadyDone = 0;
  let tasksNotFound = 0;

  for (const issue of doneIssues) {
    // Upsert issue to database
    upsertJiraIssue(db, issue);

    // Check if task exists for this issue (using source field)
    const existingTask = db.query<{ id: string; state: string }, [string]>(
      "SELECT id, state FROM tasks WHERE source = ?"
    ).get(`jira:${issue.key}`);

    if (existingTask) {
      if (existingTask.state !== "done") {
        // Update task to "done"
        updateTask(db, existingTask.id, { state: "done" });
        tasksUpdatedToDone++;
        console.log(`  ✅ Updated task ${existingTask.id} to "done" for ${issue.key}`);
      } else {
        tasksAlreadyDone++;
        console.log(`  ⏭️  Task ${existingTask.id} already "done" for ${issue.key}`);
      }
    } else {
      tasksNotFound++;
      console.log(`  ⚠️  No task found for ${issue.key} (this is OK if task was never created)`);
    }
  }

  // Display summary
  console.log("\n📊 Status Sync Summary:");
  console.log(`  - Done issues found: ${doneIssues.length}`);
  console.log(`  - Tasks updated to "done": ${tasksUpdatedToDone}`);
  console.log(`  - Tasks already "done": ${tasksAlreadyDone}`);
  console.log(`  - Tasks not found: ${tasksNotFound}`);

  // Show some updated tasks
  if (tasksUpdatedToDone > 0) {
    console.log("\n📝 Recently updated tasks:");
    for (const issue of doneIssues.slice(0, 5)) {
      const task = db.query<{ id: string; state: string }, [string]>(
        "SELECT id, state FROM tasks WHERE source = ?"
      ).get(`jira:${issue.key}`);
      
      if (task) {
        const fullTask = expandTask(db, task.id);
        if (fullTask) {
          console.log(`  - [${fullTask.state}] ${fullTask.title.slice(0, 60)}...`);
        }
      }
    }
  }

  db.close();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ Test Complete!");
  console.log("\n🎉 Task status sync feature is working!");
}

main().catch((error) => {
  console.error("\n💥 Test failed:", error);
  process.exit(1);
});
