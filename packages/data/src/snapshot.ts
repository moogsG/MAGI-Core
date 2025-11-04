import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SnapshotOptions, SnapshotResult } from "./types.js";

/**
 * Snapshot SQLite tables to Parquet format using DuckDB CLI
 * Note: Requires DuckDB CLI to be installed
 */
export async function snapshotToParquet(options: SnapshotOptions = {}): Promise<SnapshotResult> {
  const {
    dbPath = process.env.TASKS_DB_PATH || "tasks.db",
    outputDir = process.env.SNAPSHOT_DIR || "data/snapshots",
    tables = ["tasks", "links", "events", "slack_messages", "outlook_messages", "calendars"]
  } = options;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const files: string[] = [];
  const rowCounts: Record<string, number> = {};

  // Open SQLite database to get row counts
  const sqlite = new Database(dbPath, { readonly: true });

  try {
    // Export each table to Parquet using DuckDB CLI
    for (const table of tables) {
      // Check if table exists
      const tableExists = sqlite.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);

      if (!tableExists) {
        console.warn(`Table ${table} not found, skipping`);
        continue;
      }

      // Get row count
      const countResult = sqlite.query(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      rowCounts[table] = countResult.count;

      if (countResult.count === 0) {
        console.warn(`Table ${table} is empty, skipping`);
        continue;
      }

      // Export to Parquet using DuckDB CLI
      const outputFile = join(outputDir, `${table}_${timestamp}.parquet`);
      const latestFile = join(outputDir, `${table}_latest.parquet`);
      
      const duckdbCmd = `duckdb -c "INSTALL sqlite; LOAD sqlite; ATTACH '${dbPath}' AS sqlite_db (TYPE SQLITE, READ_ONLY); COPY (SELECT * FROM sqlite_db.${table}) TO '${outputFile}' (FORMAT PARQUET, COMPRESSION ZSTD);"`;
      
      const proc = Bun.spawn(["sh", "-c", duckdbCmd], {
        stdout: "pipe",
        stderr: "pipe"
      });
      
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`DuckDB export failed for ${table}: ${stderr}`);
      }

      files.push(outputFile);
      
      // Create latest copy
      const copyCmd = `duckdb -c "COPY (SELECT * FROM read_parquet('${outputFile}')) TO '${latestFile}' (FORMAT PARQUET, COMPRESSION ZSTD);"`;
      const copyProc = Bun.spawn(["sh", "-c", copyCmd], {
        stdout: "pipe",
        stderr: "pipe"
      });
      await copyProc.exited;

      console.log(`Exported ${table}: ${countResult.count} rows → ${outputFile}`);
    }

    return {
      ok: true,
      files,
      timestamp,
      rowCounts
    };
  } finally {
    sqlite.close();
  }
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  console.log("Starting snapshot...");
  const result = await snapshotToParquet();
  console.log("\nSnapshot complete:");
  console.log(`  Files: ${result.files.length}`);
  console.log(`  Timestamp: ${result.timestamp}`);
  console.log(`  Row counts:`, result.rowCounts);
}
