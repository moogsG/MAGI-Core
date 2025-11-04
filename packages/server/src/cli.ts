#!/usr/bin/env node
import { openDB } from "./db/index.js";
import { createTask, listTaskHandles, expandTask, updateTask } from "./tasks/repo.js";
import type { TaskState, TaskPriority } from "./tasks/types.js";

const db = openDB(process.env.TASKS_DB_PATH || "tasks.db");

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
📋 MAGI Task CLI

Usage:
  bun cli.ts <command> [options]

Commands:
  list [--state=<state>] [--priority=<priority>] [--limit=<n>] [--search=<query>]
    List tasks with optional filters
    
  create <title> [--body=<text>] [--priority=<low|med|high>] [--due=<ISO date>]
    Create a new task
    
  show <task_id>
    Show full task details
    
  update <task_id> [--state=<inbox|open|done>] [--priority=<low|med|high>] [--title=<text>]
    Update a task
    
  stats
    Show database statistics
    
  help
    Show this help message

Examples:
  bun cli.ts list --state=inbox --limit=10
  bun cli.ts create "Fix bug in login" --priority=high
  bun cli.ts show t_12345678
  bun cli.ts update t_12345678 --state=done
  bun cli.ts stats
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      parsed[key] = value || "true";
    }
  }
  return parsed;
}

function cmdList() {
  const opts = parseArgs(args.slice(1));
  const limit = opts.limit ? parseInt(opts.limit) : 20;
  const state = opts.state ? [opts.state as TaskState] : undefined;
  const priority = opts.priority ? [opts.priority as TaskPriority] : undefined;
  const q = opts.search || null;

  const start = performance.now();
  const tasks = listTaskHandles(db, { limit, state, priority, q });
  const elapsed = performance.now() - start;

  console.log(`\n📋 Tasks (${tasks.length} results in ${elapsed.toFixed(2)}ms)\n`);
  
  if (tasks.length === 0) {
    console.log("  No tasks found.\n");
    return;
  }

  for (const task of tasks) {
    const stateIcon = task.s === "done" ? "✅" : task.s === "open" ? "🔵" : "📥";
    const dueStr = task.d ? ` 📅 ${task.d.slice(0, 10)}` : "";
    console.log(`  ${stateIcon} ${task.id} - ${task.t}${dueStr}`);
    if (task.p) {
      console.log(`     ${task.p.slice(0, 80)}${task.p.length > 80 ? "..." : ""}`);
    }
    console.log();
  }
}

function cmdCreate() {
  const title = args[1];
  if (!title) {
    console.error("❌ Error: Title is required");
    console.log("Usage: bun cli.ts create <title> [--body=<text>] [--priority=<low|med|high>]");
    process.exit(1);
  }

  const opts = parseArgs(args.slice(2));
  const result = createTask(db, {
    title,
    body: opts.body || null,
    priority: (opts.priority as TaskPriority) || "med",
    due_ts: opts.due || null,
    source: "cli"
  });

  console.log(`\n✅ Created task: ${result.id}`);
  console.log(`   Title: ${result.t}`);
  console.log(`   State: ${result.s}\n`);
}

function cmdShow() {
  const id = args[1];
  if (!id) {
    console.error("❌ Error: Task ID is required");
    console.log("Usage: bun cli.ts show <task_id>");
    process.exit(1);
  }

  const task = expandTask(db, id);
  if (!task) {
    console.error(`❌ Error: Task not found: ${id}`);
    process.exit(1);
  }

  console.log(`\n📋 Task Details\n`);
  console.log(`  ID:          ${task.id}`);
  console.log(`  Title:       ${task.title}`);
  console.log(`  State:       ${task.state}`);
  console.log(`  Priority:    ${task.priority}`);
  console.log(`  Estimate:    ${task.estimate_min ? task.estimate_min + " min" : "—"}`);
  console.log(`  Due:         ${task.due_ts || "—"}`);
  console.log(`  Source:      ${task.source || "—"}`);
  console.log(`  Created:     ${task.created_ts}`);
  console.log(`  Updated:     ${task.updated_ts}`);
  
  if (task.body) {
    console.log(`\n  Body:\n    ${task.body.split("\n").join("\n    ")}`);
  }
  
  if (task.summary) {
    console.log(`\n  Summary:\n    ${task.summary}`);
  }

  // Show links
  const links = db.prepare("SELECT kind, url FROM links WHERE task_id = ?").all(id) as Array<{ kind: string; url: string }>;
  if (links.length > 0) {
    console.log(`\n  Links:`);
    for (const link of links) {
      console.log(`    [${link.kind}] ${link.url}`);
    }
  }

  // Show events
  const events = db.prepare("SELECT kind, at_ts FROM events WHERE task_id = ? ORDER BY at_ts DESC LIMIT 5").all(id) as Array<{ kind: string; at_ts: string }>;
  if (events.length > 0) {
    console.log(`\n  Recent Events:`);
    for (const event of events) {
      console.log(`    [${event.kind}] ${event.at_ts}`);
    }
  }

  console.log();
}

function cmdUpdate() {
  const id = args[1];
  if (!id) {
    console.error("❌ Error: Task ID is required");
    console.log("Usage: bun cli.ts update <task_id> [--state=<state>] [--priority=<priority>] [--title=<text>]");
    process.exit(1);
  }

  const opts = parseArgs(args.slice(2));
  const patch: any = {};
  
  if (opts.state) patch.state = opts.state;
  if (opts.priority) patch.priority = opts.priority;
  if (opts.title) patch.title = opts.title;
  if (opts.body) patch.body = opts.body;
  if (opts.summary) patch.summary = opts.summary;
  if (opts.estimate) patch.estimate_min = parseInt(opts.estimate);
  if (opts.due) patch.due_ts = opts.due;

  if (Object.keys(patch).length === 0) {
    console.error("❌ Error: No fields to update");
    console.log("Usage: bun cli.ts update <task_id> [--state=<state>] [--priority=<priority>] [--title=<text>]");
    process.exit(1);
  }

  const result = updateTask(db, id, patch);
  
  if (!result.ok) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\n✅ Updated task: ${id}`);
  console.log(`   Fields updated: ${Object.keys(patch).join(", ")}\n`);
}

function cmdStats() {
  console.log("\n📊 Database Statistics\n");

  const tables = [
    { name: "tasks", label: "Tasks" },
    { name: "links", label: "Links" },
    { name: "events", label: "Events" },
    { name: "slack_messages", label: "Slack Messages" },
    { name: "outlook_messages", label: "Outlook Messages" },
    { name: "calendars", label: "Calendar Events" }
  ];

  for (const table of tables) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
    console.log(`  ${table.label.padEnd(20)} ${count.count.toLocaleString()}`);
  }

  console.log("\n  Task Breakdown:");
  const states = db.prepare("SELECT state, COUNT(*) as count FROM tasks GROUP BY state").all() as Array<{ state: string; count: number }>;
  for (const s of states) {
    console.log(`    ${s.state.padEnd(10)} ${s.count.toLocaleString()}`);
  }

  console.log("\n  Priority Breakdown:");
  const priorities = db.prepare("SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority").all() as Array<{ priority: string; count: number }>;
  for (const p of priorities) {
    console.log(`    ${p.priority.padEnd(10)} ${p.count.toLocaleString()}`);
  }

  console.log();
}

// Main command router
switch (command) {
  case "list":
    cmdList();
    break;
  case "create":
    cmdCreate();
    break;
  case "show":
    cmdShow();
    break;
  case "update":
    cmdUpdate();
    break;
  case "stats":
    cmdStats();
    break;
  case "help":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`❌ Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}

db.close();
