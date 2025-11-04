# Database Schema & Seeding

This document describes the database schema, migrations, seeding, and performance characteristics of the MAGI Task system.

## Schema Overview

The database uses SQLite with better-sqlite3 and includes the following tables:

### Core Tables

#### `tasks`
Primary task storage with full-text search support.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,              -- Format: t_<uuid8>
  title TEXT NOT NULL,
  body TEXT,
  state TEXT CHECK(state IN ('inbox','open','done')) NOT NULL DEFAULT 'inbox',
  priority TEXT CHECK(priority IN ('low','med','high')) NOT NULL DEFAULT 'med',
  estimate_min INTEGER,
  due_ts TEXT,                      -- ISO 8601 timestamp
  source TEXT,                      -- Origin: local, slack, github, etc.
  summary TEXT,                     -- Optional short summary
  created_ts TEXT NOT NULL,         -- ISO 8601 timestamp
  updated_ts TEXT NOT NULL          -- ISO 8601 timestamp
);
```

**Indexes:**
- `idx_tasks_recent` - Optimizes recency queries (created_ts DESC)
- `idx_tasks_state` - Optimizes state/priority filtering
- `idx_tasks_due` - Optimizes due date queries
- `idx_tasks_updated` - Optimizes recently updated queries

#### `links`
External references associated with tasks.

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  kind TEXT CHECK(kind IN ('slack','mail','pr','doc')) NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_links_task` - Fast lookup by task_id

#### `events`
Audit trail and event history for tasks.

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  kind TEXT CHECK(kind IN ('capture','update','complete','ingest')) NOT NULL,
  at_ts TEXT NOT NULL,              -- ISO 8601 timestamp
  payload_json TEXT,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_events_task` - Fast lookup by task_id
- `idx_events_recent` - Optimizes recency queries (at_ts DESC)

### Integration Tables

#### `slack_messages`
Slack message cache for task context.

```sql
CREATE TABLE slack_messages (
  id TEXT PRIMARY KEY,              -- Format: {channel_id}_{ts}
  channel_id TEXT NOT NULL,
  ts TEXT NOT NULL,                 -- Slack timestamp
  user TEXT,
  text TEXT,
  thread_ts TEXT,
  edited_at TEXT,
  deleted INTEGER DEFAULT 0,
  permalink TEXT,
  created_ts TEXT NOT NULL
);
```

**Indexes:**
- `idx_slack_recent` - Recency queries (created_ts DESC)
- `idx_slack_channel` - Channel-specific queries
- `idx_slack_thread` - Thread lookup

#### `outlook_messages`
Outlook/Microsoft 365 email cache.

```sql
CREATE TABLE outlook_messages (
  id TEXT PRIMARY KEY,              -- Microsoft Graph message ID
  received_at TEXT NOT NULL,
  sender TEXT,
  subject TEXT,
  preview TEXT,
  web_link TEXT,
  folder TEXT,
  created_ts TEXT NOT NULL
);
```

**Indexes:**
- `idx_outlook_recent` - Recency queries (received_at DESC)
- `idx_outlook_folder` - Folder-specific queries

#### `calendars`
Calendar event cache.

```sql
CREATE TABLE calendars (
  id TEXT PRIMARY KEY,              -- Microsoft Graph event ID
  start TEXT NOT NULL,              -- ISO 8601 timestamp
  end TEXT NOT NULL,                -- ISO 8601 timestamp
  subject TEXT,
  location TEXT,
  web_link TEXT,
  created_ts TEXT NOT NULL
);
```

**Indexes:**
- `idx_calendars_start` - Start time queries
- `idx_calendars_range` - Range queries (start, end)

### Full-Text Search

#### `tasks_fts`
FTS5 virtual table for keyword search on tasks.

```sql
CREATE VIRTUAL TABLE tasks_fts USING fts5(
  title, 
  body, 
  summary, 
  content='tasks', 
  content_rowid='rowid'
);
```

**Automatic Sync:**
Triggers keep the FTS table in sync with the tasks table:
- `tasks_ai` - After INSERT
- `tasks_ad` - After DELETE
- `tasks_au` - After UPDATE

## Migrations

Migrations are stored in `src/db/migrations/` and run automatically on database open.

- `001_init.sql` - Initial schema with all tables, indexes, and FTS triggers

## Seeding

### Quick Start

```bash
# Seed 5,000 tasks + related data
bun run seed

