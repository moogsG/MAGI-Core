import type { MCPTaskClient } from "../client.js";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

export interface PlanTasksOptions {
  hours?: number;
  docsPath?: string;
}

export async function planTasks(
  client: MCPTaskClient,
  options: PlanTasksOptions
): Promise<void> {
  try {
    const hours = options.hours ?? 4;
    const docsPath = options.docsPath ?? "docs";

    console.log(`\n📅 Planning tasks for ${hours} hours of work\n`);
    console.log("─".repeat(80));

    // Load context from docs
    const context = await loadDocsContext(docsPath);
    console.log(`📚 Loaded context from ${context.fileCount} documentation files\n`);

    // Fetch open tasks using hybrid search or fallback to list
    let items: any[] = [];
    
    try {
      const result = await client.queryHybrid({
        query: context.summary,
        k: 20,
        filters: {
          state: ["inbox", "open"],
        },
      });
      items = result.items || [];
      
      // If hybrid search returns no results, fall back to list
      if (items.length === 0) {
        console.log("⚠️  Hybrid search returned no results, using regular list\n");
        const listResult = await client.listTasks({
          filter: {
            state: ["inbox", "open"],
          },
          limit: 20,
        });
        items = listResult.items || [];
      }
    } catch (error) {
      // Fallback to regular list if hybrid search fails
      console.log("⚠️  Hybrid search unavailable, using regular list\n");
      const listResult = await client.listTasks({
        filter: {
          state: ["inbox", "open"],
        },
        limit: 20,
      });
      items = listResult.items || [];
    }
    
    if (items.length === 0) {
      console.log("✅ No open tasks found!");
      return;
    }

    // Calculate total estimated time
    const estimatedMinutes = hours * 60;
    let allocatedMinutes = 0;
    const plannedTasks: any[] = [];

    console.log("🎯 Recommended tasks based on priority and context:\n");

    // Sort by priority and score (handle abbreviated format)
    const sortedTasks = items.sort((a: any, b: any) => {
      const priorityWeight = { high: 3, med: 2, low: 1 };
      const aPriority = priorityWeight[(a.priority || "med") as keyof typeof priorityWeight] || 2;
      const bPriority = priorityWeight[(b.priority || "med") as keyof typeof priorityWeight] || 2;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      const aScore = a.score || 0;
      const bScore = b.score || 0;
      return bScore - aScore;
    });

    for (const task of sortedTasks) {
      const estimate = task.estimate_min ?? 30; // Default 30 min if not set
      const title = task.t || task.title || "Untitled";
      const priority = task.priority || "med";
      const due_ts = task.d || task.due_ts;
      const score = task.score || 0;
      
      if (allocatedMinutes + estimate <= estimatedMinutes) {
        plannedTasks.push(task);
        allocatedMinutes += estimate;

        const priorityEmoji = getPriorityEmoji(priority);
        console.log(`${priorityEmoji} ${title}`);
        console.log(`   ID: ${task.id} | Estimate: ${estimate}min${score > 0 ? ` | Score: ${score.toFixed(2)}` : ""}`);
        
        if (due_ts) {
          const dueDate = new Date(due_ts);
          const isOverdue = dueDate < new Date();
          console.log(`   Due: ${dueDate.toLocaleDateString()}${isOverdue ? " ⚠️  OVERDUE" : ""}`);
        }
        
        console.log("─".repeat(80));
      }

      if (allocatedMinutes >= estimatedMinutes) {
        break;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Tasks planned: ${plannedTasks.length}`);
    console.log(`   Time allocated: ${allocatedMinutes} minutes (${(allocatedMinutes / 60).toFixed(1)} hours)`);
    console.log(`   Time available: ${estimatedMinutes} minutes (${hours} hours)`);
    console.log(`   Remaining: ${estimatedMinutes - allocatedMinutes} minutes\n`);

    if (plannedTasks.length < sortedTasks.length) {
      console.log(`💡 ${sortedTasks.length - plannedTasks.length} additional tasks available for planning\n`);
    }
  } catch (error) {
    console.error("❌ Failed to plan tasks:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function loadDocsContext(docsPath: string): Promise<{ summary: string; fileCount: number }> {
  try {
    const files = await readdir(docsPath);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      return { summary: "project tasks planning", fileCount: 0 };
    }

    // Read first few files to build context
    const contextParts: string[] = [];
    const filesToRead = mdFiles.slice(0, 5); // Limit to 5 files for performance

    for (const file of filesToRead) {
      const content = await readFile(join(docsPath, file), "utf-8");
      // Extract first paragraph or heading
      const lines = content.split("\n").filter((l) => l.trim());
      const summary = lines.slice(0, 3).join(" ");
      contextParts.push(summary);
    }

    return {
      summary: contextParts.join(" "),
      fileCount: mdFiles.length,
    };
  } catch (error) {
    // If docs path doesn't exist, return default
    return { summary: "project tasks planning", fileCount: 0 };
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
