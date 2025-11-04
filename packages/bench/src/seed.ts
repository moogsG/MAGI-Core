import { Database } from "bun:sqlite";

type DB = Database;

// Seeded random for deterministic benchmarks
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

const rng = new SeededRandom(12345);

// Diverse task templates for realistic distribution
const TASK_TEMPLATES = [
  { title: "Fix authentication bug in login flow", body: "Users reporting intermittent login failures. Need to investigate session handling.", priority: "high" },
  { title: "Implement rate limiting for API", body: "Add rate limiting middleware to prevent abuse. Target: 100 req/min per user.", priority: "med" },
  { title: "Update documentation for new features", body: "Document the new search API and hybrid query capabilities.", priority: "low" },
  { title: "Refactor database connection pooling", body: "Current implementation has connection leaks under high load.", priority: "high" },
  { title: "Add unit tests for payment service", body: "Coverage is currently at 45%. Need to reach 80% minimum.", priority: "med" },
  { title: "Investigate memory leak in worker", body: "Memory usage grows unbounded after 24h runtime. Profile and fix.", priority: "high" },
  { title: "Optimize SQL queries for dashboard", body: "Dashboard loads taking 3-5s. Need to add indexes and optimize joins.", priority: "med" },
  { title: "Review pull request #", body: "Code review needed for the new feature branch. Check for security issues.", priority: "med" },
  { title: "Deploy hotfix to production", body: "Critical bug fix ready. Tested in staging, needs prod deployment.", priority: "high" },
  { title: "Setup CI/CD pipeline for staging", body: "Automate deployments to staging environment using GitHub Actions.", priority: "low" },
  { title: "Migrate legacy code to TypeScript", body: "Convert remaining JavaScript modules to TypeScript for type safety.", priority: "low" },
  { title: "Design new user onboarding flow", body: "Create wireframes and user flow for improved first-time experience.", priority: "med" },
  { title: "Fix broken links in documentation", body: "Several docs links returning 404. Audit and update all references.", priority: "low" },
  { title: "Implement feature flag system", body: "Need ability to toggle features without deployments. Use LaunchDarkly or similar.", priority: "med" },
  { title: "Upgrade dependencies to latest", body: "Security patches available. Review changelog and upgrade safely.", priority: "med" },
  { title: "Add logging to error handlers", body: "Improve observability by adding structured logging to all error paths.", priority: "low" },
  { title: "Create API docs with OpenAPI", body: "Generate comprehensive API documentation from code annotations.", priority: "low" },
  { title: "Fix race condition in cache", body: "Cache invalidation has race condition under concurrent writes.", priority: "high" },
  { title: "Implement OAuth2 integration", body: "Add OAuth2 support for Google and GitHub authentication.", priority: "med" },
  { title: "Add monitoring alerts", body: "Setup alerts for critical metrics: error rate, latency, memory usage.", priority: "high" },
  { title: "Refactor component architecture", body: "Current component structure is hard to maintain. Propose new architecture.", priority: "low" },
  { title: "Fix mobile responsive layout", body: "Layout breaks on mobile devices < 375px width. Fix CSS media queries.", priority: "med" },
  { title: "Implement dark mode theme", body: "Add dark mode support with user preference persistence.", priority: "low" },
  { title: "Add accessibility improvements", body: "Audit for WCAG 2.1 AA compliance. Fix keyboard navigation issues.", priority: "med" },
  { title: "Optimize image loading", body: "Implement lazy loading and WebP format for faster page loads.", priority: "low" },
  { title: "Setup automated backup system", body: "Configure daily backups with 30-day retention policy.", priority: "high" },
  { title: "Implement search functionality", body: "Add full-text search with filters and faceted navigation.", priority: "med" },
  { title: "Add pagination to list views", body: "Large lists causing performance issues. Implement cursor-based pagination.", priority: "med" },
  { title: "Fix timezone handling", body: "Date picker not respecting user timezone. Use proper UTC conversion.", priority: "med" },
  { title: "Implement email notifications", body: "Send email alerts for important events using SendGrid API.", priority: "low" },
  { title: "Add export to CSV", body: "Users requesting ability to export data to CSV format.", priority: "low" },
  { title: "Fix validation errors in form", body: "Form validation not catching edge cases. Improve error messages.", priority: "med" },
  { title: "Implement file upload with progress", body: "Add file upload with progress bar and drag-drop support.", priority: "low" },
  { title: "Add real-time updates", body: "Implement WebSocket connection for live data updates.", priority: "med" },
  { title: "Fix memory usage in processing", body: "Data processing job consuming excessive memory. Optimize algorithms.", priority: "high" },
  { title: "Implement caching strategy", body: "Add Redis caching layer for frequently accessed data.", priority: "med" },
  { title: "Add error boundary components", body: "Prevent entire app crashes by adding React error boundaries.", priority: "med" },
  { title: "Fix CORS issues in API", body: "CORS configuration blocking legitimate requests. Update whitelist.", priority: "high" },
  { title: "Implement request throttling", body: "Add request throttling to prevent API abuse and DDoS.", priority: "high" },
  { title: "Add health check endpoints", body: "Implement /health and /ready endpoints for load balancer.", priority: "med" },
  { title: "Refactor auth middleware", body: "Authentication middleware is complex and hard to test. Simplify.", priority: "low" },
  { title: "Fix broken tests in CI", body: "Several tests failing intermittently in CI. Make tests deterministic.", priority: "med" },
  { title: "Implement user preferences", body: "Allow users to customize UI settings and save preferences.", priority: "low" },
  { title: "Add analytics tracking", body: "Integrate analytics to track user behavior and feature usage.", priority: "low" },
  { title: "Fix security vulnerability", body: "Dependabot alert for critical security issue. Upgrade immediately.", priority: "high" },
  { title: "Implement data migration", body: "Write migration script for new database schema changes.", priority: "med" },
  { title: "Add integration tests", body: "Add end-to-end tests for critical user flows.", priority: "med" },
  { title: "Fix performance bottleneck", body: "Rendering performance degraded. Profile and optimize render cycle.", priority: "high" },
  { title: "Implement lazy loading", body: "Code-split routes and lazy load components for faster initial load.", priority: "low" },
  { title: "Add keyboard shortcuts", body: "Implement keyboard shortcuts for power users (Cmd+K, etc).", priority: "low" },
];



