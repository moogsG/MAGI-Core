# @mcp/cli

Command-line interface for managing tasks via the MCP (Model Context Protocol) server.

## Installation

```bash
cd packages/cli
bun install
```

## Usage

The CLI communicates with the MCP server via stdio transport. Make sure the server package is available.

### Basic Commands

#### Add a Task

Create a new task with optional priority and due date:

```bash
bun src/cli.ts add "Fix Pax8 sync" -p high -d 2025-11-05
bun src/cli.ts add "Update documentation" -p med -b "Add examples for new features"
```

Options:
- `-p, --priority <priority>`: Task priority (low, med, high) - default: med
- `-d, --due <date>`: Due date in YYYY-MM-DD or ISO format
- `-s, --source <source>`: Task source label
- `-b, --body <body>`: Task body/description

#### List Tasks

Display tasks with optional filtering:

```bash
bun src/cli.ts list
bun src/cli.ts list --state open --priority high
bun src/cli.ts list --limit 10 --json
```

Options:
- `--state <states...>`: Filter by state (inbox, open, done)
- `--priority <priorities...>`: Filter by priority (low, med, high)
- `-l, --limit <number>`: Maximum number of tasks (default: 20)
- `--json`: Output as JSON

#### Expand Task

Show full details for a specific task:

```bash
bun src/cli.ts expand abc123
bun src/cli.ts expand abc123 --json
```

Options:
- `--json`: Output as JSON

#### Export Tasks

Export tasks to markdown or JSON format:

```bash
bun src/cli.ts export
bun src/cli.ts export -o tasks.md --group-by priority
bun src/cli.ts export --state open --include-prompts
bun src/cli.ts export --json -o tasks.json
```

Options:
- `-o, --output <file>`: Output file path (prints to stdout if not specified)
- `-g, --group-by <groupBy>`: Group by: day, week, month, state, priority (default: state)
- `--state <states...>`: Filter by state
- `--priority <priorities...>`: Filter by priority
- `--include-prompts`: Include suggested prompts in markdown export
- `--json`: Export as JSON instead of markdown

#### Plan Tasks

Plan tasks for a time period using documentation context:

```bash
bun src/cli.ts plan --hours 4
bun src/cli.ts plan --hours 8 --docs ./docs
```

This command:
1. Loads context from documentation files in the specified directory
2. Uses hybrid search to find relevant open tasks
3. Prioritizes tasks based on priority level and relevance
4. Allocates tasks to fit within the specified time budget

Options:
- `--hours <hours>`: Hours available for work (default: 4)
- `--docs <path>`: Path to docs directory (default: docs)

#### Import Tasks from File

Scan a markdown file and import tasks:

```bash
bun src/cli.ts import.scan -f backlog.md --dry-run
bun src/cli.ts import.scan -f backlog.md -s "sprint-planning"
```

The scanner recognizes tasks in these formats:
- Markdown headers: `### Task Title`
- Checkboxes: `- [ ] Task Title`
- Metadata: `- **Priority:** high`, `- **Due:** 2025-11-05`

Options:
- `-f, --file <file>`: File to scan (required)
- `-s, --source <source>`: Source label for imported tasks
- `--dry-run`: Preview without importing

## Environment Variables

- `MCP_SERVER_COMMAND`: Command to start MCP server (default: `bun`)
- `MCP_SERVER_ARGS`: Arguments for MCP server (default: `packages/server/src/cli.ts`)

## Examples

### Daily Workflow

```bash
# Morning: Plan your day
bun src/cli.ts plan --hours 6

# Add a new urgent task
bun src/cli.ts add "Fix production bug" -p high -d 2025-11-04

# Check your open tasks
bun src/cli.ts list --state open

# Get details on a specific task
bun src/cli.ts expand abc123

# End of day: Export completed work
bun src/cli.ts export --state done --group-by day -o daily-report.md
```

### Sprint Planning

```bash
# Import tasks from planning document
bun src/cli.ts import.scan -f sprint-backlog.md -s "sprint-42"

# Review high priority items
bun src/cli.ts list --priority high --state inbox

# Plan the sprint
bun src/cli.ts plan --hours 40

# Export sprint plan
bun src/cli.ts export --state open --group-by priority -o sprint-plan.md --include-prompts
```

## Development

Build the package:

```bash
bun run build
```

Run tests:

```bash
bun test
```

## Architecture

The CLI uses:
- **Commander.js**: CLI framework for parsing commands and options
- **MCP SDK**: Client library for communicating with the MCP server via stdio
- **Modular Commands**: Each command is implemented in a separate module for maintainability

### Project Structure

```
packages/cli/
├── src/
│   ├── cli.ts              # Main CLI entry point
│   ├── client.ts           # MCP client connection handler
│   └── commands/
│       ├── add.ts          # Add task command
│       ├── list.ts         # List tasks command
│       ├── expand.ts       # Expand task command
│       ├── export.ts       # Export tasks command
│       ├── plan.ts         # Plan tasks command
│       └── import-scan.ts  # Import/scan tasks command
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
