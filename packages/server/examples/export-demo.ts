#!/usr/bin/env bun
/**
 * Demo script for task markdown export feature
 * 
 * Usage:
 *   bun examples/export-demo.ts
 */

import { openDB } from "../src/db/index.js";
import { createTask, exportMarkdown } from "../src/tasks/repo.js";

console.log("🚀 Task Markdown Export Demo\n");

// Use in-memory database for demo
process.env.TASKS_DB_PATH = ":memory:";
const db = openDB();

// Create sample tasks
console.log("📝 Creating sample tasks...");

const tasks = [
  {
    title: "Implement user authentication",
    body: "Add OAuth2 support with Google and GitHub providers. Include session management and token refresh.",
    priority: "high" as const,
    due_ts: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    source: "github"
  },
  {
    title: "Write API documentation",
    body: "Document all REST endpoints with request/response examples. Include authentication requirements.",
    priority: "med" as const,
    source: "notion"
  },
  {
    title: "Fix mobile layout bug",
    body: "Safari on iOS shows incorrect padding on the dashboard. Investigate and fix CSS.",
    priority: "high" as const,
    source: "slack"
  },
  {
    title: "Update dependencies",
    body: "Upgrade all npm packages to latest stable versions. Test for breaking changes.",
    priority: "low" as const,
    source: "local"
  },
  {
    title: "Add unit tests for auth module",
    body: "Increase test coverage to 90%+. Focus on edge cases and error handling.",
    priority: "med" as const,
    source: "github"
  }
];

for (const task of tasks) {
  createTask(db, task);
}

console.log(`✓ Created ${tasks.length} tasks\n`);

// Demo 1: Export grouped by day with prompts
console.log("📄 Export 1: Grouped by day with AI prompts");
const result1 = exportMarkdown(db, {
  path: "./demo-by-day.md",
  groupBy: "day",
  includePrompts: true
});
console.log(`   ✓ ${result1.taskCount} tasks → ${result1.path}\n`);

// Demo 2: Export grouped by priority without prompts
console.log("📄 Export 2: Grouped by priority (no prompts)");
const result2 = exportMarkdown(db, {
  path: "./demo-by-priority.md",
  groupBy: "priority",
  includePrompts: false
});
console.log(`   ✓ ${result2.taskCount} tasks → ${result2.path}\n`);

// Demo 3: Export high priority tasks only
console.log("📄 Export 3: High priority tasks only");
const result3 = exportMarkdown(db, {
  path: "./demo-high-priority.md",
  groupBy: "state",
  includePrompts: true,
  filter: { priority: ["high"] }
});
console.log(`   ✓ ${result3.taskCount} tasks → ${result3.path}\n`);

// Demo 4: Export by state
console.log("📄 Export 4: Grouped by state");
const result4 = exportMarkdown(db, {
  path: "./demo-by-state.md",
  groupBy: "state",
  includePrompts: true
});
console.log(`   ✓ ${result4.taskCount} tasks → ${result4.path}\n`);

console.log("✅ All exports completed successfully!");
console.log("\n💡 Check the generated markdown files:");
console.log("   - demo-by-day.md");
console.log("   - demo-by-priority.md");
console.log("   - demo-high-priority.md");
console.log("   - demo-by-state.md");
console.log("\n📖 See docs/EXPORT_MARKDOWN.md for full documentation");
