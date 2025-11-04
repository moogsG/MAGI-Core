import { runBenchmarkSuite } from "./benchmark.js";
import type { BenchmarkResult } from "./types.js";

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printResultTable(results: BenchmarkResult[]): void {
  console.log("\n📈 Benchmark Results");
  console.log("═".repeat(100));
  console.log(
    "Operation".padEnd(25) +
    "Samples".padEnd(10) +
    "p50".padEnd(12) +
    "p95".padEnd(12) +
    "p99".padEnd(12) +
    "Mean".padEnd(12) +
    "Tokens/Req".padEnd(12)
  );
  console.log("─".repeat(100));
  
  for (const result of results) {
    console.log(
      result.operation.padEnd(25) +
      result.samples.toString().padEnd(10) +
      formatDuration(result.p50).padEnd(12) +
      formatDuration(result.p95).padEnd(12) +
      formatDuration(result.p99).padEnd(12) +
      formatDuration(result.mean).padEnd(12) +
      (result.tokensPerRequest?.toString() || "N/A").padEnd(12)
    );
  }
  console.log("═".repeat(100));
}

function checkThresholds(results: BenchmarkResult[]): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  
  // Check: p95 for task.list must be < 200ms
  const listResult = results.find(r => r.operation === "task.list");
  if (listResult && listResult.p95 > 200) {
    failures.push(`task.list p95 (${listResult.p95.toFixed(2)}ms) exceeds threshold of 200ms`);
  }
  
  return {
    passed: failures.length === 0,
    failures,
  };
}

export async function main(): Promise<void> {
  try {
    const suite = await runBenchmarkSuite();
    
    printResultTable(suite.results);
    
    console.log(`\n⏱️  Total: ${suite.summary.totalSamples} samples in ${formatDuration(suite.summary.totalDuration)}`);
    
    if (suite.summary.precision) {
      console.log(`🎯 Precision: MAP@10 = ${(suite.summary.precision.map10 * 100).toFixed(1)}% (${suite.summary.precision.queries} queries)`);
    }
    
    const thresholdCheck = checkThresholds(suite.results);
    
    if (thresholdCheck.passed) {
      console.log("\n✅ All performance thresholds passed!");
    } else {
      console.log("\n❌ Performance threshold failures:");
      for (const failure of thresholdCheck.failures) {
        console.log(`   - ${failure}`);
      }
    }
    
    // Save results to file
    const resultsPath = "benchmark-results.json";
    await Bun.write(resultsPath, JSON.stringify(suite, null, 2));
    console.log(`\n💾 Results saved to ${resultsPath}`);
    
  } catch (error) {
    console.error("❌ Benchmark failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
