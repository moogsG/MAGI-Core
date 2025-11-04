import type { BenchmarkResult } from "./types.js";

export function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function calculateStats(latencies: number[]): Omit<BenchmarkResult, "operation" | "samples" | "latencies" | "tokensPerRequest"> {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  
  return {
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    mean: sum / sorted.length,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
  };
}

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  // This is a simplified heuristic; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

export function estimateTaskTokens(task: any): number {
  let total = 0;
  // Handle both full tasks and task handles
  if (task.title) total += estimateTokens(task.title);
  if (task.t) total += estimateTokens(task.t); // title in handle format
  if (task.body) total += estimateTokens(task.body);
  if (task.p) total += estimateTokens(task.p); // preview in handle format
  if (task.summary) total += estimateTokens(task.summary);
  return total;
}
