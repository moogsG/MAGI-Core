import { runBenchmarkSuite } from "./benchmark.js";

/**
 * CI check script that fails if performance thresholds are not met
 * 
 * Thresholds:
 * - task.list p95 < 200ms
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Performance threshold failure
 * - 2: Benchmark execution error
 */

interface ThresholdConfig {
  operation: string;
  metric: "p50" | "p95" | "p99" | "mean";
  threshold: number;
  unit: string;
}

const THRESHOLDS: ThresholdConfig[] = [
  {
    operation: "task.list",
    metric: "p95",
    threshold: 200,
    unit: "ms",
  },
  // Add more thresholds as needed
  // {
  //   operation: "task.queryHybrid",
  //   metric: "p95",
  //   threshold: 100,
  //   unit: "ms",
  // },
];

async function main(): Promise<void> {
  console.log("🔍 Running CI performance checks...\n");
  
  try {
    const suite = await runBenchmarkSuite();
    
    console.log("\n" + "=".repeat(80));
    console.log("CI THRESHOLD CHECKS");
    console.log("=".repeat(80));
    
    let allPassed = true;
    const failures: string[] = [];
    
    for (const threshold of THRESHOLDS) {
      const result = suite.results.find(r => r.operation === threshold.operation);
      
      if (!result) {
        console.log(`⚠️  ${threshold.operation}: NOT FOUND`);
        allPassed = false;
        failures.push(`${threshold.operation} not found in results`);
        continue;
      }
      
      const value = result[threshold.metric];
      const passed = value <= threshold.threshold;
      const status = passed ? "✅ PASS" : "❌ FAIL";
      
      console.log(
        `${status} ${threshold.operation}.${threshold.metric}: ` +
        `${value.toFixed(2)}${threshold.unit} ` +
        `(threshold: ${threshold.threshold}${threshold.unit})`
      );
      
      if (!passed) {
        allPassed = false;
        failures.push(
          `${threshold.operation}.${threshold.metric} = ${value.toFixed(2)}${threshold.unit} ` +
          `exceeds threshold of ${threshold.threshold}${threshold.unit}`
        );
      }
    }
    
    console.log("=".repeat(80));
    
    if (allPassed) {
      console.log("\n✅ All CI checks passed!");
      process.exit(0);
    } else {
      console.log("\n❌ CI checks failed:");
      for (const failure of failures) {
        console.log(`   - ${failure}`);
      }
      console.log("\n💡 Tip: Run 'bun run bench' locally to investigate performance issues");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("\n❌ Benchmark execution failed:", error);
    process.exit(2);
  }
}

if (import.meta.main) {
  await main();
}
