# Markdown Export Guide

Export tasks to formatted Markdown files for AI context, documentation, and reporting.

## Overview

The markdown export feature converts your task database into human-readable and AI-friendly Markdown documents with:

- Flexible grouping (by day, week, month, state, priority)
- Filtering by state and priority
- Optional AI prompt suggestions
- Consistent formatting
- Idempotent exports (safe to re-run)

## Quick Start

### From CLI

```bash
cd packages/server
bun src/cli.ts export
```

Exports to `./tasks.md` by default.

### From TypeScript

```typescript
import { openDB } from "./src/db/index.js";
import { exportMarkdown } from "./src/tasks/repo.js";

const db = openDB();
const result = exportMarkdown(db);
console.log(`Exported ${result.taskCount} tasks to ${result.path}`);
```

### From MCP Tool

```javascript
// In your AI assistant:
"Export my tasks to markdown grouped by priority"
```

The assistant will call `task.export_markdown` with appropriate options.

## Export Options

```typescript
interface ExportMarkdownOptions {
  path?: string;              // Output file path
  groupBy?: GroupByOption;    // Grouping strategy
  includePrompts?: boolean;   // Include AI prompt suggestions
  filter?: {
    state?: Array<"inbox" | "open" | "done">;
    priority?: Array<"low" | "med" | "high">;
  };
}

type GroupByOption = "day" | "week" | "month" | "state" | "priority";
```

### Default Values

```typescript
{
  path: process.env.MARKDOWN_PATH || "./tasks.md",
  groupBy: "day",
  includePrompts: true,
  filter: undefined  // No filtering
}
```

## Grouping Strategies

### By Day (Default)

Groups tasks by creation date.

```typescript
exportMarkdown(db, { groupBy: "day" });
```

Output structure:
```markdown
## Today
*3 tasks*

## Yesterday
*5 tasks*

## Friday, November 1, 2024
*2 tasks*
```

### By Week

Groups tasks by week (Monday start).

```typescript
exportMarkdown(db, { groupBy: "week" });
```

Output structure:
```markdown
## Week of Monday, November 4, 2024
*8 tasks*

## Week of Monday, October 28, 2024
*12 tasks*
```

### By Month

Groups tasks by month.

```typescript
exportMarkdown(db, { groupBy: "month" });
```

Output structure:
```markdown
## November 2024
*20 tasks*

## October 2024
*35 tasks*
```

### By State

Groups tasks by workflow state.

```typescript
exportMarkdown(db, { groupBy: "state" });
```

Output structure:
```markdown
## Inbox
*15 tasks*

## Open
*23 tasks*

## Done
*42 tasks*
```

### By Priority

Groups tasks by priority level.

```typescript
exportMarkdown(db, { groupBy: "priority" });
```

Output structure:
```markdown
## High Priority
*8 tasks*

## Med Priority
*25 tasks*

## Low Priority
*12 tasks*
```

## Filtering

### By State

Export only specific states:

```typescript
// Only inbox tasks
exportMarkdown(db, {
  filter: { state: ["inbox"] }
});

// Open and inbox tasks
exportMarkdown(db, {
  filter: { state: ["open", "inbox"] }
});
```

### By Priority

Export only specific priorities:

```typescript
// Only high priority
exportMarkdown(db, {
  filter: { priority: ["high"] }
});

// High and medium priority
exportMarkdown(db, {
  filter: { priority: ["high", "med"] }
});
```

### Combined Filters

Combine state and priority filters:

```typescript
// High priority open tasks
exportMarkdown(db, {
  filter: {
    state: ["open"],
    priority: ["high"]
  }
});
```

## Output Format

### Document Structure

```markdown
# Tasks Export

*Generated: November 4, 2025 at 02:30:00 PM*

---

## [Group Label]

*[N] task[s]*

### [Task Title]

- **ID:** `t_12345678`
- **State:** [emoji] [state]
- **Priority:** [emoji] [priority]
- **Due:** [date] (if set)
- **Source:** [source]
- **Created:** [timestamp]

**Context:**

[task summary or body preview (≤300 chars)]

**💡 Suggested Prompts:**

- [4 AI prompt templates]

---
```

### State Indicators

| State | Emoji | Display |
|-------|-------|---------|
| inbox | 📥 | inbox |
| open | 🔄 | open |
| done | ✅ | done |

### Priority Indicators

| Priority | Emoji | Display |
|----------|-------|---------|
| high | 🔴 | high |
| med | 🟡 | med |
| low | 🟢 | low |

### Task Metadata

Each task includes:

- **ID**: Unique identifier for referencing
- **State**: Current workflow state
- **Priority**: Importance level
- **Due**: Due date (if set)
- **Source**: Origin (slack, github, notion, local, etc.)
- **Created**: Creation timestamp
- **Context**: Summary or body preview (first 300 chars)

