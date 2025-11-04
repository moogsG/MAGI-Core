import type { MCPTaskClient } from "../client.js";

export interface AddTaskOptions {
  priority?: "low" | "med" | "high";
  due?: string;
  source?: string;
  body?: string;
}

export async function addTask(
  client: MCPTaskClient,
  title: string,
  options: AddTaskOptions
): Promise<void> {
  try {
    // Parse due date if provided
    let due_ts: string | undefined;
    if (options.due) {
      const dueDate = new Date(options.due);
      if (isNaN(dueDate.getTime())) {
        throw new Error(`Invalid date format: ${options.due}`);
      }
      due_ts = dueDate.toISOString();
    }

    const result = await client.createTask({
      title,
      body: options.body,
      priority: options.priority,
      due_ts,
      source: options.source,
    });

    console.log("✅ Task created successfully!");
    console.log(`ID: ${result.id}`);
    console.log(`Title: ${result.t || title}`);
    console.log(`Priority: ${options.priority || "med"}`);
    console.log(`State: ${result.s || "inbox"}`);
    if (due_ts) {
      console.log(`Due: ${new Date(due_ts).toLocaleDateString()}`);
    }
  } catch (error) {
    console.error("❌ Failed to create task:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
