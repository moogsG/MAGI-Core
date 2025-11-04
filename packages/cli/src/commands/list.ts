import type { MCPTaskClient } from "../client.js";

export interface ListTasksOptions {
  state?: string[];
  priority?: string[];
  limit?: number;
  json?: boolean;
}

export async function listTasks(
  client: MCPTaskClient,
  options: ListTasksOptions
): Promise<void> {
  try {
    const result = await client.listTasks({
      filter: {
        state: options.state as any,
        priority: options.priority as any,
      },
      limit: options.limit ?? 20,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n📋 Tasks (${result.items.length} items)\n`);
    console.log("─".repeat(80));

    for (const task of result.items) {
      // Handle abbreviated format: t=title, s=state, d=due_ts, p=preview
      const title = task.t || task.title;
      const state = task.s || task.state;
      const due_ts = task.d || task.due_ts;
      const priority = task.priority || "med"; // Priority not in handle format
      
      const priorityEmoji = getPriorityEmoji(priority);
      const stateEmoji = getStateEmoji(state);
      
      console.log(`${stateEmoji} ${priorityEmoji} ${title}`);
      console.log(`   ID: ${task.id} | State: ${state}`);
      
      if (due_ts) {
        const dueDate = new Date(due_ts);
        const isOverdue = dueDate < new Date();
        const dueDateStr = dueDate.toLocaleDateString();
        console.log(`   Due: ${dueDateStr}${isOverdue ? " ⚠️  OVERDUE" : ""}`);
      }
      
      console.log("─".repeat(80));
    }

    console.log(`\nShowing ${result.items.length} tasks`);
  } catch (error) {
    console.error("❌ Failed to list tasks:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
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