function generateTask(index: number) {
  const template = rng.pick(TASK_TEMPLATES);
  const id = `t_bench_${index.toString().padStart(5, "0")}`;
  const now = new Date();
  const daysAgo = rng.int(0, 90);
  const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  
  // Realistic state distribution: 30% inbox, 50% open, 20% done
  const stateRoll = rng.next();
  const state = stateRoll < 0.3 ? "inbox" : stateRoll < 0.8 ? "open" : "done";
  
  // Priority distribution: 20% high, 50% med, 30% low
  const priorityRoll = rng.next();
  const priority = priorityRoll < 0.2 ? "high" : priorityRoll < 0.7 ? "med" : "low";
  
  // 30% of tasks have due dates
  const dueTs = rng.bool(0.3) 
    ? new Date(now.getTime() + rng.int(-7, 30) * 24 * 60 * 60 * 1000).toISOString()
    : null;
  
  // 40% of tasks have estimates
  const estimateMin = rng.bool(0.4) ? rng.int(15, 480) : null;
  
  // Add variation to titles and bodies
  const titleVariation = rng.int(1, 999);
  const title = template.title.includes("#") 
    ? template.title + titleVariation 
    : `${template.title} (${titleVariation})`;
  
  return {
    id,
    title,
    body: template.body,
    state,
    priority,
    estimate_min: estimateMin,
    due_ts: dueTs,
    source: "benchmark",
    summary: null,
    created_ts: createdDate.toISOString(),
    updated_ts: createdDate.toISOString(),
  };
}