# Or with custom database path
TASKS_DB_PATH=custom.db bun run seed
```

### What Gets Seeded

The seeder creates realistic test data:

- **5,000 tasks** with varied:
  - States: inbox, open, done (evenly distributed)
  - Priorities: low, med, high (evenly distributed)
  - Dates: spread over last 90 days
  - ~60% have time estimates
  - ~30% have due dates
  - ~40% have summaries

- **~3,000 links** (30% of tasks have 1-3 links):
  - Slack permalinks
  - Outlook web links
  - GitHub PR links
  - Google Doc links

- **~5,000 events** (40% of tasks have 1-4 events):
  - capture, update, complete, ingest
  - Timestamps within 7 days of task creation

- **500 Slack messages** across 4 channels
- **300 Outlook messages** across 4 folders
- **200 Calendar events** (future dates)

### Seeder Performance

On a typical development machine:
- **5,000 tasks**: ~300ms (0.06ms per task)
- **Total seeding time**: ~500ms including all tables

## Performance Benchmarks

### Acceptance Criteria

✅ **p95 < 200ms** for `task.list` queries on 5,000 tasks

### Actual Performance

Run benchmarks with:
```bash
bun run benchmark
```

Typical results on 5,000 tasks:

| Query Type | p50 | p95 | p99 |
|------------|-----|-----|-----|
| Default list (20 items) | 0.03ms | 0.04ms | 0.08ms |
| List 100 items | 0.12ms | 0.15ms | 0.31ms |
| Filter by state | 0.36ms | 0.46ms | 0.55ms |
| Filter by priority | 0.04ms | 0.05ms | 0.09ms |
| Filter state+priority | 0.27ms | 0.39ms | 0.48ms |
| FTS search "bug" | 0.12ms | 0.16ms | 0.27ms |
| FTS search "authentication" | 0.10ms | 0.13ms | 0.22ms |

**All queries are well under the 200ms p95 requirement** ✅

### Performance Tips

1. **Use indexes**: All common query patterns are indexed
2. **Limit results**: Default to 20 items, max 100
3. **FTS for search**: Use full-text search for keyword queries
4. **WAL mode**: Enabled by default for better concurrency
5. **Prepared statements**: All queries use prepared statements

## CLI Usage

The CLI provides a convenient interface for testing and development:

```bash
# Show statistics
bun run cli stats

# List tasks
bun run cli list --limit=10
bun run cli list --state=inbox --priority=high
bun run cli list --search=authentication

# Create task
bun run cli create "Fix bug" --priority=high --body="Details here"

# Show task details
bun run cli show t_12345678

# Update task
bun run cli update t_12345678 --state=done
bun run cli update t_12345678 --priority=high --title="New title"
```

## Database Inspection

Inspect the database schema and data:

```bash
bun run tsx src/db/inspect.ts
```

This shows:
- All tables
- All indexes
- Row counts
- Sample data from each table

## Maintenance

### Rebuild Database

```bash
# Delete existing database
rm tasks.db tasks.db-shm tasks.db-wal

# Reseed
bun run seed
```

### Vacuum Database

```bash
sqlite3 tasks.db "VACUUM;"
```

### Analyze Query Performance

```bash
sqlite3 tasks.db "EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE state='inbox' ORDER BY created_ts DESC LIMIT 20;"
```

## Future Enhancements

- [ ] Add DuckDB analytics layer
- [ ] Add Qdrant vector search
- [ ] Implement soft deletes
- [ ] Add task dependencies table
- [ ] Add tags/labels table
- [ ] Add user/team tables for multi-user support
- [ ] Add attachment storage
- [ ] Implement incremental sync for integrations
