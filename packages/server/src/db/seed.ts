import { randomUUID } from "crypto";
import { openDB } from "./index.js";
import type { DB } from "./index.js";

// Simple seeded random number generator for deterministic data
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
}

const rng = new SeededRandom(42);

// Sample data
const TASK_TITLES = [
  "Fix authentication bug in login flow",
  "Implement rate limiting for API endpoints",
  "Update documentation for new features",
  "Refactor database connection pooling",
  "Add unit tests for payment service",
  "Investigate memory leak in worker process",
  "Optimize SQL queries for dashboard",
  "Review pull request #",
  "Deploy hotfix to production",
  "Setup CI/CD pipeline for staging",
  "Migrate legacy code to TypeScript",
  "Design new user onboarding flow",
  "Fix broken links in documentation",
  "Implement feature flag system",
  "Upgrade dependencies to latest versions",
  "Add logging to error handlers",
  "Create API documentation with OpenAPI",
  "Fix race condition in cache invalidation",
  "Implement OAuth2 integration",
  "Add monitoring alerts for critical services",
  "Refactor component architecture",
  "Fix mobile responsive layout issues",
  "Implement dark mode theme",
  "Add accessibility improvements",
  "Optimize image loading performance",
  "Setup automated backup system",
  "Implement search functionality",
  "Add pagination to list views",
  "Fix timezone handling in date picker",
  "Implement email notification system",
  "Add export to CSV functionality",
  "Fix validation errors in form",
  "Implement file upload with progress",
  "Add real-time updates with WebSocket",
  "Fix memory usage in data processing",
  "Implement caching strategy",
  "Add error boundary components",
  "Fix CORS issues in API",
  "Implement request throttling",
  "Add health check endpoints",
  "Refactor authentication middleware",
  "Fix broken tests in CI pipeline",
  "Implement feature: user preferences",
  "Add analytics tracking events",
  "Fix security vulnerability in dependencies",
  "Implement data migration script",
  "Add integration tests for checkout flow",
  "Fix performance bottleneck in rendering",
  "Implement lazy loading for routes",
  "Add keyboard shortcuts for power users"
];

const TASK_BODIES = [
  "Need to investigate and fix the issue reported by users. This is blocking several workflows.",
  "Implementation should follow best practices and include proper error handling.",
  "Make sure to update all relevant sections and include code examples where appropriate.",
  "This will improve performance and reduce connection overhead significantly.",
  "Focus on edge cases and error scenarios to ensure robust coverage.",
  "Users are reporting intermittent crashes. Need to profile and identify the root cause.",
  "Current queries are taking too long. Consider adding indexes and optimizing joins.",
  "Code looks good overall but needs some minor adjustments before merging.",
  "Critical bug fix that needs to go out ASAP. Already tested in staging.",
  "Automate the deployment process to reduce manual errors and save time.",
  "Convert JavaScript files to TypeScript for better type safety and maintainability.",
  "Create a smooth onboarding experience for new users with guided tours.",
  "Several documentation links are returning 404 errors. Need to update or remove them.",
  "Allow enabling/disabling features without code deployments for better control.",
  "Security patches and bug fixes available. Review changelog before upgrading.",
  "Add structured logging to help with debugging production issues.",
  "Generate comprehensive API docs from code annotations using OpenAPI spec.",
  "Race condition occurs under high load. Need to implement proper locking mechanism.",
  "Add support for Google and GitHub OAuth providers with proper scope handling.",
  "Setup alerts for high error rates, slow response times, and service downtime.",
  "Current architecture is hard to maintain. Refactor into smaller, reusable components.",
  "Layout breaks on mobile devices. Test on various screen sizes and fix CSS.",
  "Implement dark mode with proper color contrast and user preference detection.",
  "Ensure the app is usable with keyboard navigation and screen readers.",
  "Images are loading slowly. Implement lazy loading and use modern formats like WebP.",
  "Automate daily backups with retention policy and test restore procedures.",
  "Add full-text search with filters and sorting options for better user experience.",
  "Large lists are slow to render. Implement pagination or virtual scrolling.",
  "Dates are showing in wrong timezone. Use proper timezone conversion throughout.",
  "Send email notifications for important events with customizable preferences.",
  "Allow users to export data in CSV format for external analysis and reporting.",
  "Form validation is not working correctly. Fix validation rules and error messages.",
  "Implement file upload with progress bar, drag-and-drop, and size validation.",
  "Add WebSocket support for real-time updates without polling the server.",
  "Memory usage grows over time. Investigate and fix memory leaks in data processing.",
  "Implement multi-layer caching strategy with proper invalidation logic.",
  "Add error boundaries to prevent entire app crashes from component errors.",
  "API requests are being blocked by CORS policy. Configure proper CORS headers.",
  "Implement rate limiting to prevent abuse and ensure fair usage of resources.",
  "Add health check endpoints for monitoring service status and dependencies.",
  "Refactor auth middleware to be more modular and easier to test.",
  "Several tests are failing in CI. Fix flaky tests and update assertions.",
  "Allow users to customize their preferences and save settings to profile.",
  "Track important user actions and events for analytics and product insights.",
  "Security scanner found vulnerabilities. Update affected packages immediately.",
  "Create migration script to transform old data format to new schema safely.",
  "Add end-to-end tests for the complete checkout flow including payment.",
  "Profiling shows performance bottleneck in render cycle. Optimize re-renders.",
  "Implement code splitting and lazy loading to reduce initial bundle size.",
  "Add keyboard shortcuts for common actions to improve power user productivity."
];