function ensureDatabase(db: DB): void {
  // Check if tasks table exists
  const tableExists = db.query(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'
  `).get();
  
  if (!tableExists) {
    console.log("  Creating tasks table...");
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT,
        state TEXT NOT NULL CHECK(state IN ('inbox', 'open', 'done')),
        priority TEXT NOT NULL CHECK(priority IN ('low', 'med', 'high')),
        estimate_min INTEGER,
        due_ts TEXT,
        source TEXT,
        summary TEXT,
        created_ts TEXT NOT NULL,
        updated_ts TEXT NOT NULL
      )
    `);
    
    // Create FTS5 table for full-text search
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        title, body, summary,
        content='tasks',
        content_rowid='rowid'
      )
    `);
    
    // Create triggers to keep FTS in sync
    db.run(`
      CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
        INSERT INTO tasks_fts(rowid, title, body, summary)
        VALUES (new.rowid, new.title, new.body, new.summary);
      END
    `);
    
    db.run(`
      CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
        DELETE FROM tasks_fts WHERE rowid = old.rowid;
      END
    `);
    
    db.run(`
      CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
        UPDATE tasks_fts SET title=new.title, body=new.body, summary=new.summary
        WHERE rowid = new.rowid;
      END
    `);
    
    console.log("  ✅ Database schema created");
  }
}

export async function seedBenchmarkData(count = 10000): Promise<void> {
  console.log(`🌱 Seeding ${count} benchmark tasks...`);
  const startTime = performance.now();
  
  const dbPath = process.env.TASKS_DB_PATH || "tasks.db";
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  
  // Ensure database schema exists
  ensureDatabase(db);
  
  // Clear existing benchmark data
  db.query("DELETE FROM tasks WHERE source = 'benchmark'").run();
  console.log("  Cleared existing benchmark data");
  
  // Insert in batches for better performance
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    const end = Math.min(i + batchSize, count);
    
    for (let j = i; j < end; j++) {
      batch.push(generateTask(j));
    }
    
    // Use transaction for batch insert
    const insertStmt = db.query(`
      INSERT INTO tasks(id, title, body, state, priority, estimate_min, due_ts, source, summary, created_ts, updated_ts)
      VALUES ($id, $title, $body, $state, $priority, $estimate_min, $due_ts, $source, $summary, $created_ts, $updated_ts)
    `);
    
    const transaction = db.transaction((tasks: any[]) => {
      for (const task of tasks) {
        insertStmt.run({
          $id: task.id,
          $title: task.title,
          $body: task.body,
          $state: task.state,
          $priority: task.priority,
          $estimate_min: task.estimate_min,
          $due_ts: task.due_ts,
          $source: task.source,
          $summary: task.summary,
          $created_ts: task.created_ts,
          $updated_ts: task.updated_ts,
        });
      }
    });
    
    transaction(batch);
    inserted += batch.length;
    
    if (inserted % 2000 === 0) {
      console.log(`  Inserted ${inserted}/${count} tasks...`);
    }
  }
  
  const elapsed = performance.now() - startTime;
  console.log(`✅ Seeded ${inserted} tasks in ${elapsed.toFixed(0)}ms (${(inserted / (elapsed / 1000)).toFixed(0)} tasks/sec)`);
  
  // Verify counts
  const counts = db.query(`
    SELECT state, priority, COUNT(*) as count 
    FROM tasks 
    WHERE source = 'benchmark' 
    GROUP BY state, priority 
    ORDER BY state, priority
  `).all();
  
  console.log("\n📊 Distribution:");
  for (const row of counts as any[]) {
    console.log(`  ${row.state.padEnd(6)} ${row.priority.padEnd(4)} ${row.count}`);
  }
  
  db.close();
}

// Run if called directly
if (import.meta.main) {
  await seedBenchmarkData(10000);
}
