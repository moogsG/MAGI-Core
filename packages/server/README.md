# MCP Local Tasks Server

Local-first MCP server for managing development tasks with Model Context Protocol support.

## Features

- **Task Management**: Create, list, expand, and update tasks
- **Hybrid Search**: Combine keyword (FTS5) and semantic (Qdrant) search
- **Markdown Export**: Export tasks with grouping, filtering, and AI prompt suggestions
- **SQLite Storage**: Operational truth with FTS5 for keyword search
- **Extensible**: Pluggable connection helpers for Slack, Microsoft 365, etc.
- **Token-lean**: Returns compact handles; expand on demand
- **Local-first**: Private by default

## MCP Tools

### Core Task Tools
- `task.create` - Create a new task
- `task.list` - List tasks as compact handles with filtering
- `task.expand` - Get full task details
- `task.update` - Update task fields
- `task.queryHybrid` - Hybrid search combining keyword and semantic search
- `task.export_markdown` - Export tasks to Markdown with grouping and AI prompts

### Helper Tools (from connectors)
Helper tools are automatically loaded from `config.json` and exposed via MCP:
- `slack.list_channels` - List available Slack channels
- `slack.get_history` - Get message history from a channel
- `slack.post_message` - Post messages to channels
- `slack.summarize_messages` - Get messages formatted for AI summarization

See [EXPORT_MARKDOWN.md](../../docs/EXPORT_MARKDOWN.md) for detailed export documentation.

## Quick Start

### Running the MCP Server

The MCP server provides task management tools via stdio transport:

```bash
# Run MCP server (for MCP clients)
bun src/index.ts

# Or use the dev script
bun run dev
```

### Running Slack Integration (Optional)

If you need Slack integration, run the separate Slack daemon:

```bash
# Run Slack daemon (separate process)
bun run slack
```

**Important:** The MCP server and Slack daemon should run as separate processes. The MCP server uses stdio transport and cannot share the same process with background services.

## MCP Client Configuration

Add to your MCP client config (e.g., Claude Desktop, Cline):

```json
{
  "mcpServers": {
    "tasks": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/packages/server/src/index.ts"],
      "env": {
        "TASKS_DB_PATH": "/path/to/tasks.db"
      }
    }
  }
}
```

## Testing the MCP Server

You can test the server manually using echo commands:

```bash
# List available tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | bun src/index.ts

# Create a task
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"task.create","arguments":{"title":"My task"}},"id":2}' | bun src/index.ts

# List tasks
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"task.list","arguments":{"limit":10}},"id":3}' | bun src/index.ts
```

## Development

```bash
# Install dependencies
pnpm install

# Run MCP server
pnpm dev

# Run Slack daemon
pnpm slack

# Build
pnpm build

# Test
pnpm test

# Run CLI
pnpm cli
```

## Configuration

### Environment Variables

- `TASKS_DB_PATH` - Path to SQLite database (default: "tasks.db")

### Helper Configuration

Helpers are configured in `config.json` in the project root. The MCP server automatically loads helpers and exposes their tools.

**MCP Mode (tools only, no background services):**
```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {
        "enable_background_services": false
      }
    }
  ]
}
```

**Daemon Mode (with Socket Mode, sweeper, etc.):**
```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {
        "allow_channels": ["#dev", "#ai"],
        "sweeper_minutes": 10,
        "enable_todo_detection": true,
        "enable_background_services": true
      }
    }
  ]
}
```

**Environment variables for Slack (required only if `enable_background_services: true`):**
- `SLACK_APP_TOKEN` - Your Slack app token
- `SLACK_BOT_TOKEN` - Your Slack bot token

## Architecture

### MCP Server (`src/index.ts`)
- Task management + helper tools via MCP protocol
- Uses stdio transport for MCP protocol
- Automatically loads helpers from `config.json`
- Helpers run in "tools-only" mode (no background services)
- Clean process lifecycle with graceful shutdown

### Slack Daemon (`src/slack-daemon.ts`)
- Separate process for Slack background services
- Runs Socket Mode, message sweeping, permalink hydration
- Use this when you need real-time Slack message ingestion
- Configure with `enable_background_services: true`

## Troubleshooting

### "Connection closed" error

This was caused by helper initialization interfering with stdio transport. **Fixed** by:
1. Removing helper loading from MCP server entry point
2. Adding keep-alive mechanism to `startServer()`
3. Creating separate `slack-daemon.ts` for Slack integration

### Server not responding

Make sure you're running the correct entry point:
- For MCP clients: `bun src/index.ts`
- For Slack integration: `bun src/slack-daemon.ts`

### Database locked

Ensure only one process is accessing the database at a time. Use WAL mode (enabled by default) for better concurrency.
