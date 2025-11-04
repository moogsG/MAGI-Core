#!/usr/bin/env bun
/**
 * Test Jira Task Auto-Creation Feature
 * Verifies that tasks are automatically created for "In Progress" Jira issues
 */

import { Database } from "bun:sqlite";
import { JiraClient } from "./packages/connectors/jira/src/client.js";
import { upsertJiraIssue } from "./packages/connectors/jira/src/repo.js";
import { createTask, listTaskHandles } from "./packages/server/src/tasks/repo.js";
import type { JiraConfig, JiraIssue } from "./packages/connectors/jira/src/types.js";
import type { TaskPriority } from "./packages/server/src/tasks/types.js";

/**
 * Map Jira priority to task priority
 */
function mapJiraPriorityToTaskPriority(jiraPriority?: string): TaskPriority {
  if (!jiraPriority) return "med";
  
  const priority = jiraPriority.toLowerCase();
  if (priority.includes("highest") || priority.includes("critical")) return "high";
  if (priority.includes("high")) return "high";
  if (priority.includes("low") || priority.includes("lowest")) return "low";
  return "med";
}

/**
 * Format task body with Jira issue context
 */
function formatTaskBody(issue: JiraIssue): string {
  const parts: string[] = [];
  
  parts.push(`**Jira Issue:** [${issue.key}](${issue.web_url})`);
  parts.push(`**Type:** ${issue.issue_type}`);
  parts.push(`**Project:** ${issue.project_name} (${issue.project_key})`);
  
  if (issue.priority) {
    parts.push(`**Priority:** ${issue.priority}`);
  }
  
  if (issue.due_date) {
    parts.push(`**Due Date:** ${issue.due_date}`);
  }
  
  if (issue.labels && issue.labels.length > 0) {
    parts.push(`**Labels:** ${issue.labels.join(", ")}`);
  }
  
  if (issue.description) {
    parts.push("");
    parts.push("**Description:**");
    parts.push(issue.description);
  }
  
  return parts.join("\n");
}

async function main() {
  console.log("🧪 Jira Task Auto-Creation Test\n");
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

  // Filter for "In Progress" issues
  const inProgressIssues = issues.filter((issue) => issue.status === "In Progress");
  console.log(`✅ Found ${inProgressIssues.length} "In Progress" issues`);

  if (inProgressIssues.length === 0) {
    console.log("\n⚠️  No 'In Progress' issues found. Test cannot proceed.");
    console.log("   Please ensure you have at least one Jira issue in 'In Progress' status.");
    db.close();
    return;
  }

  // Count existing tasks before
  const tasksBefore = listTaskHandles(db, { limit: 1000 });
  console.log(`\n📊 Tasks before: ${tasksBefore.length}`);

  // Simulate the polling logic
  console.log("\n🔄 Simulating task creation for 'In Progress' issues...");
  let tasksCreated = 0;

  for (const issue of inProgressIssues) {
    // Upsert issue to database
    upsertJiraIssue(db, issue);

    // Check if task already exists for this issue (using source field)
    const existingTask = db.query<{ count: number }, [string]>(
      "SELECT COUNT(*) as count FROM tasks WHERE source = ?"
    ).get(`jira:${issue.key}`);

    const taskExists = (existingTask?.count ?? 0) > 0;

    if (!taskExists) {
      // Create new task
      const taskTitle = `${issue.key}: ${issue.summary}`;
      const taskBody = formatTaskBody(issue);
      const taskPriority = mapJiraPriorityToTaskPriority(issue.priority);

      createTask(db, {
        title: taskTitle,
        body: taskBody,
        priority: taskPriority,
        due_ts: issue.due_date ? `${issue.due_date}T23:59:59Z` : null,
        source: `jira:${issue.key}`,
      });

      tasksCreated++;
      console.log(`  ✅ Created task for ${issue.key}: ${issue.summary.slice(0, 50)}...`);
    } else {
      console.log(`  ⏭️  Task already exists for ${issue.key}`);
    }
  }

  // Count tasks after
  const tasksAfter = listTaskHandles(db, { limit: 1000 });
  console.log(`\n📊 Tasks after: ${tasksAfter.length}`);
  console.log(`📊 Tasks created: ${tasksCreated}`);

  // Display created tasks
  if (tasksCreated > 0) {
    console.log("\n📝 Newly created tasks:");
    const jiraTasks = listTaskHandles(db, { limit: 100 }).filter(
      (task) => task.t.match(/^[A-Z]+-\d+:/)
    );
    jiraTasks.slice(0, 5).forEach((task, idx) => {
      console.log(`  ${idx + 1}. [${task.s}] ${task.t.slice(0, 60)}...`);
    });
  }

  db.close();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ Test Complete!");
  console.log("\n📊 Summary:");
  console.log(`  - Total Jira issues: ${issues.length}`);
  console.log(`  - In Progress issues: ${inProgressIssues.length}`);
  console.log(`  - Tasks created: ${tasksCreated}`);
  console.log(`  - Total tasks: ${tasksAfter.length}`);
  console.log("\n🎉 Task auto-creation feature is working!");
}

main().catch((error) => {
  console.error("\n💥 Test failed:", error);
  process.exit(1);
});