const SOURCES = ["local", "slack", "github", "linear", "email", "calendar"];
const STATES: Array<"inbox" | "open" | "done"> = ["inbox", "open", "done"];
const PRIORITIES: Array<"low" | "med" | "high"> = ["low", "med", "high"];
const LINK_KINDS: Array<"slack" | "mail" | "pr" | "doc"> = ["slack", "mail", "pr", "doc"];
const EVENT_KINDS: Array<"capture" | "update" | "complete" | "ingest"> = ["capture", "update", "complete", "ingest"];

function randomDate(daysBack: number): string {
  const now = Date.now();
  const offset = rng.int(0, daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - offset).toISOString();
}

function generateTask(_index: number): {
  id: string;
  title: string;
  body: string;
  state: "inbox" | "open" | "done";
  priority: "low" | "med" | "high";
  estimate_min: number | null;
  due_ts: string | null;
  source: string;
  summary: string | null;
  created_ts: string;
  updated_ts: string;
} {
  const id = `t_${randomUUID().slice(0, 8)}`;
  const title = rng.pick(TASK_TITLES) + (rng.bool(0.3) ? ` ${rng.int(100, 999)}` : "");
  const body = rng.pick(TASK_BODIES);
  const state = rng.pick(STATES) as "inbox" | "open" | "done";
  const priority = rng.pick(PRIORITIES) as "low" | "med" | "high";
  const estimate_min = rng.bool(0.6) ? rng.int(15, 480) : null;
  const created_ts = randomDate(90); // within last 90 days
  const updated_ts = rng.bool(0.4) ? randomDate(30) : created_ts;
  const due_ts = rng.bool(0.3) ? randomDate(-30) : null; // some future dates
  const source = rng.pick(SOURCES);
  const summary = rng.bool(0.4) ? body.slice(0, rng.int(50, 150)) : null;

  return {
    id,
    title,
    body,
    state,
    priority,
    estimate_min,
    due_ts,
    source,
    summary,
    created_ts,
    updated_ts
  };
}

function generateLink(taskId: string): {
  task_id: string;
  kind: "slack" | "mail" | "pr" | "doc";
  url: string;
} {
  const kind = rng.pick(LINK_KINDS) as "slack" | "mail" | "pr" | "doc";
  let url = "";
  
  switch (kind) {
    case "slack":
      url = `https://workspace.slack.com/archives/C${rng.int(1000000, 9999999)}/p${Date.now()}`;
      break;
    case "mail":
      url = `https://outlook.office.com/mail/id/${randomUUID()}`;
      break;
    case "pr":
      url = `https://github.com/org/repo/pull/${rng.int(1, 9999)}`;
      break;
    case "doc":
      url = `https://docs.google.com/document/d/${randomUUID().slice(0, 20)}`;
      break;
  }

  return { task_id: taskId, kind, url };
}

