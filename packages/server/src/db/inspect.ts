import { openDB } from "./index.js";

const db = openDB(process.env.TASKS_DB_PATH || "tasks.db");

console.log("📋 Tables:");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
tables.forEach(t => console.log("  -", t.name));

console.log("\n📇 Indexes:");
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name").all() as Array<{ name: string; tbl_name: string }>;
indexes.forEach(i => console.log("  -", i.name, "(on", i.tbl_name + ")"));

console.log("\n📊 Row Counts:");
for (const table of tables) {
  if (table.name.includes("_fts")) continue; // Skip FTS tables
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
  console.log("  -", table.name.padEnd(20), count.count.toLocaleString());
}

console.log("\n🔍 Sample Data:");

console.log("\n  Tasks (first 3):");
const sampleTasks = db.prepare("SELECT id, title, state, priority FROM tasks LIMIT 3").all();
sampleTasks.forEach((t: any) => console.log(`    ${t.id}: ${t.title} [${t.state}/${t.priority}]`));

console.log("\n  Links (first 3):");
const sampleLinks = db.prepare("SELECT task_id, kind, url FROM links LIMIT 3").all();
sampleLinks.forEach((l: any) => console.log(`    ${l.task_id} -> ${l.kind}: ${l.url.slice(0, 50)}...`));

console.log("\n  Events (first 3):");
const sampleEvents = db.prepare("SELECT task_id, kind, at_ts FROM events LIMIT 3").all();
sampleEvents.forEach((e: any) => console.log(`    ${e.task_id} [${e.kind}] at ${e.at_ts}`));

console.log("\n  Slack Messages (first 3):");
const sampleSlack = db.prepare("SELECT id, channel_id, user, text FROM slack_messages LIMIT 3").all();
sampleSlack.forEach((s: any) => console.log(`    ${s.id} from ${s.user}: ${s.text?.slice(0, 40)}...`));

console.log("\n  Outlook Messages (first 3):");
const sampleOutlook = db.prepare("SELECT id, sender, subject FROM outlook_messages LIMIT 3").all();
sampleOutlook.forEach((o: any) => console.log(`    ${o.id.slice(0, 8)}... from ${o.sender}: ${o.subject}`));

console.log("\n  Calendar Events (first 3):");
const sampleCalendar = db.prepare("SELECT id, subject, start FROM calendars LIMIT 3").all();
sampleCalendar.forEach((c: any) => console.log(`    ${c.id.slice(0, 8)}... ${c.subject} at ${c.start}`));

db.close();
