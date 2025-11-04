/**
 * Test and benchmark hybrid search functionality
 */

import { openDB } from "./index.js";
import { seedHybridTestData } from "./seed-hybrid.js";
import { queryHybrid } from "../tasks/hybrid.js";

async function runBenchmark() {
  console.log("=== Hybrid Search Benchmark ===\n");

  // Setup database
  const dbPath = process.env.TASKS_DB_PATH || ":memory:";
  const db = openDB(dbPath);

  // Seed test data
  console.log("1. Seeding test data...");
  const seedCount = seedHybridTestData(db);
  console.log(`   ✓ Seeded ${seedCount} tasks\n`);

  // Test queries
  const testQueries = [
    "invoice mismatch",
    "billing discrepancy",
    "Azure charges",
    "reconciliation",
    "payment error"
  ];

  console.log("2. Running benchmark queries...\n");

  const results: Array<{ query: string; time: number; count: number }> = [];

  for (const query of testQueries) {
    const startTime = performance.now();
    const items = await queryHybrid(db, query, 10);
    const endTime = performance.now();
    const duration = endTime - startTime;

    results.push({
      query,
      time: duration,
      count: items.length
    });

    console.log(`   Query: "${query}"`);
    console.log(`   Time: ${duration.toFixed(2)}ms`);
    console.log(`   Results: ${items.length}`);
    
    if (items.length > 0) {
      console.log(`   Top result: ${items[0].t}`);
    }
    console.log();
  }

  // Summary statistics
  console.log("3. Benchmark Summary\n");
  
  const times = results.map(r => r.time);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);

  console.log(`   Average time: ${avgTime.toFixed(2)}ms`);
  console.log(`   Min time: ${minTime.toFixed(2)}ms`);
  console.log(`   Max time: ${maxTime.toFixed(2)}ms`);
  console.log(`   Target: ≤120ms`);
  
  const passed = maxTime <= 120;
  console.log(`   Status: ${passed ? "✓ PASSED" : "✗ FAILED"}`);

  // Detailed results for "invoice mismatch" query
  console.log("\n4. Detailed Results for 'invoice mismatch'\n");
  const detailedResults = await queryHybrid(db, "invoice mismatch", 10);
  
  detailedResults.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ${item.t}`);
    console.log(`      Preview: ${item.p.substring(0, 80)}...`);
    console.log(`      State: ${item.s}, Due: ${item.d || "none"}`);
    console.log();
  });

  // Cleanup
  if (dbPath === ":memory:") {
    db.close();
  }

  return passed;
}

// Run benchmark
if (import.meta.main) {
  const passed = await runBenchmark();
  process.exit(passed ? 0 : 1);
}
