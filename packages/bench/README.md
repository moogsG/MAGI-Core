# @mcp/bench

Performance benchmarking suite for MAGI-Core task operations.

## Quick Start

```bash
bun run seed    # Seed 10k benchmark tasks
bun run bench   # Run full benchmark suite
bun run ci      # CI check (fails if thresholds exceeded)
```

## Features

✅ Seeds 10k realistic mixed tasks with diverse distributions  
✅ Benchmarks 3 key operations: list, queryHybrid, plan_day  
✅ Reports p50/p95/p99 latencies and tokens/request  
✅ Evaluates search quality with precision@10 (MAP@10)  
✅ CI integration with configurable thresholds  

## Example Output

```
📈 Benchmark Results
════════════════════════════════════════════════════════════════════════════
Operation            Samples   p50      p95      p99      Mean     Tokens/Req
────────────────────────────────────────────────────────────────────────────
task.list            200       864μs    1.02ms   1.50ms   905μs    515
task.queryHybrid     100       363μs    716μs    1.19ms   396μs    226
task.plan_day        100       1.63ms   1.87ms   3.80ms   1.72ms   1242
════════════════════════════════════════════════════════════════════════════

⏱️  Total: 400 samples in 426ms
🎯 Precision: MAP@10 = 46.0% (5 queries)

✅ All performance thresholds passed!
```

## CI Integration

Default threshold: **task.list p95 < 200ms**

```yaml
- run: cd packages/bench && bun run seed
- run: cd packages/bench && bun run ci  # Fails if threshold exceeded
```

See [USAGE.md](./USAGE.md) for detailed documentation.
