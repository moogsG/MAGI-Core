import { join } from "node:path";
import type { DuckDBViewOptions } from "./types.js";

/**
 * Create DuckDB views for analytical queries
 * Views: today, week, overdue
 */
export async function createDuckDBViews(options: DuckDBViewOptions): Promise<{ ok: boolean; views: string[] }> {
  const {
    parquetDir,
    viewNames = ["today", "week", "overdue"]
  } = options;

  const tasksParquet = join(parquetDir, "tasks_latest.parquet");
  const views: string[] = [];

  // SQL for creating views
  const viewSQL = `
    -- Today's tasks (created or due today)
    CREATE OR REPLACE VIEW today AS
    SELECT *
    FROM read_parquet('${tasksParquet}')
    WHERE DATE(created_ts) = CURRENT_DATE
       OR DATE(due_ts) = CURRENT_DATE;

    -- This week's tasks (created or due this week)
    CREATE OR REPLACE VIEW week AS
    SELECT *
    FROM read_parquet('${tasksParquet}')
    WHERE DATE(created_ts) >= DATE_TRUNC('week', CURRENT_DATE)
       OR (due_ts IS NOT NULL AND DATE(due_ts) >= DATE_TRUNC('week', CURRENT_DATE));

    -- Overdue tasks (due date in the past, not done)
    CREATE OR REPLACE VIEW overdue AS
    SELECT *
    FROM read_parquet('${tasksParquet}')
    WHERE due_ts IS NOT NULL
      AND DATE(due_ts) < CURRENT_DATE
      AND state != 'done'
    ORDER BY due_ts ASC;
  `;

  // Execute view creation using DuckDB CLI
  const duckdbCmd = `duckdb -c "${viewSQL.replace(/\n/g, " ")}"`;
  
  const proc = Bun.spawn(["sh", "-c", duckdbCmd], {
    stdout: "pipe",
    stderr: "pipe"
  });
  
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`DuckDB view creation failed: ${stderr}`);
  }

  views.push(...viewNames);
  console.log(`Created DuckDB views: ${views.join(", ")}`);

  return { ok: true, views };
}

/**
 * Query a DuckDB view
 */
export async function queryView(viewName: string, parquetDir: string, limit = 100): Promise<any[]> {
  const tasksParquet = join(parquetDir, "tasks_latest.parquet");
  
  let sql = "";
  switch (viewName) {
    case "today":
      sql = `
        SELECT * FROM read_parquet('${tasksParquet}')
        WHERE DATE(created_ts) = CURRENT_DATE
           OR DATE(due_ts) = CURRENT_DATE
        LIMIT ${limit};
      `;
      break;
    case "week":
      sql = `
        SELECT * FROM read_parquet('${tasksParquet}')
        WHERE DATE(created_ts) >= DATE_TRUNC('week', CURRENT_DATE)
           OR (due_ts IS NOT NULL AND DATE(due_ts) >= DATE_TRUNC('week', CURRENT_DATE))
        LIMIT ${limit};
      `;
      break;
    case "overdue":
      sql = `
        SELECT * FROM read_parquet('${tasksParquet}')
        WHERE due_ts IS NOT NULL
          AND DATE(due_ts) < CURRENT_DATE
          AND state != 'done'
        ORDER BY due_ts ASC
        LIMIT ${limit};
      `;
      break;
    default:
      throw new Error(`Unknown view: ${viewName}`);
  }

  // Execute query and return JSON
  const duckdbCmd = `duckdb -json -c "${sql.replace(/\n/g, " ")}"`;
  
  const proc = Bun.spawn(["sh", "-c", duckdbCmd], {
    stdout: "pipe",
    stderr: "pipe"
  });
  
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`DuckDB query failed: ${stderr}`);
  }

  const stdout = await new Response(proc.stdout).text();
  return JSON.parse(stdout || "[]");
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  const parquetDir = process.env.SNAPSHOT_DIR || "data/snapshots";
  
  console.log("Creating DuckDB views...");
  const result = await createDuckDBViews({ parquetDir });
  console.log(`Created views: ${result.views.join(", ")}`);
  
  // Test queries
  console.log("\nQuerying 'today' view:");
  const today = await queryView("today", parquetDir, 5);
  console.log(`  Found ${today.length} tasks`);
  
  console.log("\nQuerying 'overdue' view:");
  const overdue = await queryView("overdue", parquetDir, 5);
  console.log(`  Found ${overdue.length} tasks`);
}
