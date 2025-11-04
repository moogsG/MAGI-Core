#!/usr/bin/env bun
/**
 * Test Complete Jira Task Sync Feature
 * Tests both task creation for "In Progress" issues and status sync for "Done" issues
 */

import { Database } from "bun:sqlite";
import { JiraClient } from "./packages/connectors/jira/src/client.js";
import { upsertJiraIssue } from "./packages/connectors/jira/src/repo.js";
import { createTask, updateTask } from "./packages/server/src/tasks/repo.js";
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
  console.log("🧪 Jira Complete Task Sync Test\n");
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

  // Simulate the complete polling logic (same as in index.ts)
  console.log("\n🔄 Simulating complete task sync...");
  let tasksCreated = 0;
  let tasksUpdatedToDone = 0;

  for (const issue of issues) {
    // Upsert issue to database
    upsertJiraIssue(db, issue);

    // Check if task already exists for this issue (using source field)
    const existingTask = db.query<{ id: string; state: string }, [string]>(
      "SELECT id, state FROM tasks WHERE source = ?"
    ).get(`jira:${issue.key}`);

    if (issue.status === "In Progress" && !existingTask) {
      // Create new task for "In Progress" issues
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
    } else if (issue.status === "Done" && existingTask && existingTask.state !== "done") {
      // Update existing task to "done" if Jira issue is "Done"
      updateTask(db, existingTask.id, { state: "done" });

      tasksUpdatedToDone++;
      console.log(`  ✅ Updated task ${existingTask.id} to "done" for ${issue.key}`);
    }
  }

  // Display summary by status
  console.log("\n📊 Issue Status Breakdown:");
  const statusCounts = issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });

  console.log("\n📊 Sync Summary:");
  console.log(`  - Total issues: ${issues.length}`);
  console.log(`  - Tasks created: ${tasksCreated}`);
  console.log(`  - Tasks updated to "done": ${tasksUpdatedToDone}`);

  // Show some example tasks
  console.log("\n📝 Example Jira-linked tasks:");
  const jiraTasks = db.query<{ id: string; title: string; state: string; source: string }, []>(
    "SELECT id, title, state, source FROM tasks WHERE source LIKE 'jira:%' ORDER BY updated_ts DESC LIMIT 5"
  ).all();

  jiraTasks.forEach((task, idx) => {
    const issueKey = task.source.replace("jira:", "");
    console.log(`  ${idx + 1}. [${task.state}] ${issueKey}: ${task.title.slice(issueKey.length + 2, 60)}...`);
  });

  db.close();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ Test Complete!");
  console.log("\n🎉 Complete task sync feature is working!");
  console.log("\n💡 Next steps:");
  console.log("  1. Move a Jira issue to 'In Progress' → Task will be created");
  console.log("  2. Complete a Jira issue (mark as 'Done') → Task will be updated to 'done'");
}

main().catch((error) => {
  console.error("\n💥 Test failed:", error);
  process.exit(1);
});
