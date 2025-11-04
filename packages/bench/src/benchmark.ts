import { Database } from "bun:sqlite";
import type { BenchmarkResult, BenchmarkSuite } from "./types.js";
import { calculateStats, estimateTaskTokens } from "./metrics.js";
import { buildLabeledDataset, calculateMAP } from "./labeled-queries.js";

type DB = Database;

// Inline simplified versions of repo functions to avoid import issues
function listTaskHandles(db: DB, limit = 20) {
  const sql = `
    SELECT id, title AS t, substr(coalesce(summary, body, ''), 1, 300) AS p,
           state AS s, due_ts AS d
    FROM tasks 
    WHERE source = 'benchmark'
    ORDER BY created_ts DESC 
    LIMIT ?
  `;
  return db.query(sql).all(limit);
}

async function queryHybrid(db: DB, query: string, k = 10) {
  // Use FTS5 keyword search (hybrid search fallback)
  const sql = `
    SELECT t.id, t.title AS t,
           substr(coalesce(t.summary, t.body, ''), 1, 300) AS p,
           t.state AS s, t.due_ts AS d
    FROM tasks t
    JOIN tasks_fts f ON f.rowid = t.rowid
    WHERE tasks_fts MATCH ? AND t.source = 'benchmark'
    ORDER BY rank 
    LIMIT ?
  `;
  return db.query(sql).all(query, k);
}

function planDay(db: DB) {
  // Simulate a "plan day" operation: get high priority open tasks due soon
  const sql = `
    SELECT id, title, body, state, priority, estimate_min, due_ts, created_ts
    FROM tasks
    WHERE source = 'benchmark'
      AND state IN ('inbox', 'open')
      AND priority IN ('high', 'med')
      AND (due_ts IS NULL OR due_ts <= date('now', '+7 days'))
    ORDER BY 
      CASE priority WHEN 'high' THEN 1 WHEN 'med' THEN 2 ELSE 3 END,
      due_ts ASC NULLS LAST,
      created_ts ASC
    LIMIT 50
  `;
  return db.query(sql).all();
}

export async function runBenchmark(
  operation: string,
  fn: () => any,
  samples = 100
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let totalTokens = 0;
  
  console.log(`  Running ${operation} (${samples} samples)...`);
  
  // Warmup
  for (let i = 0; i < 5; i++) {
    fn();
  }
  
  // Actual benchmark
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    latencies.push(end - start);
    
    // Estimate tokens for the result
    if (Array.isArray(result)) {
      for (const item of result) {
        totalTokens += estimateTaskTokens(item);
      }
    }
  }
  
  const stats = calculateStats(latencies);
  const avgTokensPerRequest = totalTokens / samples;
  
  return {
    operation,
    samples,
    latencies,
    ...stats,
    tokensPerRequest: Math.round(avgTokensPerRequest),
  };
}

export async function runBenchmarkSuite(): Promise<BenchmarkSuite> {
  console.log("🚀 Starting benchmark suite...\n");
  const suiteStart = performance.now();
  
  const dbPath = process.env.TASKS_DB_PATH || "tasks.db";
  const db = new Database(dbPath);
  
  // Verify we have benchmark data
  const count = db.query("SELECT COUNT(*) as count FROM tasks WHERE source = 'benchmark'").get() as { count: number };
  if (count.count === 0) {
    throw new Error("No benchmark data found. Run 'bun run seed' first.");
  }
  console.log(`📊 Found ${count.count} benchmark tasks\n`);
  
  const results: BenchmarkResult[] = [];
  
  // Benchmark 1: task.list
  console.log("1️⃣  Benchmarking task.list");
  const listResult = await runBenchmark(
    "task.list",
    () => listTaskHandles(db, 20),
    200 // More samples for fast operations
  );
  results.push(listResult);
  console.log(`   ✓ p50: ${listResult.p50.toFixed(2)}ms, p95: ${listResult.p95.toFixed(2)}ms\n`);
  
  // Benchmark 2: task.queryHybrid
  console.log("2️⃣  Benchmarking task.queryHybrid");
  const queries = [
    "authentication bug",
    "rate limiting API",
    "memory leak",
    "database optimization",
    "documentation update"
  ];
  const hybridLatencies: number[] = [];
  let hybridTokens = 0;
  
  for (let i = 0; i < 100; i++) {
    const query = queries[i % queries.length];
    const start = performance.now();
    const result = await queryHybrid(db, query, 10);
    const end = performance.now();
    
    hybridLatencies.push(end - start);
    for (const item of result as any[]) {
      hybridTokens += estimateTaskTokens(item);
    }
  }
  
  const hybridStats = calculateStats(hybridLatencies);
  const hybridResult: BenchmarkResult = {
    operation: "task.queryHybrid",
    samples: 100,
    latencies: hybridLatencies,
    ...hybridStats,
    tokensPerRequest: Math.round(hybridTokens / 100),
  };
  results.push(hybridResult);
  console.log(`   ✓ p50: ${hybridResult.p50.toFixed(2)}ms, p95: ${hybridResult.p95.toFixed(2)}ms\n`);
  
  // Benchmark 3: task.plan_day
  console.log("3️⃣  Benchmarking task.plan_day");
  const planResult = await runBenchmark(
    "task.plan_day",
    () => planDay(db),
    100
  );
  results.push(planResult);
  console.log(`   ✓ p50: ${planResult.p50.toFixed(2)}ms, p95: ${planResult.p95.toFixed(2)}ms\n`);
  
  // Benchmark 4: Precision@10 evaluation
  console.log("4️⃣  Evaluating precision@10");
  const labeledQueries = buildLabeledDataset(db);
  console.log(`   Found ${labeledQueries.length} labeled queries`);
  
  const precisionResults = [];
  for (const lq of labeledQueries) {
    const searchResults = await queryHybrid(db, lq.query, 10);
    const retrievedIds = (searchResults as any[]).map(r => r.id);
    precisionResults.push({
      retrievedIds,
      relevantIds: lq.relevantIds,
    });
  }
  
  const map10 = calculateMAP(precisionResults, 10);
  console.log(`   ✓ MAP@10: ${(map10 * 100).toFixed(1)}%\n`);
  
  db.close();
  
  const suiteEnd = performance.now();
  const totalDuration = suiteEnd - suiteStart;
  const totalSamples = results.reduce((sum, r) => sum + r.samples, 0);
  
  return {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalSamples,
      totalDuration,
      precision: {
        map10,
        queries: labeledQueries.length,
      },
    },
  };
}
