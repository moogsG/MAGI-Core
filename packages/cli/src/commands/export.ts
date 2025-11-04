import type { MCPTaskClient } from "../client.js";
import { writeFile } from "fs/promises";

export interface ExportTasksOptions {
  output?: string;
  groupBy?: "day" | "week" | "month" | "state" | "priority";
  state?: string[];
  priority?: string[];
  includePrompts?: boolean;
  json?: boolean;
}

export async function exportTasks(
  client: MCPTaskClient,
  options: ExportTasksOptions
): Promise<void> {
  try {
    // Fetch all tasks
    const result = await client.listTasks({
      filter: {
        state: options.state as any,
        priority: options.priority as any,
      },
      limit: 100,
    });

    if (options.json) {
      const output = JSON.stringify(result, null, 2);
      
      if (options.output) {
        await writeFile(options.output, output);
        console.log(`✅ Exported ${result.items.length} tasks to ${options.output}`);
      } else {
        console.log(output);
      }
      return;
    }

    // Generate markdown export
    const markdown = generateMarkdownExport(result.items, options);

    if (options.output) {
      await writeFile(options.output, markdown);
      console.log(`✅ Exported ${result.items.length} tasks to ${options.output}`);
    } else {
      console.log(markdown);
    }
  } catch (error) {
    console.error("❌ Failed to export tasks:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function generateMarkdownExport(tasks: any[], options: ExportTasksOptions): string {
  const lines: string[] = [];

  // Header
  lines.push("# Tasks Export");
  lines.push("");
  lines.push(`*Generated: ${new Date().toLocaleString()}*`);
  lines.push("");
  lines.push(`Total tasks: ${tasks.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Group tasks if requested
  const grouped = groupTasks(tasks, options.groupBy ?? "state");

  for (const [groupKey, groupTasks] of Object.entries(grouped)) {
    lines.push(`## ${formatGroupLabel(groupKey, options.groupBy ?? "state")}`);
    lines.push("");
    lines.push(`*${groupTasks.length} task${groupTasks.length === 1 ? "" : "s"}*`);
    lines.push("");

    for (const task of groupTasks) {
      // Handle abbreviated format
      const title = task.t || task.title || "Untitled";
      const state = task.s || task.state || "inbox";
      const priority = task.priority || "med";
      const due_ts = task.d || task.due_ts;
      const created_ts = task.created_ts || new Date().toISOString();
      
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(`- **ID:** \`${task.id}\``);
      lines.push(`- **State:** ${getStateEmoji(state)} ${state}`);
      lines.push(`- **Priority:** ${getPriorityEmoji(priority)} ${priority}`);
      
      if (due_ts) {
        const dueDate = new Date(due_ts);
        lines.push(`- **Due:** ${dueDate.toLocaleDateString()}`);
      }
      
      lines.push(`- **Created:** ${new Date(created_ts).toLocaleDateString()}`);
      lines.push("");

      if (options.includePrompts) {
        lines.push("**💡 Suggested Prompts:**");
        lines.push("");
        lines.push(`- Expand: "Show me details for task ${task.id}"`);
        lines.push(`- Update: "Mark task ${task.id} as done"`);
        lines.push(`- Plan: "Help me plan work on: ${task.title}"`);
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function groupTasks(tasks: any[], groupBy: string): Record<string, any[]> {
  const groups: Record<string, any[]> = {};

  for (const task of tasks) {
    let key: string;
    
    // Handle abbreviated format
    const state = task.s || task.state || "inbox";
    const priority = task.priority || "med";
    const created_ts = task.created_ts || new Date().toISOString();

    switch (groupBy) {
      case "day": {
        const date = new Date(created_ts);
        key = date.toISOString().split("T")[0];
        break;
      }
      case "week": {
        const date = new Date(created_ts);
        const weekStart = getWeekStart(date);
        key = weekStart.toISOString().split("T")[0];
        break;
      }
      case "month": {
        const date = new Date(created_ts);
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      }
      case "state":
        key = state;
        break;
      case "priority":
        key = priority;
        break;
      default:
        key = "all";
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(task);
  }

  return groups;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatGroupLabel(key: string, groupBy: string): string {
  switch (groupBy) {
    case "day":
      return new Date(key).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    case "week":
      return `Week of ${new Date(key).toLocaleDateString()}`;
    case "month":
      return new Date(key + "-01").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
    case "state":
      return key.charAt(0).toUpperCase() + key.slice(1);
    case "priority":
      return `${key.charAt(0).toUpperCase() + key.slice(1)} Priority`;
    default:
      return key;
  }
}

function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case "high": return "🔴";
    case "med": return "🟡";
    case "low": return "🟢";
    default: return "⚪";
  }
}

function getStateEmoji(state: string): string {
  switch (state) {
    case "inbox": return "📥";
    case "open": return "🔄";
    case "done": return "✅";
    default: return "❓";
  }
}
