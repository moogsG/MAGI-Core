# Quickstart Guide

Get MAGI-Core running in under 10 minutes.

## Prerequisites

- **Bun** v1.0+ ([install](https://bun.sh))
- **Git**
- Optional: **Docker** (for Qdrant vector search)

## Setup

### 1. Clone and Install

```bash
git clone <repository-url> MAGI-Core
cd MAGI-Core
bun install
```

### 2. Environment Configuration

Copy the sample environment file:

```bash
cp sample.env .env
```

Edit `.env` with your settings. Minimal configuration:

```bash
# Core settings
TASKS_DB_PATH=./data/tasks.db
MARKDOWN_PATH=./tasks.md
NODE_ENV=development

# Optional: Enable Qdrant for semantic search
QDRANT_ENABLED=false
```

**For Slack integration**, add these to `.env`:

```bash
# Slack tokens (get from https://api.slack.com/apps)
SLACK_APP_TOKEN=xapp-1-...
SLACK_BOT_TOKEN=xoxb-...

# Slack configuration
SLACK_ALLOWED_CHANNELS=#dev,#ai,#support
SLACK_USER_ID=U123456789
SLACK_SWEEPER_MINUTES=10
SLACK_ENABLE_TODO_DETECTION=true
SLACK_ENABLE_BACKGROUND_SERVICES=true
```

**Note:** All connector configuration is done via environment variables. The `config.json` file only defines which connectors to load.

See [Configuration Guide](./config.md) for all options.

### 3. Build

```bash
bun run build
```

This compiles all packages:
- `packages/server` - MCP server
- `packages/data` - Analytics & vector search
- `packages/connectors/*` - Slack, Microsoft 365, etc.

### 4. Run the Server

```bash
bun run dev
```

The MCP server starts on stdio by default. You should see:

```
[mcp-local-tasks] stdio server started
```

## Connector Setup

### Slack Integration

See [Connectors Guide](./connectors.md) for detailed setup.

**Quick version:**

1. Create a Slack App at https://api.slack.com/apps
2. Add Bot Token Scopes:
   - `channels:read`, `channels:history`
   - `groups:read`, `groups:history`
   - `chat:write`, `links:read`
3. Enable Socket Mode with `connections:write` scope
4. Install to workspace and get tokens

Add to `.env`:

```bash
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_ALLOWED_CHANNELS=#dev,#ai,#support
```

Add to `config.json`:

```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {
        "allow_channels": ["#dev", "#ai", "#support"],
        "sweeper_minutes": 10,
        "enable_todo_detection": true
      }
    }
  ]
}
```

Restart the server.

### Microsoft 365 Integration

See [Connectors Guide](./connectors.md) for detailed setup.

**Quick version:**

1. Register Azure AD Application at https://portal.azure.com
2. Add API permissions:
   - `Mail.Read`, `Mail.Send`
   - `Calendars.Read`, `offline_access`
3. Enable public client flows

Add to `.env`:

```bash
MS_CLIENT_ID=your-client-id
MS_TENANT_ID=common
```

Add to `config.json`:

```json
{
  "helpers": [
    {
      "name": "outlook",
      "module": "./packages/connectors/ms/dist/index.js",
      "config": {
        "poll_minutes": 5
      }
    }
  ]
}
```

On first start, follow the device code authentication flow.

## Connect to AI Tools

### Claude Desktop / Cline / Continue

Add MAGI-Core to your MCP client configuration:

**For stdio transport (recommended):**

```json
{
  "mcpServers": {
    "MAGIcore": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/absolute/path/to/MAGI-Core",
      "env": {
        "TASKS_DB_PATH": "./data/tasks.db"
      }
    }
  }
}
```

**For HTTP transport (if using mcp-remote):**

First, start MAGI-Core with HTTP transport:

```bash
# In a separate terminal
cd MAGI-Core
MCP_TRANSPORT=http MCP_PORT=3000 bun run dev
```

Then add to your AI tool config:

```json
{
  "mcpServers": {
    "MAGIcore": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "mcp-remote", "http://localhost:3000"]
    }
  }
}
```

### Cursor / Other Editors

Use the same stdio or HTTP transport configurations. Check your editor's MCP integration docs for the exact config file location.

## Verify Installation

### Test the Database

```bash
cd packages/server
bun src/cli.ts stats
```

Expected output:

```
📊 Database Statistics

  Tasks                0
  Links                0
  Events               0
  Slack Messages       0
  Outlook Messages     0
  Calendar Events      0
```

### Create a Test Task

```bash
bun src/cli.ts create "Test task" --priority=high --body="Testing MAGI-Core setup"
```

Expected output:

```
✅ Created task: t_12345678
   Title: Test task
   State: inbox
```

### List Tasks

```bash
bun src/cli.ts list
```

Expected output:

```
📋 Tasks (1 results in 2.34ms)

  📥 t_12345678 - Test task
     Testing MAGI-Core setup
```

### Export to Markdown

```bash
cd packages/server
bun src/cli.ts export
```

See [Markdown Export Guide](./markdown-export.md) for details.

## Performance Validation

MAGI-Core should meet these targets:

| Operation | Target | Command |
|-----------|--------|---------|
| task.list | p50 ≤ 60ms, p95 ≤ 200ms | `bun src/cli.ts list` |
| hybrid query | p50 ≤ 120ms | `bun run test:hybrid` |
| token usage | list ≤ 600 tokens | Check MCP response size |

Run the hybrid search benchmark:

```bash
cd packages/server
bun run seed:hybrid  # Creates 10k test tasks
bun run test:hybrid  # Should show ~0.7ms average
```

## Next Steps

- **Add more tasks**: Use `bun src/cli.ts create` or connect to Slack/MS
- **Export workflow**: See [Markdown Export Guide](./markdown-export.md)
- **Custom connectors**: See [Connectors Guide](./connectors.md)
- **Configure options**: See [Configuration Guide](./config.md)
- **Query tasks**: Use `task.queryHybrid` from your AI assistant

## Troubleshooting

### Server won't start

Check your `.env` file paths are correct:

```bash
cat .env | grep PATH
```

### Database locked errors

Stop all running instances:

```bash
pkill -f "bun.*MAGI-Core"
```

### Slack connector fails

1. Verify scopes at https://api.slack.com/apps → Your App → OAuth & Permissions
2. Reinstall app to workspace
3. Check `.env` has correct tokens (xapp-*, xoxb-*)

### Microsoft 365 authentication fails

1. Verify Azure app has "Allow public client flows" enabled
2. Check `MS_CLIENT_ID` is correct
3. Try using `common` as tenant ID

### Performance is slow

1. Check database is using WAL mode:
   ```bash
   sqlite3 data/tasks.db "PRAGMA journal_mode;"
   ```
   Should return `wal`.

2. Run vacuum:
   ```bash
   sqlite3 data/tasks.db "VACUUM;"
   ```

### No results from hybrid search

1. Ensure Qdrant is running:
   ```bash
   docker ps | grep qdrant
   ```

2. Initialize collection:
   ```bash
   cd packages/data
   bun run init-qdrant
   ```

## Getting Help

- Check [Configuration Guide](./config.md)
- Read [Connectors Guide](./connectors.md)
- Review [Markdown Export Guide](./markdown-export.md)
- See [Project Plan](./PROJECT_PLAN.md) for architecture

## Demo in Under 10 Minutes

Complete workflow from zero to working AI integration:

```bash
# 1. Setup (2 min)
git clone <repo> MAGI-Core && cd MAGI-Core
bun install && cp sample.env .env
bun run build

# 2. Test (1 min)
cd packages/server
bun src/cli.ts create "Demo task" --priority=high
bun src/cli.ts list

# 3. Configure AI tool (3 min)
# Add stdio config to your AI tool (see above)

# 4. Use from AI (2 min)
# In your AI assistant:
# "List my tasks"
# "Create a task: Review MAGI-Core docs"
# "Export tasks to markdown"

# 5. Verify (1 min)
cat tasks.md
```

Total: ~9 minutes to working demo.
