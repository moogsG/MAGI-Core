import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type DB = Database;

export function openDB(dbPath = process.env.TASKS_DB_PATH || "tasks.db"): DB {
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  runMigrations(db);
  return db;
}

function runMigrations(db: DB) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, "migrations");
  
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  db.run("BEGIN");
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      db.run(sql);
    }
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}
