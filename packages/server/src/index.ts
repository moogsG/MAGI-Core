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
