#!/usr/bin/env bun
/**
 * Migration script to add priority column to slack_messages table
 * 
 * This script finds all .db files in the project and adds the priority
 * column to any slack_messages tables that don't have it yet.
 * 
 * Usage: bun migrate-slack-priority.ts
 */

import { Database } from "bun:sqlite";
import { readdirSync, statSync } from "fs";
import { join } from "path";

function findDatabases(dir: string, databases: string[] = []): string[] {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          findDatabases(fullPath, databases);
        } else if (file.endsWith('.db')) {
          databases.push(fullPath);
        }
      } catch (e) {
        // Skip files we can't access
      }
    }
  } catch (e) {
    // Skip directories we can't access
  }
  return databases;
}

console.log("🔍 Searching for databases with slack_messages table...\n");

const databases = findDatabases('.');
let migratedCount = 0;
let alreadyMigratedCount = 0;
let skippedCount = 0;

for (const dbPath of databases) {
  try {
    const db = new Database(dbPath);
    
    // Check if slack_messages table exists
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='slack_messages'").all();
    
    if (tables.length === 0) {
      db.close();
      skippedCount++;
      continue;
    }
    
    console.log(`📁 ${dbPath}`);
    
    // Check if priority column exists
    const tableInfo = db.query("PRAGMA table_info(slack_messages)").all();
    const hasPriority = tableInfo.some((col: any) => col.name === "priority");
    
    if (!hasPriority) {
      console.log("  ⚙️  Adding priority column...");
      db.run("ALTER TABLE slack_messages ADD COLUMN priority INTEGER DEFAULT 0");
      console.log("  ✅ Added priority column");
      
      db.run("CREATE INDEX IF NOT EXISTS idx_slack_priority ON slack_messages (priority DESC, created_ts DESC)");
      console.log("  ✅ Created priority index");
      
      migratedCount++;
    } else {
      console.log("  ✅ Already has priority column");
      alreadyMigratedCount++;
    }
    
    db.close();
    console.log("");
  } catch (error: any) {
    console.error(`  ❌ Error with ${dbPath}:`, error.message);
  }
}

console.log("=" .repeat(60));
console.log("Migration Summary:");
console.log(`  Migrated: ${migratedCount}`);
console.log(`  Already migrated: ${alreadyMigratedCount}`);
console.log(`  Skipped (no slack_messages): ${skippedCount}`);
console.log("=" .repeat(60));

if (migratedCount > 0) {
  console.log("\n✅ Migration complete! Restart your server to use the new priority feature.");
} else if (alreadyMigratedCount > 0) {
  console.log("\n✅ All databases are already up to date!");
} else {
  console.log("\n⚠️  No slack_messages tables found. Run the server first to create tables.");
}
