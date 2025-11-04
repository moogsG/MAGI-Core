# @mcp/bench - Usage Guide

Performance benchmarking suite for MAGI-Core task operations.

## Quick Start

```bash
# 1. Seed benchmark data (10k tasks)
bun run seed

# 2. Run benchmarks
bun run bench

# 3. CI check (fails if thresholds exceeded)
bun run ci
```

## Commands

### `bun run seed`

Seeds the database with 10,000 diverse benchmark tasks with realistic distributions:

- **States**: 30% inbox, 50% open, 20% done
- **Priorities**: 20% high, 50% med, 30% low
- **Due dates**: 30% of tasks have due dates
- **Estimates**: 40% of tasks have time estimates

**Example output:**
```
🌱 Seeding 10000 benchmark tasks...
  Cleared existing benchmark data
  Inserted 2000/10000 tasks...
  Inserted 4000/10000 tasks...
  ...
✅ Seeded 10000 tasks in 337ms (29671 tasks/sec)

📊 Distribution:
  done   high 400
  done   low  632
  done   med  963
  inbox  high 594
  inbox  low  861
  inbox  med  1557
  open   high 990
  open   low  1513
  open   med  2490
```

### `bun run bench`

Runs comprehensive performance benchmarks on three key operations:

1. **task.list** - List tasks (200 samples)
2. **task.queryHybrid** - Hybrid FTS search (100 samples)
3. **task.plan_day** - Daily planning queries (100 samples)
4. **precision@10** - Search quality evaluation

**Metrics reported:**
- **p50**: Median latency (50th percentile)
- **p95**: 95th percentile latency
- **p99**: 99th percentile latency
- **mean**: Average latency
- **tokens/request**: Estimated tokens per request

**Example output:**
```
📈 Benchmark Results
════════════════════════════════════════════════════════════════════════════
Operation                Samples   p50       p95       p99       Mean      Tokens/Req
────────────────────────────────────────────────────────────────────────────
task.list                200       864μs     1.02ms    1.50ms    905μs     515
task.queryHybrid         100       363μs     716μs     1.19ms    396μs     226
task.plan_day            100       1.63ms    1.87ms    3.80ms    1.72ms    1242
════════════════════════════════════════════════════════════════════════════

⏱️  Total: 400 samples in 426.20ms
🎯 Precision: MAP@10 = 46.0% (5 queries)

✅ All performance thresholds passed!

💾 Results saved to benchmark-results.json
```

### `bun run ci`

Runs CI performance checks with threshold enforcement:

- **Threshold**: task.list p95 < 200ms
- **Exit code 0**: All checks passed
- **Exit code 1**: Performance threshold failure
- **Exit code 2**: Benchmark execution error

**Example output (passing):**
```
================================================================================
CI THRESHOLD CHECKS
================================================================================
✅ PASS task.list.p95: 1.08ms (threshold: 200ms)
================================================================================

✅ All CI checks passed!
```

**Example output (failing):**
```
================================================================================
CI THRESHOLD CHECKS
================================================================================
❌ FAIL task.list.p95: 215.32ms (threshold: 200ms)
================================================================================

❌ CI checks failed:
   - task.list.p95 = 215.32ms exceeds threshold of 200ms

💡 Tip: Run 'bun run bench' locally to investigate performance issues
```

## Benchmark Results

Results are saved to `benchmark-results.json` in the package directory:

```json
{
  "timestamp": "2024-11-04T19:44:32.366Z",
  "results": [
    {
      "operation": "task.list",
      "samples": 200,
      "p50": 0.864,
      "p95": 1.02,
      "p99": 1.50,
      "mean": 0.905,
      "tokensPerRequest": 515,
      "latencies": [...]
    },
    ...
  ],
  "summary": {
    "totalSamples": 400,
    "totalDuration": 426.20,
    "precision": {
      "map10": 0.46,
      "queries": 5
    }
  }
}
```

## Precision@10 Evaluation

The benchmark includes search quality evaluation using labeled queries:

- **5 labeled queries** covering common search patterns
- **MAP@10** (Mean Average Precision at 10) metric
- Queries test: authentication, rate limiting, memory leaks, database optimization, documentation

Higher MAP@10 scores indicate better search relevance (0.0 = worst, 1.0 = perfect).

## CI Integration

Add to your CI pipeline (GitHub Actions example):

```yaml
name: Performance Benchmarks

on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
        
      - name: Seed benchmark data
        run: cd packages/bench && bun run seed
        
      - name: Run performance checks
        run: cd packages/bench && bun run ci
```

## Configuration

### Adjusting Thresholds

Edit `src/ci-check.ts` to modify thresholds:

```typescript
const THRESHOLDS: ThresholdConfig[] = [
  {
    operation: "task.list",
    metric: "p95",
    threshold: 200,  // Change this value
    unit: "ms",
  },
  // Add more thresholds:
  // {
  //   operation: "task.queryHybrid",
  //   metric: "p95",
  //   threshold: 100,
  //   unit: "ms",
  // },
];
```

### Sample Counts

Edit `src/benchmark.ts` to adjust sample sizes:

```typescript
// More samples = more accurate but slower
const listResult = await runBenchmark(
  "task.list",
  () => listTaskHandles(db, 20),
  200  // Change sample count here
);
```

## Troubleshooting

### "No benchmark data found"

Run `bun run seed` before running benchmarks.

### Slow performance

- Check database indexes
- Verify WAL mode is enabled: `PRAGMA journal_mode = WAL`
- Review recent code changes
- Consider hardware limitations

### Variable results

- Warmup runs are performed automatically
- Results may vary based on system load
- Run multiple times for consistent measurements

## Token Estimation

Token counts are estimated using a simple heuristic (~4 characters per token). This provides rough guidance but is not exact tokenization. Actual token counts vary by model (GPT-4, Claude, etc.).
