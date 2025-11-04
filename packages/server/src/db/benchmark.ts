import { openDB } from "./index.js";
import { listTaskHandles } from "../tasks/repo.js";

function percentile(arr: number[], p: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

async function benchmark() {
  console.log("⚡ Performance Benchmark\n");
  
  const dbPath = process.env.TASKS_DB_PATH || "tasks.db";
  console.log(`📁 Database: ${dbPath}`);
  
  const db = openDB(dbPath);
  
  // Check task count
  const count = db.prepare("SELECT COUNT(*) as count FROM tasks").get() as { count: number };
  console.log(`📊 Total tasks: ${count.count.toLocaleString()}\n`);
  
  if (count.count < 5000) {
    console.warn("⚠️  Warning: Less than 5000 tasks in database. Run 'bun run seed' first.\n");
  }
  
  // Warm up
  console.log("🔥 Warming up...");
  for (let i = 0; i < 10; i++) {
    listTaskHandles(db, { limit: 20 });
  }
  console.log("✅ Warm up complete\n");
  
  // Benchmark different query types
  const scenarios = [
    {
      name: "task.list (default, 20 items)",
      fn: () => listTaskHandles(db, { limit: 20 })
    },
    {
      name: "task.list (100 items)",
      fn: () => listTaskHandles(db, { limit: 100 })
    },
    {
      name: "task.list (filter by state=inbox)",
      fn: () => listTaskHandles(db, { limit: 20, state: ["inbox"] })
    },
    {
      name: "task.list (filter by priority=high)",
      fn: () => listTaskHandles(db, { limit: 20, priority: ["high"] })
    },
    {
      name: "task.list (filter by state+priority)",
      fn: () => listTaskHandles(db, { limit: 20, state: ["open"], priority: ["high", "med"] })
    },
    {
      name: "task.list (FTS search 'bug')",
      fn: () => listTaskHandles(db, { limit: 20, q: "bug" })
    },
    {
      name: "task.list (FTS search 'authentication')",
      fn: () => listTaskHandles(db, { limit: 20, q: "authentication" })
    }
  ];
  
  console.log("🏃 Running benchmarks (1000 iterations each)...\n");
  
  for (const scenario of scenarios) {
    const times: number[] = [];
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      scenario.fn();
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }
    
    const p50 = percentile(times, 50);
    const p95 = percentile(times, 95);
    const p99 = percentile(times, 99);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    const status = p95 < 200 ? "✅" : "❌";
    
    console.log(`${status} ${scenario.name}`);
    console.log(`   avg: ${avg.toFixed(2)}ms | p50: ${p50.toFixed(2)}ms | p95: ${p95.toFixed(2)}ms | p99: ${p99.toFixed(2)}ms`);
    console.log(`   min: ${min.toFixed(2)}ms | max: ${max.toFixed(2)}ms\n`);
  }
  
  db.close();
  
  console.log("✅ Benchmark complete!");
}

benchmark().catch(console.error);
