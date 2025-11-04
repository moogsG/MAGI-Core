# MCP Local Tasks Server

Local-first MCP server for managing development tasks from Slack and Microsoft 365.

## Features

- **Task Management**: Create, list, expand, and update tasks
- **Markdown Export**: Export tasks with grouping, filtering, and AI prompt suggestions
- **SQLite Storage**: Operational truth with FTS5 for keyword search
- **Extensible**: Pluggable connection helpers for Slack, Microsoft 365, etc.
- **Token-lean**: Returns compact handles; expand on demand
- **Local-first**: Private by default

## Tools

- `task.create` - Create a new task
- `task.list` - List tasks as compact handles with filtering
- `task.expand` - Get full task details
- `task.update` - Update task fields
- `task.export_markdown` - Export tasks to Markdown with grouping and AI prompts

See [EXPORT_MARKDOWN.md](../../docs/EXPORT_MARKDOWN.md) for detailed export documentation.

## Development

```bash
# Install dependencies
pnpm install

# Run server
pnpm dev

# Build
pnpm build

# Test
pnpm test
```

## Configuration

See root `config.json` for helper configuration.
