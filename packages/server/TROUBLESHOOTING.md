# MCP Server Troubleshooting Guide

## Common Issues

### 1. "Connection Closed" Error

#### Symptoms
- MCP client shows "connection closed" error
- Server doesn't respond to requests
- Validation errors about missing `protocolVersion`, `capabilities`, or `clientInfo`

#### Root Causes

**A. Server not staying alive (FIXED)**
- **Problem**: Server connects to stdio but process doesn't stay alive
- **Solution**: Added `await new Promise(() => {})` to keep process running
- **Location**: `packages/server/src/mcp.ts:181`

**B. Helper initialization interference (FIXED)**
- **Problem**: Slack helper creating background timers that interfere with stdio
- **Solution**: Removed helper loading from MCP server, created separate `slack-daemon.ts`
- **Location**: `packages/server/src/index.ts`

**C. Client sending invalid initialize request**
- **Problem**: MCP client not sending required params
- **Error**: `"invalid_type", "expected": "string", "received": "undefined"`
- **Solution**: Ensure client config is correct (see Configuration section below)

### 2. Initialize Validation Error

#### Error Message
```json
{
  "error": {
    "code": -32603,
    "message": "invalid_type, expected: string, received: undefined, path: [params, protocolVersion]"
  }
}
```

#### Cause
The MCP client is sending an `initialize` request with empty or missing params. The SDK requires:
- `params.protocolVersion` (string)
- `params.capabilities` (object)
- `params.clientInfo` (object with name/version)

#### Solution
1. Verify your client configuration is correct
2. Ensure you're using an up-to-date MCP client
3. Restart the client application to reload config

### 3. Server Not Responding

#### Symptoms
- Server starts but doesn't respond to requests
- Requests timeout
- No error messages

#### Debug Steps

**Step 1: Test server manually**
```bash
cd /Users/morgan.greff/workspace/MAGI-Core/packages/server
./test-mcp-connection.sh
```

**Step 2: Test with manual JSON-RPC**
```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | bun src/index.ts
```

Expected response:
```json
{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"mcp-local-tasks","version":"0.1.0"}},"jsonrpc":"2.0","id":1}
```

**Step 3: Check database**
```bash
# Verify database is accessible
sqlite3 /Users/morgan.greff/workspace/MAGI-Core/tasks.db ".tables"
```

**Step 4: Check permissions**
```bash
# Verify Bun is installed and accessible
which bun
bun --version

# Verify file permissions
ls -la /Users/morgan.greff/workspace/MAGI-Core/packages/server/src/index.ts
```

### 4. Database Locked

#### Symptoms
- "database is locked" error
- Tasks not saving

#### Solution
1. Ensure only one process is accessing the database
2. Check for zombie processes:
   ```bash
   ps aux | grep "packages/server/src/index.ts"
   ```
3. Kill any stuck processes:
   ```bash
   pkill -f "packages/server/src/index.ts"
   ```

### 5. Slack Integration Issues

#### Problem
Slack features not working after the fix

#### Solution
The Slack integration has been moved to a separate daemon:

```bash
# Run MCP server (for Claude Desktop)
bun packages/server/src/index.ts

# Run Slack daemon (separate terminal)
bun packages/server/src/slack-daemon.ts
```

Both processes can share the same database (thanks to WAL mode).

## Configuration

### Claude Desktop

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Correct configuration:**
```json
{
  "mcpServers": {
    "mcp-local-tasks": {
      "command": "bun",
      "args": [
        "run",
        "/Users/morgan.greff/workspace/MAGI-Core/packages/server/src/index.ts"
      ],
      "env": {
        "TASKS_DB_PATH": "/Users/morgan.greff/workspace/MAGI-Core/tasks.db"
      }
    }
  }
}
```

**After updating config:**
1. Save the file
2. **Restart Claude Desktop** (Cmd+Q then reopen)
3. Check Settings → Developer → MCP Servers
4. Verify "mcp-local-tasks" shows as connected

### Other MCP Clients

**Cline (VS Code Extension):**
```json
{
  "mcpServers": {
    "tasks": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/packages/server/src/index.ts"],
      "env": {
        "TASKS_DB_PATH": "/absolute/path/to/tasks.db"
      }
    }
  }
}
```

**Important:**
- Use absolute paths, not relative paths
- Ensure Bun is in the system PATH
- Restart the client after config changes

## Testing

### Quick Test
```bash
cd /Users/morgan.greff/workspace/MAGI-Core/packages/server
./test-mcp-connection.sh
```

### Manual Test
```bash
# Test initialize
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | \
  bun src/index.ts

# Test tools list
printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}\n{"jsonrpc":"2.0","method":"tools/list","id":2}\n' | \
  bun src/index.ts

# Test task creation
printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"task.create","arguments":{"title":"Test task"}},"id":2}\n' | \
  bun src/index.ts
```

### Run Unit Tests
```bash
cd /Users/morgan.greff/workspace/MAGI-Core/packages/server
bun test
```

## Logs

### Server Logs
The server writes to stderr:
```
[mcp-local-tasks] stdio server started
[mcp-local-tasks] SIGTERM received, shutting down...
```

### Claude Desktop Logs
Claude Desktop doesn't expose MCP server logs directly, but you can test the server independently using the test script.

### Debugging Mode
To see more detailed output, run the server directly:
```bash
bun /Users/morgan.greff/workspace/MAGI-Core/packages/server/src/index.ts
```

Then send requests via another terminal or test manually.

## Getting Help

If you're still experiencing issues:

1. **Run the test script**: `./test-mcp-connection.sh`
2. **Check server responds**: Test with manual JSON-RPC (see Testing section)
3. **Verify config**: Double-check Claude Desktop config is correct
4. **Restart client**: Quit and restart Claude Desktop
5. **Check processes**: Ensure no zombie processes are running

## Architecture Reference

### Current Architecture (Post-Fix)

```
MCP Server (index.ts)
├── Opens database
├── Registers signal handlers (SIGINT, SIGTERM)
├── Registers error handlers
└── Starts MCP server
    ├── Connects to stdio transport
    └── Keeps alive indefinitely

Slack Daemon (slack-daemon.ts) - Optional
├── Opens database
├── Loads config.json
├── Initializes helpers
    ├── Slack Bolt app
    ├── Permalink queue
    └── Message sweeper
└── Keeps alive indefinitely
```

Both processes can run simultaneously, sharing the same SQLite database via WAL mode.

### What Changed (Fix Summary)

1. **Removed** helper initialization from MCP server entry point
2. **Added** keep-alive mechanism to `startServer()`
3. **Created** separate `slack-daemon.ts` for Slack integration
4. **Added** graceful shutdown handlers
5. **Added** error handlers for uncaught exceptions

See `docs/MCP_CONNECTION_FIX.md` for detailed fix documentation.
