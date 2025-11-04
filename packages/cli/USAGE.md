# mcp-tasks CLI Usage Guide

## Quick Start

```bash
# From project root
bun packages/cli/src/cli.ts <command> [options]

# Or create an alias
alias mcp-tasks="bun packages/cli/src/cli.ts"
```

## Commands

### 1. Add Task

Create a new task with priority and due date:

```bash
mcp-tasks add "Fix Pax8 sync" -p high -d 2025-11-05
mcp-tasks add "Update documentation" -p med -b "Add examples for new features"
```

**Options:**
- `-p, --priority <priority>`: low, med, high (default: med)
- `-d, --due <date>`: Due date (YYYY-MM-DD or ISO format)
- `-s, --source <source>`: Task source label
- `-b, --body <body>`: Task description

### 2. List Tasks

Display tasks with filtering:

```bash
mcp-tasks list
mcp-tasks list --state open --priority high
mcp-tasks list --limit 10 --json
```

**Options:**
- `--state <states...>`: Filter by inbox, open, done
- `--priority <priorities...>`: Filter by low, med, high
- `-l, --limit <number>`: Max tasks to show (default: 20)
- `--json`: Output as JSON

### 3. Expand Task

Show full details for a task:

```bash
mcp-tasks expand t_abc123
mcp-tasks expand t_abc123 --json
```

### 4. Export Tasks

Export tasks to markdown or JSON:

```bash
mcp-tasks export
mcp-tasks export -o tasks.md --group-by priority
mcp-tasks export --state open --include-prompts
mcp-tasks export --json -o tasks.json
```

**Options:**
- `-o, --output <file>`: Output file (stdout if not specified)
- `-g, --group-by <groupBy>`: day, week, month, state, priority (default: state)
- `--state <states...>`: Filter by state
- `--priority <priorities...>`: Filter by priority
- `--include-prompts`: Add suggested prompts to markdown
- `--json`: Export as JSON

### 5. Plan Tasks

Plan tasks for a time period using docs context:

```bash
mcp-tasks plan --hours 4
mcp-tasks plan --hours 8 --docs ./docs
```

**Features:**
- Loads context from documentation files
- Uses hybrid search (falls back to regular list if unavailable)
- Prioritizes by priority level and relevance
- Allocates tasks within time budget

**Options:**
- `--hours <hours>`: Hours available (default: 4)
- `--docs <path>`: Docs directory path (default: docs)

### 6. Import Tasks

Scan and import tasks from markdown:

```bash
mcp-tasks import.scan -f backlog.md --dry-run
mcp-tasks import.scan -f backlog.md -s "sprint-planning"
```

**Supported Formats:**
- Headers: `### Task Title`
- Checkboxes: `- [ ] Task Title`
- Metadata: `- **Priority:** high`, `- **Due:** 2025-11-05`

**Options:**
- `-f, --file <file>`: File to scan (required)
- `-s, --source <source>`: Source label for imports
- `--dry-run`: Preview without importing

## Examples

### Daily Workflow

```bash
# Morning: Plan your day
mcp-tasks plan --hours 6

# Add urgent task
mcp-tasks add "Fix production bug" -p high -d 2025-11-04

# Check open tasks
mcp-tasks list --state open

# Get task details
mcp-tasks expand t_abc123

# End of day: Export work
mcp-tasks export --state done --group-by day -o daily-report.md
```

### Sprint Planning

```bash
# Import backlog
mcp-tasks import.scan -f sprint-backlog.md -s "sprint-42"

# Review high priority
mcp-tasks list --priority high --state inbox

# Plan sprint
mcp-tasks plan --hours 40

# Export plan
mcp-tasks export --state open --group-by priority -o sprint-plan.md --include-prompts
```

## Environment Variables

- `MCP_SERVER_COMMAND`: Server command (default: bun)
- `MCP_SERVER_ARGS`: Server arguments (default: packages/server/src/index.ts)

## Troubleshooting

### Hybrid Search Unavailable

If you see "Hybrid search unavailable", the CLI automatically falls back to regular list. This happens when:
- Qdrant is not running
- Embeddings haven't been generated
- Vector database is not configured

The CLI will still work using regular task listing.

### Connection Issues

If the MCP server fails to start:
1. Check that the database exists: `data/tasks.db`
2. Verify server can run: `bun packages/server/src/index.ts`
3. Check environment variables are set correctly

## Help

```bash
mcp-tasks --help
mcp-tasks <command> --help
```