### AI Prompt Suggestions

When `includePrompts: true`, each task includes 4 deterministic prompt templates:

1. **🔍 Investigate**: Find likely root causes and quick diagnostics for "[title]"
2. **📝 Summarize**: Summarize prior context and links for "[title]" in 5 bullets
3. **📋 Plan**: Propose a step-by-step plan to complete "[title]"
4. **🧪 Test**: List test cases and edge conditions for "[title]"

These help AI assistants provide contextual help.

## Idempotence

Exports are **idempotent** - safe to re-run:

1. **Overwrites existing file**: Each export replaces the previous one
2. **Consistent output**: Same input produces same output
3. **No side effects**: Database is read-only during export
4. **Atomic writes**: File written in single operation

**Example:**

```bash
# First export
bun src/cli.ts export
# Exported 50 tasks to /path/to/tasks.md

# Add 10 more tasks
bun src/cli.ts create "New task" --priority=high
# ... (9 more)

# Re-export
bun src/cli.ts export
# Exported 60 tasks to /path/to/tasks.md
```

The file is completely replaced with the new export. No duplication or merging.

## Use Cases

### Daily Standup Report

Export today's work:

```typescript
exportMarkdown(db, {
  path: "./standup.md",
  groupBy: "day",
  filter: { state: ["open", "done"] },
  includePrompts: false
});
```

### Sprint Planning

Export backlog with AI prompts:

```typescript
exportMarkdown(db, {
  path: "./sprint-backlog.md",
  groupBy: "priority",
  filter: { state: ["inbox", "open"] },
  includePrompts: true
});
```

### Weekly Review

Export full week:

```typescript
exportMarkdown(db, {
  path: "./weekly-review.md",
  groupBy: "week",
  includePrompts: false
});
```

### AI Context Sharing

Export open tasks with prompts:

```typescript
exportMarkdown(db, {
  path: "./ai-context.md",
  groupBy: "state",
  filter: { state: ["open"] },
  includePrompts: true
});
```

Share this file with AI assistants for contextual help.

### Priority Triage

Export by priority for review:

```typescript
exportMarkdown(db, {
  path: "./triage.md",
  groupBy: "priority",
  includePrompts: false
});
```

### High Priority Dashboard

Export urgent tasks:

```typescript
exportMarkdown(db, {
  path: "./urgent.md",
  groupBy: "day",
  filter: { priority: ["high"], state: ["inbox", "open"] },
  includePrompts: true
});
```

## Environment Variables

### MARKDOWN_PATH

Set default export path:

```bash
export MARKDOWN_PATH="./exports/tasks.md"
```

Or in `.env`:

```bash
MARKDOWN_PATH=./exports/tasks.md
```

If not set, defaults to `./tasks.md`.

## Performance

- **Fetch**: Single SQL query with filters
- **Group**: In-memory O(n) grouping
- **Format**: In-memory string building
- **Write**: Single atomic file write

**Benchmarks:**

| Task Count | Time | Notes |
|------------|------|-------|
| 100 | <10ms | Instant |
| 1,000 | ~50ms | Very fast |
| 10,000 | ~200ms | Acceptable |

## Privacy

### Redacted Information

Previews automatically truncate:
- Body text: ≤300 chars
- No credentials in output
- Links are preserved as-is

### Sensitive Data

**Never exported:**
- Database internal IDs (only task IDs)
- Full message bodies (only previews)
- User credentials
- API tokens

**Exported:**
- Task titles
- Task IDs
- Metadata (state, priority, dates)
- Source attribution
- Public links (permalinks, URLs)

## API Reference

### exportMarkdown(db, options?)

Export tasks to Markdown file.

**Parameters:**
- `db: DB` - Database instance
- `options?: ExportMarkdownOptions` - Export configuration

**Returns:**
```typescript
{
  ok: true;
  path: string;        // Absolute path to exported file
  taskCount: number;   // Number of tasks exported
  groupCount: number;  // Number of groups created
}
```

**Errors:**
- Throws if file write fails
- Throws if database query fails
- Does not throw on empty result set

**Example:**

```typescript
import { openDB } from "./src/db/index.js";
import { exportMarkdown } from "./src/tasks/repo.js";

const db = openDB();

const result = exportMarkdown(db, {
  path: "./exports/sprint-backlog.md",
  groupBy: "priority",
  filter: { state: ["inbox", "open"] },
  includePrompts: true
});

console.log(`✅ Exported ${result.taskCount} tasks in ${result.groupCount} groups`);
console.log(`📄 File: ${result.path}`);
```

Output:
```
✅ Exported 45 tasks in 3 groups
📄 File: /Users/you/project/exports/sprint-backlog.md
```

## Example Output

Full example of exported Markdown:

