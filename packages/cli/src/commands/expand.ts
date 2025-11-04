import type { MCPTaskClient } from "../client.js";

export interface ExpandTaskOptions {
  json?: boolean;
}

export async function expandTask(
  client: MCPTaskClient,
  taskId: string,
  options: ExpandTaskOptions
): Promise<void> {
  try {
    const result = await client.expandTask(taskId);

    if (result.error) {
      console.error(`❌ Task not found: ${taskId}`);
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n📄 Task Details\n`);
    console.log("═".repeat(80));
    console.log(`Title: ${result.title}`);
    console.log(`ID: ${result.id}`);
    console.log(`State: ${getStateEmoji(result.state)} ${result.state}`);
    console.log(`Priority: ${getPriorityEmoji(result.priority)} ${result.priority}`);
    
    if (result.due_ts) {
      const dueDate = new Date(result.due_ts);
      const isOverdue = dueDate < new Date();
      console.log(`Due: ${dueDate.toLocaleDateString()}${isOverdue ? " ⚠️  OVERDUE" : ""}`);
    }
    
    console.log(`Source: ${result.source || "local"}`);
    console.log(`Created: ${new Date(result.created_ts).toLocaleString()}`);
    console.log(`Updated: ${new Date(result.updated_ts).toLocaleString()}`);
    
    if (result.estimate_min) {
      console.log(`Estimate: ${result.estimate_min} minutes`);
    }

    if (result.body) {
      console.log("\n─".repeat(80));
      console.log("Body:");
      console.log(result.body);
    }

    if (result.summary) {
      console.log("\n─".repeat(80));
      console.log("Summary:");
      console.log(result.summary);
    }

    console.log("═".repeat(80));
  } catch (error) {
    console.error("❌ Failed to expand task:");
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