function generateEvent(taskId: string, taskCreatedTs: string): {
  task_id: string;
  kind: "capture" | "update" | "complete" | "ingest";
  at_ts: string;
  payload_json: string;
} {
  const kind = rng.pick(EVENT_KINDS) as "capture" | "update" | "complete" | "ingest";
  const baseTime = new Date(taskCreatedTs).getTime();
  const offset = rng.int(0, 7 * 24 * 60 * 60 * 1000); // within 7 days after creation
  const at_ts = new Date(baseTime + offset).toISOString();
  
  const payload = {
    kind,
    user: `user_${rng.int(1, 50)}`,
    details: `Event ${kind} triggered`,
    metadata: { source: rng.pick(SOURCES) }
  };

  return {
    task_id: taskId,
    kind,
    at_ts,
    payload_json: JSON.stringify(payload)
  };
}

function seedTasks(db: DB, count: number) {
  console.log(`🌱 Seeding ${count} tasks...`);
  
  const insertTask = db.prepare(`
    INSERT INTO tasks(id, title, body, state, priority, estimate_min, due_ts, source, summary, created_ts, updated_ts)
    VALUES (@id, @title, @body, @state, @priority, @estimate_min, @due_ts, @source, @summary, @created_ts, @updated_ts)
  `);

  const insertLink = db.prepare(`
    INSERT INTO links(task_id, kind, url)
    VALUES (@task_id, @kind, @url)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events(task_id, kind, at_ts, payload_json)
    VALUES (@task_id, @kind, @at_ts, @payload_json)
  `);

  const start = Date.now();
  
  db.exec("BEGIN");
  try {
    for (let i = 0; i < count; i++) {
      const task = generateTask(i);
      insertTask.run(task);

      // Add links for ~30% of tasks
      if (rng.bool(0.3)) {
        const numLinks = rng.int(1, 3);
        for (let j = 0; j < numLinks; j++) {
          const link = generateLink(task.id);
          insertLink.run(link);
        }
      }

      // Add events for ~40% of tasks
      if (rng.bool(0.4)) {
        const numEvents = rng.int(1, 4);
        for (let j = 0; j < numEvents; j++) {
          const event = generateEvent(task.id, task.created_ts);
          insertEvent.run(event);
        }
      }

      if ((i + 1) % 1000 === 0) {
        console.log(`  ✓ Inserted ${i + 1} tasks...`);
      }
    }
    db.exec("COMMIT");
    
    const elapsed = Date.now() - start;
    console.log(`✅ Seeded ${count} tasks in ${elapsed}ms (${(elapsed / count).toFixed(2)}ms per task)`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedSlackMessages(db: DB, count: number) {
  console.log(`🌱 Seeding ${count} Slack messages...`);
  
  const insert = db.prepare(`
    INSERT INTO slack_messages(id, channel_id, ts, user, text, thread_ts, edited_at, deleted, permalink, created_ts)
    VALUES (@id, @channel_id, @ts, @user, @text, @thread_ts, @edited_at, @deleted, @permalink, @created_ts)
  `);

  const channels = ["C01234567", "C01234568", "C01234569", "C01234570"];
  const users = Array.from({ length: 20 }, (_, i) => `U${String(i + 1).padStart(9, "0")}`);

  db.exec("BEGIN");
  try {
    for (let i = 0; i < count; i++) {
      const channelId = rng.pick(channels);
      const ts = (Date.now() / 1000 - rng.int(0, 90 * 24 * 60 * 60)).toFixed(6);
      const id = `${channelId}_${ts}`;
      const user = rng.pick(users);
      const text = rng.pick(TASK_BODIES).slice(0, rng.int(50, 200));
      const threadTs = rng.bool(0.3) ? (parseFloat(ts) - rng.int(60, 3600)).toFixed(6) : null;
      const editedAt = rng.bool(0.1) ? randomDate(30) : null;
      const deleted = rng.bool(0.05) ? 1 : 0;
      const permalink = `https://workspace.slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
      const createdTs = new Date(parseFloat(ts) * 1000).toISOString();

      insert.run({
        id,
        channel_id: channelId,
        ts,
        user,
        text,
        thread_ts: threadTs,
        edited_at: editedAt,
        deleted,
        permalink,
        created_ts: createdTs
      });
    }
    db.exec("COMMIT");
    console.log(`✅ Seeded ${count} Slack messages`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedOutlookMessages(db: DB, count: number) {
  console.log(`🌱 Seeding ${count} Outlook messages...`);
  
  const insert = db.prepare(`
    INSERT INTO outlook_messages(id, received_at, sender, subject, preview, web_link, folder, created_ts)
    VALUES (@id, @received_at, @sender, @subject, @preview, @web_link, @folder, @created_ts)
  `);

  const folders = ["Inbox", "Sent", "Archive", "Important"];
  const senders = Array.from({ length: 30 }, (_, i) => `user${i + 1}@example.com`);

  db.exec("BEGIN");
  try {
    for (let i = 0; i < count; i++) {
      const id = randomUUID();
      const receivedAt = randomDate(60);
      const sender = rng.pick(senders);
      const subject = rng.pick(TASK_TITLES);
      const preview = rng.pick(TASK_BODIES).slice(0, rng.int(100, 200));
      const webLink = `https://outlook.office.com/mail/id/${id}`;
      const folder = rng.pick(folders);
      const createdTs = receivedAt;

      insert.run({
        id,
        received_at: receivedAt,
        sender,
        subject,
        preview,
        web_link: webLink,
        folder,
        created_ts: createdTs
      });
    }
    db.exec("COMMIT");
    console.log(`✅ Seeded ${count} Outlook messages`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedCalendarEvents(db: DB, count: number) {
  console.log(`🌱 Seeding ${count} calendar events...`);
  
  const insert = db.prepare(`
    INSERT INTO calendars(id, start, end, subject, location, web_link, created_ts)
    VALUES (@id, @start, @end, @subject, @location, @web_link, @created_ts)
  `);

  const subjects = [
    "Team standup",
    "Sprint planning",
    "Code review session",
    "1:1 with manager",
    "All hands meeting",
    "Design review",
    "Architecture discussion",
    "Customer demo",
    "Training session",
    "Retrospective"
  ];

  const locations = ["Conference Room A", "Zoom", "Google Meet", "Office", "Remote", null];

  db.exec("BEGIN");
  try {
    for (let i = 0; i < count; i++) {
      const id = randomUUID();
      const start = randomDate(-30); // future events
      const startTime = new Date(start).getTime();
      const duration = rng.int(30, 120) * 60 * 1000; // 30-120 minutes
      const end = new Date(startTime + duration).toISOString();
      const subject = rng.pick(subjects);
      const location = rng.pick(locations);
      const webLink = `https://outlook.office.com/calendar/item/${id}`;
      const createdTs = randomDate(90);

      insert.run({
        id,
        start,
        end,
        subject,
        location,
        web_link: webLink,
        created_ts: createdTs
      });
    }
    db.exec("COMMIT");
    console.log(`✅ Seeded ${count} calendar events`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function printStats(db: DB) {
  console.log("\n📊 Database Statistics:");
  
  const tables = ["tasks", "links", "events", "slack_messages", "outlook_messages", "calendars"];
  
  for (const table of tables) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    console.log(`  ${table.padEnd(20)} ${count.count.toLocaleString()}`);
  }

  // FTS stats
  const ftsCount = db.prepare(`SELECT COUNT(*) as count FROM tasks_fts`).get() as { count: number };
  console.log(`  ${"tasks_fts".padEnd(20)} ${ftsCount.count.toLocaleString()}`);
}

// Main execution
async function main() {
  console.log("🚀 Starting database seeding...\n");
  
  const dbPath = process.env.TASKS_DB_PATH || "tasks.db";
  console.log(`📁 Database: ${dbPath}\n`);
  
  const db = openDB(dbPath);
  
  // Clear existing data
  console.log("🧹 Clearing existing data...");
  db.exec("DELETE FROM events");
  db.exec("DELETE FROM links");
  db.exec("DELETE FROM tasks");
  db.exec("DELETE FROM slack_messages");
  db.exec("DELETE FROM outlook_messages");
  db.exec("DELETE FROM calendars");
  console.log("✅ Cleared existing data\n");
  
  // Seed data
  seedTasks(db, 5000);
  seedSlackMessages(db, 500);
  seedOutlookMessages(db, 300);
  seedCalendarEvents(db, 200);
  
  // Print stats
  printStats(db);
  
  // Performance test
  console.log("\n⚡ Performance Test:");
  const start = Date.now();
  const results = db.prepare(`
    SELECT id, title AS t, substr(coalesce(summary, body, ''), 1, 300) AS p,
           state AS s, due_ts AS d
    FROM tasks
    ORDER BY created_ts DESC
    LIMIT 20
  `).all();
  const elapsed = Date.now() - start;
  console.log(`  task.list (20 items): ${elapsed}ms`);
  console.log(`  Result count: ${results.length}`);
  
  db.close();
  console.log("\n✅ Seeding complete!");
}

main().catch(console.error);
