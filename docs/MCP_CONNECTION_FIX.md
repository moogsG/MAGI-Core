# MCP Server "Connection Closed" Fix

## Problem Summary

The MCP server was experiencing "connection closed" errors when MCP clients tried to connect. Testing with stdin/stdout showed the server would hang and timeout after 60 seconds without responding to requests.

## Root Causes

### 1. Process Lifecycle Issue (CRITICAL)
**Location**: `packages/server/src/mcp.ts:173-178`

The `startServer()` function would call `server.connect(transport)` and immediately return, with nothing keeping the process alive to handle incoming MCP requests.

```typescript
// BEFORE
export async function startServer(db: DB) {
  const server = buildServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-local-tasks] stdio server started");
  // Function returns here, process may exit or become unresponsive
}
```

### 2. Helper Initialization Interference (HIGH)
**Location**: `packages/server/src/index.ts:29-38`

The MCP server entry point was loading and initializing helper modules (Slack connector) that created background timers and async operations. These interfered with the stdio transport communication.

```typescript
// BEFORE - Loading helpers in MCP server
const registry = new HelperRegistry();
await loadHelpersFromConfig(registry, config, logger);
await registry.initAll(...);
await startServer(db);
```

The Slack helper's `start()` method would:
- Start Slack Bolt app (Socket Mode connection)
- Start permalink hydration queue (setInterval every 30s)
- Start message sweeper (setInterval every 10 minutes)

These background operations kept the event loop busy but prevented proper MCP stdio handling.

### 3. Missing Error Handlers (MEDIUM)
No graceful shutdown or error handling, leading to potential database corruption and unclear error messages.

## Solutions Implemented

### Fix #1: Process Keep-Alive
**File**: `packages/server/src/mcp.ts`

Added an infinite promise to keep the process alive after connecting to stdio transport:

```typescript
export async function startServer(db: DB) {
  const server = buildServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-local-tasks] stdio server started");
  
  // Keep process alive - the transport handles all stdio communication
  // This promise never resolves, keeping the event loop active
  await new Promise(() => {});
}
```

### Fix #2: Simplified MCP Server Entry Point
**File**: `packages/server/src/index.ts`

Removed all helper initialization from the MCP server entry point:

```typescript
// AFTER - Clean MCP server
import { openDB } from "./db/index.js";
import { startServer } from "./mcp.js";

const db = openDB(process.env.TASKS_DB_PATH);

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.error("[mcp-local-tasks] SIGINT received, shutting down...");
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error("[mcp-local-tasks] SIGTERM received, shutting down...");
  db.close();
  process.exit(0);
});

// Error handlers
process.on('uncaughtException', (error) => {
  console.error(`[mcp-local-tasks] Uncaught exception: ${error}`);
  db.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[mcp-local-tasks] Unhandled rejection: ${reason}`);
  db.close();
  process.exit(1);
});

// Start MCP server
await startServer(db);
```

### Fix #3: Separate Slack Daemon
**File**: `packages/server/src/slack-daemon.ts` (NEW)

Created a separate entry point for Slack integration that can run independently:

```typescript
import { openDB } from "./db/index.js";
import { HelperRegistry } from "./connections/registry.js";
import { loadHelpersFromConfig } from "./connections/loader.js";
// ... full helper initialization with error handlers
await registry.initAll(...);
logger.info("Slack daemon started - press Ctrl+C to stop");
await new Promise(() => {});
```

### Fix #4: Updated Package Scripts
**File**: `packages/server/package.json`

Added script for running Slack daemon:

```json
{
  "scripts": {
    "dev": "bun src/index.ts",
    "slack": "bun src/slack-daemon.ts"
  }
}
```

## Testing Results

### Before Fix
```bash
$ echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | bun src/index.ts
[INFO] permalink-queue.hydrated {...}  # Helper logs interfering
# Hangs for 60+ seconds, times out, no response
```

### After Fix
```bash
$ echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | bun src/index.ts
[mcp-local-tasks] stdio server started
{"result":{"tools":[...]},"jsonrpc":"2.0","id":1}
# Responds immediately with tools list
```

### Task Creation Test
```bash
$ echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"task.create","arguments":{"title":"Test task"}},"id":2}' | bun src/index.ts
[mcp-local-tasks] stdio server started
{"result":{"content":[{"type":"text","text":"{\n  \"id\": \"t_a76af31e\",\n  \"t\": \"Test task\",\n  \"s\": \"inbox\"\n}"}]},"jsonrpc":"2.0","id":2}
```

✅ **All tests pass successfully**

## Usage

### Running MCP Server (for MCP clients)
```bash
bun packages/server/src/index.ts
# or
cd packages/server && bun run dev
```

### Running Slack Integration (optional, separate process)
```bash
cd packages/server && bun run slack
```

### MCP Client Configuration
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

## Architecture Changes

### Before
```
index.ts (Single Entry Point)
├── Load Config
├── Initialize Helpers (Slack, etc.)
│   ├── Start Slack Bolt (Socket Mode)
│   ├── Start Permalink Queue (setInterval 30s)
│   └── Start Message Sweeper (setInterval 10min)
└── Start MCP Server (stdio)
    └── Returns immediately (BUG)
```

**Problem**: Background timers interfered with stdio, process lifecycle unclear

### After
```
index.ts (MCP Server)              slack-daemon.ts (Optional)
├── Open Database                  ├── Open Database
├── Add Signal Handlers            ├── Add Signal Handlers
├── Add Error Handlers             ├── Load Config
└── Start MCP Server (stdio)       ├── Initialize Helpers
    └── Keep alive forever         │   ├── Start Slack Bolt
                                   │   ├── Start Permalink Queue
                                   │   └── Start Message Sweeper
                                   └── Keep alive forever
```

**Benefits**: 
- Clean separation of concerns
- No stdio interference
- Both processes can run independently
- Clear lifecycle management

## Files Modified

1. ✏️ `packages/server/src/index.ts` - Simplified, removed helper loading, added signal handlers
2. ✏️ `packages/server/src/mcp.ts` - Added keep-alive mechanism
3. ➕ `packages/server/src/slack-daemon.ts` - NEW file for Slack integration
4. ✏️ `packages/server/package.json` - Added `"slack"` script
5. ✏️ `packages/server/README.md` - Updated documentation
6. 💾 `packages/server/src/index.ts.backup` - Backup of original file

## Verification

The fix resolves the "connection closed" error by:

1. ✅ Keeping the MCP server process alive indefinitely
2. ✅ Removing stdio interference from background services
3. ✅ Providing clean process lifecycle management
4. ✅ Enabling proper graceful shutdown
5. ✅ Separating concerns (MCP vs Slack integration)

## Future Considerations

- Consider adding health check endpoint
- Add metrics for MCP request latency
- Implement connection pooling for database if needed
- Add structured logging with levels