```markdown
# Tasks Export

*Generated: November 4, 2025 at 02:30:00 PM*

---

## Today

*2 tasks*

### Implement authentication system

- **ID:** `t_a1b2c3d4`
- **State:** 📥 inbox
- **Priority:** 🔴 high
- **Due:** Nov 10, 2024
- **Source:** github
- **Created:** Nov 4, 2024 at 09:15 AM

**Context:**

Add OAuth2 support with Google and GitHub providers. Need to handle token refresh and user session management.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Implement authentication system".
- 📝 Summarize: Summarize prior context and links for "Implement authentication system" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Implement authentication system".
- 🧪 Test: List test cases and edge conditions for "Implement authentication system".

---

### Write API documentation

- **ID:** `t_e5f6g7h8`
- **State:** 🔄 open
- **Priority:** 🟡 med
- **Source:** notion
- **Created:** Nov 4, 2024 at 10:20 AM

**Context:**

Document all REST endpoints with examples and response schemas. Include authentication requirements.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Write API documentation".
- 📝 Summarize: Summarize prior context and links for "Write API documentation" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Write API documentation".
- 🧪 Test: List test cases and edge conditions for "Write API documentation".

---

## Yesterday

*1 task*

### Fix login redirect bug

- **ID:** `t_i9j0k1l2`
- **State:** ✅ done
- **Priority:** 🔴 high
- **Source:** slack
- **Created:** Nov 3, 2024 at 03:45 PM

**Context:**

Users redirected to 404 after successful login. Fixed redirect URL in auth callback handler.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Fix login redirect bug".
- 📝 Summarize: Summarize prior context and links for "Fix login redirect bug" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Fix login redirect bug".
- 🧪 Test: List test cases and edge conditions for "Fix login redirect bug".

---
```

## Troubleshooting

### Export produces empty file

**Cause:** No tasks match filter criteria.

**Fix:**
```typescript
// Check database has tasks
const count = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
console.log(`Total tasks: ${count.count}`);

// Try exporting without filters
exportMarkdown(db);
```

### File not found error

**Cause:** Output directory doesn't exist.

**Fix:**
```bash
mkdir -p ./exports
```

Or use absolute path:
```typescript
exportMarkdown(db, {
  path: "/absolute/path/to/tasks.md"
});
```

### Large file size

**Cause:** Too many tasks or prompts enabled.

**Fix:**
```typescript
// Export without prompts
exportMarkdown(db, { includePrompts: false });

// Or filter to fewer tasks
exportMarkdown(db, {
  filter: { state: ["open"] },
  includePrompts: false
});
```

### Encoding issues

**Cause:** Special characters in task titles/bodies.

**Fix:** Markdown export handles Unicode correctly by default. If you see issues:

```typescript
// File is always written as UTF-8
// Check your terminal/editor encoding settings
```

## Advanced Usage

### Custom Export Path from Environment

```bash
export MARKDOWN_PATH="./reports/$(date +%Y-%m-%d)-tasks.md"
bun src/cli.ts export
```

### Scheduled Exports

Using cron:

```bash
# Daily export at 5 PM
0 17 * * * cd /path/to/MAGI-Core && bun packages/server/src/cli.ts export
```

### Multiple Exports

```bash
#!/bin/bash
cd packages/server

# Daily standup
bun src/cli.ts export \
  --path=./standup.md \
  --group-by=day \
  --state=open

# Sprint backlog
bun src/cli.ts export \
  --path=./backlog.md \
  --group-by=priority \
  --state=inbox,open

# Weekly review
bun src/cli.ts export \
  --path=./weekly.md \
  --group-by=week
```

### Git-Tracked Exports

Add exports to version control:

```bash
# Export to tracked file
bun src/cli.ts export --path=./docs/tasks.md

# Commit if changed
git add docs/tasks.md
git commit -m "Update task export"
```

Useful for team visibility and change tracking.

## Limitations

- **No pagination**: Exports entire filtered dataset
- **Overwrites files**: No append/merge mode
- **Markdown only**: No HTML, PDF, JSON, etc.
- **Static snapshots**: No live updates

## Future Enhancements

- [ ] Append mode for incremental exports
- [ ] Custom Markdown templates
- [ ] Multiple output formats (HTML, PDF, JSON)
- [ ] Streaming for large datasets
- [ ] Scheduled/automatic exports
- [ ] Cloud storage integration (S3, GCS, etc.)
- [ ] Export compression (gzip)
- [ ] Export encryption

## See Also

- [Configuration Guide](./config.md) - Environment variables
- [Quickstart Guide](./quickstart.md) - Initial setup
- [API Reference](../packages/server/README.md) - Full API docs
- [Implementation](../docs/IMPLEMENTATION_EXPORT.md) - Technical details
