import type { MCPTaskClient } from "../client.js";
import { readFile } from "fs/promises";

export interface ImportScanOptions {
  file: string;
  source?: string;
  dryRun?: boolean;
}

export async function importScan(
  client: MCPTaskClient,
  options: ImportScanOptions
): Promise<void> {
  try {
    console.log(`\n📥 Scanning file: ${options.file}\n`);
    console.log("─".repeat(80));

    const content = await readFile(options.file, "utf-8");
    const tasks = parseTasksFromMarkdown(content);

    if (tasks.length === 0) {
      console.log("⚠️  No tasks found in file");
      return;
    }

    console.log(`Found ${tasks.length} potential tasks:\n`);

    const imported: any[] = [];
    const skipped: any[] = [];

    for (const task of tasks) {
      console.log(`📝 ${task.title}`);
      console.log(`   Priority: ${task.priority} | Due: ${task.due_ts || "none"}`);

      if (options.dryRun) {
        console.log("   [DRY RUN - would import]");
      } else {
        try {
          const result = await client.createTask({
            title: task.title,
            body: task.body,
            priority: task.priority,
            due_ts: task.due_ts,
            source: options.source ?? "import",
          });
          imported.push(result);
          console.log(`   ✅ Imported as ${result.id}`);
        } catch (error) {
          skipped.push({ task, error });
          console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log("─".repeat(80));
    }

    console.log(`\n📊 Summary:`);
    if (options.dryRun) {
      console.log(`   Would import: ${tasks.length} tasks`);
    } else {
      console.log(`   Imported: ${imported.length} tasks`);
      console.log(`   Skipped: ${skipped.length} tasks`);
    }
    console.log();
  } catch (error) {
    console.error("❌ Failed to scan file:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

interface ParsedTask {
  title: string;
  body?: string;
  priority: "low" | "med" | "high";
  due_ts?: string;
}

function parseTasksFromMarkdown(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = content.split("\n");

  let currentTask: Partial<ParsedTask> | null = null;
  let bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for task headers (### or - [ ])
    if (line.startsWith("### ")) {
      // Save previous task
      if (currentTask?.title) {
        tasks.push({
          title: currentTask.title,
          body: bodyLines.join("\n").trim() || undefined,
          priority: currentTask.priority ?? "med",
          due_ts: currentTask.due_ts,
        });
      }

      // Start new task
      currentTask = { title: line.replace("### ", "").trim() };
      bodyLines = [];
    } else if (line.match(/^-\s*\[[ x]\]/)) {
      // Checkbox format: - [ ] Task title
      if (currentTask?.title) {
        tasks.push({
          title: currentTask.title,
          body: bodyLines.join("\n").trim() || undefined,
          priority: currentTask.priority ?? "med",
          due_ts: currentTask.due_ts,
        });
      }

      const title = line.replace(/^-\s*\[[ x]\]\s*/, "").trim();
      currentTask = { title };
      bodyLines = [];
    } else if (currentTask && line.startsWith("- **Priority:**")) {
      // Parse priority
      const match = line.match(/Priority:\*\*\s*(high|med|low)/i);
      if (match) {
        currentTask.priority = match[1].toLowerCase() as "low" | "med" | "high";
      }
    } else if (currentTask && line.startsWith("- **Due:**")) {
      // Parse due date
      const match = line.match(/Due:\*\*\s*(.+)/);
      if (match) {
        const dueDate = new Date(match[1].trim());
        if (!isNaN(dueDate.getTime())) {
          currentTask.due_ts = dueDate.toISOString();
        }
      }
    } else if (currentTask && line && !line.startsWith("- **") && !line.startsWith("---")) {
      // Collect body content
      bodyLines.push(line);
    }
  }

  // Save last task
  if (currentTask?.title) {
    tasks.push({
      title: currentTask.title,
      body: bodyLines.join("\n").trim() || undefined,
      priority: currentTask.priority ?? "med",
      due_ts: currentTask.due_ts,
    });
  }

  return tasks;
}
