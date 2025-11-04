# @mcp/data

Analytics and vector search layer for MAGI-Core tasks.

## Features

- **Parquet Snapshots**: Export SQLite tables to Parquet format for analytics
- **DuckDB Views**: Pre-built views for today, week, and overdue tasks
- **Qdrant Integration**: Vector search with `tasks_vec` collection
- **Hybrid Search**: Combines keyword (FTS5/DuckDB) + semantic (Qdrant) search
- **Batching Embedder**: Efficient batch processing for embeddings

## Scripts

```bash
# Snapshot SQLite to Parquet
bun run snapshot

# Initialize Qdrant collection
bun run init-qdrant

# Build package
bun run build
```

## Usage

```typescript
import { snapshotToParquet } from "@mcp/data";
import { initQdrant } from "@mcp/data";
import { queryHybrid } from "@mcp/data";

// Snapshot tasks to Parquet
await snapshotToParquet("tasks.db", "data/snapshots");

// Initialize Qdrant
await initQdrant();

// Hybrid search
const results = await queryHybrid("invoice mismatch", { k: 10 });
```

## Architecture

- **snapshot.ts**: SQLite → Parquet export
- **duckdb-views.ts**: Analytical views (today, week, overdue)
- **qdrant-init.ts**: Vector collection setup
- **embedder.ts**: Batch embedding with stub/real implementations
- **hybrid-search.ts**: Weighted ranking merge
