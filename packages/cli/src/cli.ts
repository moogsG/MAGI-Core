#!/usr/bin/env bun
import { Command } from "commander";
import { getClient, closeClient } from "./client.js";
import { addTask } from "./commands/add.js";
import { listTasks } from "./commands/list.js";
import { expandTask } from "./commands/expand.js";
import { exportTasks } from "./commands/export.js";
import { planTasks } from "./commands/plan.js";
import { importScan } from "./commands/import-scan.js";

const program = new Command();

program
  .name("mcp-tasks")
  .description("CLI for managing tasks via MCP server")
  .version("0.1.0");

// Add command
program
  .command("add <title>")
  .description("Create a new task")
  .option("-p, --priority <priority>", "Task priority (low, med, high)", "med")
  .option("-d, --due <date>", "Due date (YYYY-MM-DD or ISO format)")
  .option("-s, --source <source>", "Task source")
  .option("-b, --body <body>", "Task body/description")
  .action(async (title, options) => {
    const client = await getClient();
    await addTask(client, title, options);
    await closeClient();
  });

// List command
program
  .command("list")
  .description("List tasks")
  .option("--state <states...>", "Filter by state (inbox, open, done)")
  .option("--priority <priorities...>", "Filter by priority (low, med, high)")
  .option("-l, --limit <number>", "Maximum number of tasks to return", "20")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const client = await getClient();
    await listTasks(client, {
      ...options,
      limit: parseInt(options.limit),
    });
    await closeClient();
  });

// Expand command
program
  .command("expand <taskId>")
  .description("Show full details for a task")
  .option("--json", "Output as JSON")
  .action(async (taskId, options) => {
    const client = await getClient();
    await expandTask(client, taskId, options);
    await closeClient();
  });

// Export command
program
  .command("export")
  .description("Export tasks to markdown or JSON")
  .option("-o, --output <file>", "Output file path")
  .option("-g, --group-by <groupBy>", "Group by: day, week, month, state, priority", "state")
  .option("--state <states...>", "Filter by state (inbox, open, done)")
  .option("--priority <priorities...>", "Filter by priority (low, med, high)")
  .option("--include-prompts", "Include suggested prompts in export")
  .option("--json", "Export as JSON instead of markdown")
  .action(async (options) => {
    const client = await getClient();
    await exportTasks(client, options);
    await closeClient();
  });

// Plan command
program
  .command("plan")
  .description("Plan tasks for a time period using docs context")
  .option("--hours <hours>", "Hours available for work", "4")
  .option("--docs <path>", "Path to docs directory", "docs")
  .action(async (options) => {
    const client = await getClient();
    await planTasks(client, {
      hours: parseFloat(options.hours),
      docsPath: options.docs,
    });
    await closeClient();
  });

// Import.scan command
program
  .command("import.scan")
  .description("Scan and import tasks from a markdown file")
  .requiredOption("-f, --file <file>", "File to scan")
  .option("-s, --source <source>", "Source label for imported tasks")
  .option("--dry-run", "Preview without importing")
  .action(async (options) => {
    const client = await getClient();
    await importScan(client, options);
    await closeClient();
  });

// Examples in help
program.addHelpText(
  "after",
  `
Examples:
  $ mcp-tasks add "Fix Pax8 sync" -p high -d 2025-11-05
  $ mcp-tasks list --state open --priority high
  $ mcp-tasks expand abc123
  $ mcp-tasks export -o tasks.md --group-by priority
  $ mcp-tasks plan --hours 4
  $ mcp-tasks import.scan -f backlog.md --dry-run

Environment Variables:
  MCP_SERVER_COMMAND    Command to start MCP server (default: bun)
  MCP_SERVER_ARGS       Arguments for MCP server (default: packages/server/src/index.ts)

For more information, visit: https://github.com/your-org/magi-core
`
);

// Error handling
process.on("unhandledRejection", (error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

program.parse();
