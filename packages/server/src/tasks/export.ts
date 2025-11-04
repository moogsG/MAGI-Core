import type { DB } from "../db/index.js";
import type { Task } from "./types.js";
import type {
  GroupedTasks,
  TaskWithContext,
  GroupByOption
} from "./export.types.js";
import { PROMPT_TEMPLATES } from "./export.types.js";

/**
 * Group tasks by the specified criterion
 */
export function groupTasks(tasks: Task[], groupBy: GroupByOption): GroupedTasks[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    let groupKey: string;

    switch (groupBy) {
      case "day": {
        const date = new Date(task.created_ts);
        groupKey = date.toISOString().split("T")[0];
        break;
      }
      case "week": {
        const date = new Date(task.created_ts);
        const weekStart = getWeekStart(date);
        groupKey = weekStart.toISOString().split("T")[0];
        break;
      }
      case "month": {
        const date = new Date(task.created_ts);
        groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      }
      case "state": {
        groupKey = task.state;
        break;
      }
      case "priority": {
        groupKey = task.priority;
        break;
      }
      default:
        groupKey = "all";
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(task);
  }

  // Convert to array and sort by group key (descending for dates, ascending for others)
  const sortedGroups = Array.from(groups.entries()).sort(([keyA], [keyB]) => {
    if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
      return keyB.localeCompare(keyA); // Most recent first
    }
    return keyA.localeCompare(keyB);
  });

  return sortedGroups.map(([groupKey, tasks]) => ({
    groupKey,
    groupLabel: groups.get(groupKey) ? 
      (groupBy === "day" ? formatDateLabel(new Date(tasks[0].created_ts)) :
       groupBy === "week" ? `Week of ${formatDateLabel(getWeekStart(new Date(tasks[0].created_ts)))}` :
       groupBy === "month" ? new Date(tasks[0].created_ts).toLocaleDateString("en-US", { year: "numeric", month: "long" }) :
       groupBy === "state" ? tasks[0].state.charAt(0).toUpperCase() + tasks[0].state.slice(1) :
       `${tasks[0].priority.charAt(0).toUpperCase() + tasks[0].priority.slice(1)} Priority`) : groupKey,
    tasks: tasks.map(taskToContext)
  }));
}

/**
 * Convert Task to TaskWithContext
 */
function taskToContext(task: Task): TaskWithContext {
  const context = task.summary || (task.body ? task.body.slice(0, 300) : "");
  return {
    id: task.id,
    title: task.title,
    state: task.state,
    priority: task.priority,
    due_ts: task.due_ts ?? null,
    source: task.source ?? null,
    created_ts: task.created_ts,
    context
  };
}

/**
 * Format a date as a readable label
 */
function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  return date.toLocaleDateString("en-US", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Format a single task as markdown
 */
export function formatTaskMarkdown(task: TaskWithContext, includePrompts: boolean): string {
  const lines: string[] = [];

  // Task header with title
  lines.push(`### ${task.title}`);
  lines.push("");

  // Metadata section
  lines.push(`- **ID:** \`${task.id}\``);
  lines.push(`- **State:** ${getStateEmoji(task.state)} ${task.state}`);
  lines.push(`- **Priority:** ${getPriorityEmoji(task.priority)} ${task.priority}`);
  
  if (task.due_ts) {
    const dueDate = new Date(task.due_ts);
    lines.push(`- **Due:** ${dueDate.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    })}`);
  }
  
  lines.push(`- **Source:** ${task.source || "local"}`);
  
  const createdDate = new Date(task.created_ts);
  lines.push(`- **Created:** ${createdDate.toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "short", 
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`);
  
  lines.push("");

  // Context section
  if (task.context) {
    lines.push("**Context:**");
    lines.push("");
    lines.push(task.context);
    lines.push("");
  }

  // Suggested prompts
  if (includePrompts) {
    lines.push("**💡 Suggested Prompts:**");
    lines.push("");
    for (const template of PROMPT_TEMPLATES) {
      lines.push(`- ${template.label}: ${template.template(task.title)}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

/**
 * Format grouped tasks as complete markdown document
 */
export function formatMarkdownDocument(
  groupedTasks: GroupedTasks[],
  includePrompts: boolean
): string {
  const lines: string[] = [];

  // Document header
  lines.push("# Tasks Export");
  lines.push("");
  lines.push(`*Generated: ${new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })}*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Process each group
  for (const group of groupedTasks) {
    lines.push(`## ${group.groupLabel}`);
    lines.push("");
    lines.push(`*${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"}*`);
    lines.push("");

    for (const task of group.tasks) {
      lines.push(formatTaskMarkdown(task, includePrompts));
    }
  }

  return lines.join("\n");
}

/**
 * Get emoji for task state
 */
function getStateEmoji(state: string): string {
  switch (state) {
    case "inbox": return "📥";
    case "open": return "🔄";
    case "done": return "✅";
    default: return "❓";
  }
}

/**
 * Get emoji for priority
 */
function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case "high": return "🔴";
    case "med": return "🟡";
    case "low": return "🟢";
    default: return "⚪";
  }
}

/**
 * Fetch all tasks from database with optional filtering
 */
export function fetchTasksForExport(
  db: DB,
  filter?: { state?: string[]; priority?: string[] }
): Task[] {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params: any[] = [];

  if (filter?.state?.length) {
    sql += ` AND state IN (${filter.state.map(() => "?").join(",")})`;
    params.push(...filter.state);
  }

  if (filter?.priority?.length) {
    sql += ` AND priority IN (${filter.priority.map(() => "?").join(",")})`;
    params.push(...filter.priority);
  }

  sql += " ORDER BY created_ts DESC";

  const rows = db.query(sql).all(...params);
  return rows as Task[];
}
