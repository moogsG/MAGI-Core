# Task Markdown Export

The task export feature allows you to export your tasks to a formatted Markdown file with grouping, filtering, and AI-friendly prompt suggestions.

## Usage

### Basic Export

```typescript
import { openDB } from "./src/db/index.js";
import { exportMarkdown } from "./src/tasks/repo.js";

const db = openDB();

// Export with default options
const result = exportMarkdown(db);
console.log(`Exported ${result.taskCount} tasks to ${result.path}`);
```

### Export Options

```typescript
interface ExportMarkdownOptions {
  path?: string;              // Output file path (default: process.env.MARKDOWN_PATH || "./tasks.md")
  groupBy?: GroupByOption;    // Grouping strategy (default: "day")
  includePrompts?: boolean;   // Include AI prompt suggestions (default: true)
  filter?: {
    state?: Array<"inbox" | "open" | "done">;
    priority?: Array<"low" | "med" | "high">;
  };
}

type GroupByOption = "day" | "week" | "month" | "state" | "priority";
```

### Examples

#### Group by Day (Default)

```typescript
exportMarkdown(db, {
  path: "./tasks-by-day.md",
  groupBy: "day",
  includePrompts: true
});
```

Output structure:
```markdown
# Tasks Export

## Today
*3 tasks*

### Task Title
- **ID:** `t_12345678`
- **State:** 📥 inbox
- **Priority:** 🔴 high
...
```

#### Group by Priority

```typescript
exportMarkdown(db, {
  path: "./tasks-by-priority.md",
  groupBy: "priority",
  includePrompts: false
});
```

Output structure:
```markdown
# Tasks Export

## High Priority
*5 tasks*

## Med Priority
*3 tasks*

## Low Priority
*2 tasks*
```

#### Filter by State

```typescript
exportMarkdown(db, {
  path: "./open-tasks.md",
  groupBy: "day",
  filter: { state: ["open"] }
});
```

#### Filter by Priority

```typescript
exportMarkdown(db, {
  path: "./high-priority-tasks.md",
  groupBy: "state",
  filter: { priority: ["high"] }
});
```

#### Multiple Filters

```typescript
exportMarkdown(db, {
  path: "./urgent-open-tasks.md",
  groupBy: "day",
  filter: {
    state: ["open"],
    priority: ["high"]
  }
});
```

## Output Format

### Task Sections

Each task includes:

- **ID**: Unique task identifier
- **State**: Current state with emoji (📥 inbox, 🔄 open, ✅ done)
- **Priority**: Priority level with emoji (🔴 high, 🟡 med, 🟢 low)
- **Due**: Due date (if set)
- **Source**: Task source (github, slack, notion, local, etc.)
- **Created**: Creation timestamp
- **Context**: Task summary or body preview (first 300 chars)

### AI Prompt Suggestions

When `includePrompts: true`, each task includes 4 deterministic prompt templates:

1. **🔍 Investigate**: Find likely root causes and quick diagnostics
2. **📝 Summarize**: Summarize prior context and links in 5 bullets
3. **📋 Plan**: Propose a step-by-step plan to complete the task
4. **🧪 Test**: List test cases and edge conditions

These prompts are designed to help AI assistants provide contextual help for each task.

### Example Output

```markdown
# Tasks Export

*Generated: November 4, 2024 at 10:30:00 AM*

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

Add OAuth2 support with Google and GitHub providers

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Implement authentication system".
- 📝 Summarize: Summarize prior context and links for "Implement authentication system" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Implement authentication system".
- 🧪 Test: List test cases and edge conditions for "Implement authentication system".

---

### Write API documentation

- **ID:** `t_e5f6g7h8`
- **State:** 📥 inbox
- **Priority:** 🟡 med
- **Source:** notion
- **Created:** Nov 4, 2024 at 10:20 AM

**Context:**

Document all REST endpoints with examples

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Write API documentation".
- 📝 Summarize: Summarize prior context and links for "Write API documentation" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Write API documentation".
- 🧪 Test: List test cases and edge conditions for "Write API documentation".

---
```

## Environment Variables

### MARKDOWN_PATH

Set the default export path:

```bash
export MARKDOWN_PATH="./exports/tasks.md"
```

If not set, defaults to `./tasks.md` in the current directory.

## Grouping Strategies

### By Day
Groups tasks by creation date. Shows "Today", "Yesterday", or full date.

### By Week
Groups tasks by week (Monday-Sunday). Shows "Week of [date]".

### By Month
Groups tasks by month. Shows "Month Year" (e.g., "November 2024").

### By State
Groups tasks by workflow state: Inbox, Open, Done.

### By Priority
Groups tasks by priority level: High Priority, Med Priority, Low Priority.

## Use Cases

### Daily Standup Report
```typescript
exportMarkdown(db, {
  path: "./standup.md",
  groupBy: "day",
  filter: { state: ["open", "done"] }
});
```

### Sprint Planning
```typescript
exportMarkdown(db, {
  path: "./sprint-backlog.md",
  groupBy: "priority",
  filter: { state: ["inbox", "open"] },
  includePrompts: true
});
```

### Weekly Review
```typescript
exportMarkdown(db, {
  path: "./weekly-review.md",
  groupBy: "week",
  includePrompts: false
});
```

### AI Context Sharing
```typescript
exportMarkdown(db, {
  path: "./ai-context.md",
  groupBy: "state",
  includePrompts: true,
  filter: { state: ["open"] }
});
```

## API Reference

### exportMarkdown(db, options?)

Exports tasks to a Markdown file.

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

**Example:**
```typescript
const result = exportMarkdown(db, {
  path: "./tasks.md",
  groupBy: "day",
  includePrompts: true
});

console.log(`Exported ${result.taskCount} tasks in ${result.groupCount} groups`);
console.log(`File: ${result.path}`);
```

## Testing

The export functionality includes comprehensive tests with snapshot validation:

```bash
bun test export.test.ts
```

Tests cover:
- Task fetching with filters
- Grouping by all strategies
- Markdown formatting
- Prompt template generation
- File writing
- Snapshot validation

## Implementation Details

### Files

- `src/tasks/export.types.ts` - Type definitions
- `src/tasks/export.ts` - Core export logic
- `src/tasks/repo.ts` - Main export function
- `test/export.test.ts` - Comprehensive tests
- `test/__snapshots__/export.test.ts.snap` - Snapshot tests

### Architecture

1. **Fetch**: Query database with optional filters
2. **Group**: Organize tasks by specified criterion
3. **Format**: Convert to Markdown with templates
4. **Write**: Save to file system

### Extensibility

To add new grouping strategies:

1. Add to `GroupByOption` type in `export.types.ts`
2. Add case to `groupTasks()` switch in `export.ts`
3. Add tests in `export.test.ts`

To customize prompt templates:

1. Edit `PROMPT_TEMPLATES` in `export.types.ts`
2. Update snapshot tests

## Performance

- Fetches all matching tasks in a single query
- In-memory grouping and formatting
- Single file write operation
- Typical export time: < 100ms for 1000 tasks

## Limitations

- Exports entire filtered dataset (no pagination)
- File overwrites existing content
- No incremental updates
- Markdown only (no HTML, PDF, etc.)

## Future Enhancements

- [ ] Incremental/append mode
- [ ] Custom templates
- [ ] Multiple output formats
- [ ] Streaming for large datasets
- [ ] Scheduled exports
- [ ] Export to cloud storage
