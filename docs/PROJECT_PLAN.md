
# 🧠 MCP Local Tasks — Full Project Plan & Codebase Stubs

**Purpose:** Build an open‑source, local‑first MCP server that helps developers capture, plan, and execute tasks across code, Slack, and Microsoft 365 — fast, private, token‑lean, and extensible via **Connection Helpers**.

This single document includes:
- Project overview and architecture
- Monorepo layout
- **Complete code stubs** for Steps 1–2 (server + tasks + DB) **and** the **extensible connections system**
- A **helper template** for new connectors
- Example `config.json`
- Helper authoring docs
- Runbook & acceptance criteria

---

## 0) Overview

### Stack
- **Language:** TypeScript + Node
- **Runtime:** Model Context Protocol (MCP) server (stdio transport)
- **Storage:** SQLite + FTS5 (operational truth), DuckDB (analytics), Qdrant (vectors, later phase)
- **Extensibility:** Pluggable **Connection Helpers** (Slack, Microsoft 365, GitHub/Jira later)
- **Testing:** Vitest
- **Pkg:** bun workspaces

### Principles
- **Local-first & private** by default.
- **Token-lean**: return compact *handles*; expand on demand.
- **Fast**: sub‑100ms cached lists; hybrid retrieval (later phases).
- **Extensible**: connectors implemented as self-contained *helpers* with a clear contract.

---

## 1) Monorepo Layout

```
packages/
  server/
    src/
      db/
        migrations/
      tasks/
      connections/
      index.ts
      mcp.ts
    test/
      tasks.repo.test.ts
  connectors/
    template/
      src/index.ts
      package.json
      README.md
  cli/            # (placeholder for future)
  bench/          # (placeholder for future)
docs/
config.json       # helper loader config
```

---

## 2) Root Workspace Files

### `package.json` (root)
```json
{
  "name": "mcp-local-tasks",
  "private": true,
  "version": "0.1.0",
  "packageManager": "bun@1.1.34",
  "scripts": {
    "build": "bun run --filter='./packages/*' build",
    "dev": "bun run --filter=@mcp/server dev",
    "test": "bun test",
    "lint": "bun run --filter='./packages/*' lint || true",
    "format": "bun run --filter='./packages/*' format || true"
  },
  "workspaces": [
    "packages/*",
    "packages/connectors/*"
  ],
  "devDependencies": {
    "typescript": "^5.6.3",
    "eslint": "^9.11.1",
    "@eslint/js": "^9.11.1",
    "vitest": "^2.1.3",
    "@types/node": "^22.7.5",
    "tsx": "^4.19.2"
  }
}
```

### `tsconfig.base.json` (root)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "baseUrl": "."
  }
}
```

### `eslint.config.js` (root)
```js
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module" },
    rules: { "no-console": "off" }
  }
];
```

### `config.json` (root) — helper loader configuration
```json
{
  "helpers": [
    {
      "name": "echo",
      "module": "@mcp/connector-template",
      "config": { "greeting": "hi" }
    }
    /* 
    Later, add:
    { "name": "slack", "module": "@mcp/connector-slack", "config": { "allow_channels": ["#dev"] } },
    { "name": "msgraph", "module": "@mcp/connector-ms", "config": { "folders": ["Inbox"], "poll_minutes": 5 } }
    */
  ]
}
```

---

## 3) Server Package (`packages/server`)

### `packages/server/package.json`
```json
{
  "name": "@mcp/server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/src/index.js",
  "types": "dist/src/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "lint": "eslint .",
    "format": "prettier -w . || true"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "better-sqlite3": "^11.5.0",
    "dotenv": "^16.4.5",
    "uuid": "^9.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.9",
    "@types/uuid": "^9.0.7"
  }
}
```

### `packages/server/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

### `packages/server/vitest.config.ts`
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["test/**/*.test.ts"] } });
```

---

### Database Layer

#### `packages/server/src/db/migrations/001_init.sql`
```sql
-- Core domain tables
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT CHECK(state IN ('inbox','open','done')) NOT NULL DEFAULT 'inbox',
  priority TEXT CHECK(priority IN ('low','med','high')) NOT NULL DEFAULT 'med',
  estimate_min INTEGER,
  due_ts TEXT,
  source TEXT,
  summary TEXT,
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  kind TEXT,
  url TEXT,
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  kind TEXT,
  at_ts TEXT NOT NULL,
  payload_json TEXT
);

-- Optional FTS mirror for keyword search within this package
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(title, body, summary);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_tasks_recent ON tasks (created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks (state, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_ts ASC);
```

#### `packages/server/src/db/index.ts`
```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

export function openDB(dbPath = process.env.TASKS_DB_PATH || "tasks.db"): DB {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
}

function runMigrations(db: DB) {
  const dir = path.join(process.cwd(), "packages", "server", "src", "db", "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  db.exec("BEGIN");
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      db.exec(sql);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
```

---

### Tasks Domain

#### `packages/server/src/tasks/types.ts`
```ts
export type TaskState = "inbox" | "open" | "done";
export type TaskPriority = "low" | "med" | "high";

export interface Task {
  id: string;
  title: string;
  body?: string | null;
  state: TaskState;
  priority: TaskPriority;
  estimate_min?: number | null;
  due_ts?: string | null;
  source?: string | null;
  summary?: string | null;
  created_ts: string;
  updated_ts: string;
}

export type TaskHandle = {
  id: string;
  t: string;  // title
  p: string;  // preview (<=300 chars)
  s: TaskState;
  d?: string | null; // due date
};
```

#### `packages/server/src/tasks/repo.ts`
```ts
import { randomUUID } from "crypto";
import type { DB } from "../db/index.js";
import type { Task, TaskHandle, TaskPriority, TaskState } from "./types.js";

function nowISO() { return new Date().toISOString(); }
function preview(s: string | null | undefined, n = 300) { return (s ?? "").slice(0, n); }

export function createTask(db: DB, input: {
  title: string; body?: string | null; priority?: TaskPriority; due_ts?: string | null; source?: string | null;
}): { id: string; t: string; s: TaskState } {
  const id = "t_" + randomUUID().slice(0, 8);
  const ts = nowISO();
  db.prepare(`
    INSERT INTO tasks(id, title, body, state, priority, due_ts, source, created_ts, updated_ts)
    VALUES (@id, @title, @body, 'inbox', @priority, @due_ts, @source, @created_ts, @updated_ts)
  `).run({
    id,
    title: input.title,
    body: input.body ?? null,
    priority: input.priority ?? "med",
    due_ts: input.due_ts ?? null,
    source: input.source ?? "local",
    created_ts: ts,
    updated_ts: ts
  });

  // keep FTS in sync (optional)
  db.prepare(`INSERT INTO tasks_fts(rowid, title, body, summary)
              SELECT rowid, title, body, summary FROM tasks WHERE id = ?`).run(id);

  return { id, t: input.title, s: "inbox" };
}

export function listTaskHandles(db: DB, params: {
  limit?: number; state?: TaskState[]; priority?: TaskPriority[]; q?: string | null;
}): TaskHandle[] {
  const limit = params.limit ?? 20;

  if (params.q && params.q.trim().length > 0) {
    const rows = db.prepare(`
      SELECT t.id, t.title AS t,
             substr(coalesce(t.summary, t.body, ''), 1, 300) AS p,
             t.state AS s, t.due_ts AS d
      FROM tasks t
      JOIN tasks_fts f ON f.rowid = t.rowid
      WHERE tasks_fts MATCH ?
      ORDER BY t.created_ts DESC
      LIMIT ?
    `).all(params.q, limit);
    return rows as TaskHandle[];
  }

  let sql = `
    SELECT id, title AS t, substr(coalesce(summary, body, ''), 1, 300) AS p,
           state AS s, due_ts AS d
    FROM tasks WHERE 1=1
  `;
  const bind: any[] = [];
  if (params.state?.length) {
    sql += ` AND state IN (${params.state.map(() => "?").join(",")})`;
    bind.push(...params.state);
  }
  if (params.priority?.length) {
    sql += ` AND priority IN (${params.priority.map(() => "?").join(",")})`;
    bind.push(...params.priority);
  }
  sql += ` ORDER BY created_ts DESC LIMIT ?`;
  bind.push(limit);

  const rows = db.prepare(sql).all(...bind);
  return rows as TaskHandle[];
}

export function expandTask(db: DB, id: string): Task | null {
  const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as Task | undefined;
  return row ?? null;
}

export function updateTask(db: DB, id: string, patch: Partial<Omit<Task, "id" | "created_ts" | "updated_ts">>) {
  const existing = expandTask(db, id);
  if (!existing) return { ok: false as const, error: "NOT_FOUND" as const };

  const merged = { ...existing, ...patch, updated_ts: nowISO() };

  db.prepare(`
    UPDATE tasks SET
      title=@title, body=@body, state=@state, priority=@priority,
      estimate_min=@estimate_min, due_ts=@due_ts, source=@source,
      summary=@summary, updated_ts=@updated_ts
    WHERE id=@id
  `).run({
    id,
    title: merged.title,
    body: merged.body ?? null,
    state: merged.state,
    priority: merged.priority,
    estimate_min: merged.estimate_min ?? null,
    due_ts: merged.due_ts ?? null,
    source: merged.source ?? "local",
    summary: merged.summary ?? null,
    updated_ts: merged.updated_ts
  });

  // refresh FTS row
  db.prepare(`DELETE FROM tasks_fts WHERE rowid = (SELECT rowid FROM tasks WHERE id = ?)`).run(id);
  db.prepare(`INSERT INTO tasks_fts(rowid, title, body, summary)
              SELECT rowid, title, body, summary FROM tasks WHERE id = ?`).run(id);

  return { ok: true as const };
}
```

---

### MCP Server Wiring

#### `packages/server/src/mcp.ts`
```ts
import { Server, Tool } from "@modelcontextprotocol/sdk/server";
import type { DB } from "./db/index.js";
import { z } from "zod";
import { createTask, expandTask, listTaskHandles, updateTask } from "./tasks/repo.js";

export function buildServer(db: DB) {
  const server = new Server({ name: "mcp-local-tasks", version: "0.1.0" });

  server.tool(new Tool({
    name: "task.create",
    description: "Create a local task",
    inputSchema: z.object({
      title: z.string(),
      body: z.string().optional(),
      priority: z.enum(["low","med","high"]).optional(),
      due_ts: z.string().optional(),
      source: z.string().optional()
    }).strict(),
    async invoke(input) { return createTask(db, input); }
  }));

  server.tool(new Tool({
    name: "task.list",
    description: "List tasks as compact handles",
    inputSchema: z.object({
      filter: z.object({
        state: z.array(z.enum(["inbox","open","done"])).optional(),
        priority: z.array(z.enum(["low","med","high"])).optional(),
        q: z.string().optional()
      }).optional(),
      limit: z.number().int().min(1).max(100).optional()
    }).strict(),
    async invoke({ filter, limit }) {
      const items = listTaskHandles(db, {
        limit: limit ?? 20,
        state: filter?.state,
        priority: filter?.priority,
        q: filter?.q ?? null
      });
      return { as_of: new Date().toISOString(), source: "db", items, next: null };
    }
  }));

  server.tool(new Tool({
    name: "task.expand",
    description: "Return full task",
    inputSchema: z.object({ id: z.string() }).strict(),
    async invoke({ id }) { return expandTask(db, id) ?? { error: "NOT_FOUND" }; }
  }));

  server.tool(new Tool({
    name: "task.update",
    description: "Patch fields on a task",
    inputSchema: z.object({
      id: z.string(),
      patch: z.object({
        title: z.string().optional(),
        body: z.string().nullable().optional(),
        state: z.enum(["inbox","open","done"]).optional(),
        priority: z.enum(["low","med","high"]).optional(),
        estimate_min: z.number().int().nullable().optional(),
        due_ts: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
        summary: z.string().nullable().optional()
      }).strict()
    }).strict(),
    async invoke({ id, patch }) { return updateTask(db, id, patch); }
  }));

  return server;
}
```

#### `packages/server/src/index.ts`
```ts
import "dotenv/config";
import { openDB } from "./db/index.js";
import { buildServer } from "./mcp.js";
import { HelperRegistry } from "./connections/registry.js";
import { loadHelpersFromConfig } from "./connections/loader.js";

const db = openDB(process.env.TASKS_DB_PATH);
const logger = { info: console.log, warn: console.warn, error: console.error };

// Load config.json if present
let config: any = {};
try {
  const mod = await import(process.cwd() + "/config.json", { with: { type: "json" } });
  config = mod.default ?? {};
} catch { /* optional */ }

const registry = new HelperRegistry();
await loadHelpersFromConfig(registry, config, logger as any);

const server = buildServer(db);

// Register helper-provided tools
for (const helper of registry.list()) {
  for (const t of helper.tools()) {
    server.tool(t);
    logger.info(`Tool registered`, { helper: helper.name, tool: t.name });
  }
}

// Init + start helpers
await registry.initAll((name) => ({
  db,
  logger,
  config: (config?.helpers ?? []).find((h: any) => h.name === name)?.config ?? {},
  emit: (event: string, payload?: unknown) => logger.info(`event:${name}:${event}`, { payload })
}));

server.startStdio();
logger.info("[mcp-local-tasks] stdio server started");
```

---

### Unit Tests

#### `packages/server/test/tasks.repo.test.ts`
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { openDB } from "../src/db/index.js";
import { createTask, expandTask, listTaskHandles, updateTask } from "../src/tasks/repo.js";

let db: ReturnType<typeof openDB>;

describe("tasks repo", () => {
  beforeAll(() => {
    process.env.TASKS_DB_PATH = ":memory:";
    db = openDB(process.env.TASKS_DB_PATH);
  });

  it("creates and lists tasks", () => {
    const t = createTask(db, { title: "Write MCP README", body: "Outline features", priority: "high" as any });
    expect(t.id).toMatch(/^t_/);
    const items = listTaskHandles(db, { limit: 10 });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty("t");
    expect(items[0]).toHaveProperty("p");
  });

  it("expands a task", () => {
    const t = createTask(db, { title: "Fix flaky tests", body: "CI fails sometimes", priority: "med" as any });
    const full = expandTask(db, t.id);
    expect(full?.title).toBe("Fix flaky tests");
  });

  it("updates a task", () => {
    const t = createTask(db, { title: "Investigate invoice mismatch", body: "Pax8 delta" });
    const res = updateTask(db, t.id, { state: "open" as any, priority: "high" as any, summary: "Mismatch reproduced" });
    expect(res.ok).toBe(true);
    const full = expandTask(db, t.id);
    expect(full?.state).toBe("open");
    expect(full?.priority).toBe("high");
    expect(full?.summary).toContain("reproduced");
  });

  it("keyword search via FTS", () => {
    createTask(db, { title: "Azure billing mismatch", body: "recon steps", priority: "med" as any });
    const items = listTaskHandles(db, { q: "billing", limit: 5 });
    expect(items.length).toBeGreaterThan(0);
  });
});
```

---

## 6) Extensible Connections System

> **Goal:** make Slack/Microsoft/etc. “connections” first‑class modules (helpers) that can be added/removed via config.

### Files
```
packages/server/src/connections/
  types.ts
  base.ts
  registry.ts
  loader.ts
```

#### `packages/server/src/connections/types.ts`
```ts
import type { DB } from "../db/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/server";

export interface ConnectionHelper {
  name: string;
  version: string;
  init(ctx: HelperContext): Promise<void> | void;
  tools(): Tool[];
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}

export interface HelperContext {
  db: DB;
  logger: HelperLogger;
  config: Record<string, any>;
  emit?(event: string, payload?: unknown): void;
}

export interface HelperLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string | Error, meta?: Record<string, unknown>): void;
}
```

#### `packages/server/src/connections/base.ts`
```ts
import type { ConnectionHelper, HelperContext } from "./types.js";

export abstract class BaseHelper implements ConnectionHelper {
  abstract name: string;
  abstract version: string;
  protected ctx!: HelperContext;
  init(ctx: HelperContext) { this.ctx = ctx; }
  tools() { return []; }
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
}
```

#### `packages/server/src/connections/registry.ts`
```ts
import type { ConnectionHelper, HelperContext } from "./types.js";

export class HelperRegistry {
  private helpers: Map<string, ConnectionHelper> = new Map();

  register(helper: ConnectionHelper) {
    if (this.helpers.has(helper.name)) throw new Error(`Helper already registered: ${helper.name}`);
    this.helpers.set(helper.name, helper);
  }

  list() { return Array.from(this.helpers.values()); }

  async initAll(ctxFactory: (name: string) => HelperContext) {
    for (const h of this.helpers.values()) {
      h.init(ctxFactory(h.name));
      if (h.start) await h.start();
    }
  }
}
```

#### `packages/server/src/connections/loader.ts`
```ts
import path from "node:path";
import type { HelperLogger } from "./types.js";
import { HelperRegistry } from "./registry.js";

export async function loadHelpersFromConfig(registry: HelperRegistry, config: any, logger: HelperLogger) {
  const entries = (config?.helpers ?? []) as Array<{name:string; module:string; config?:any}>;
  for (const entry of entries) {
    const modPath = entry.module.startsWith(".") ? path.resolve(entry.module) : entry.module;
    const mod = await import(modPath);
    const helper = mod.default || mod.helper;
    if (!helper || !helper.name) throw new Error(`Invalid helper module: ${entry.module}`);
    registry.register(helper);
    logger.info(`Registered helper`, { name: helper.name, module: entry.module });
  }
}
```

---

## 7) Helper Template (for new connectors)

```
packages/connectors/template/
  package.json
  src/index.ts
  README.md
```

### `packages/connectors/template/package.json`
```json
{
  "name": "@mcp/connector-template",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/src/index.js",
  "types": "dist/src/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts"
  },
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### `packages/connectors/template/src/index.ts`
```ts
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/server";
import { BaseHelper } from "@mcp/server/src/connections/base.js";
import type { HelperContext } from "@mcp/server/src/connections/types.js";

/** Minimal example helper ("echo") */
class EchoHelper extends BaseHelper {
  name = "echo";
  version = "0.1.0";

  init(ctx: HelperContext) {
    super.init(ctx);
    ctx.logger.info("echo.init", { config: ctx.config });
  }

  tools(): Tool[] {
    return [
      new Tool({
        name: "echo.say",
        description: "Echo a short message",
        inputSchema: z.object({ text: z.string().max(200) }).strict(),
        async invoke({ text }) {
          return { as_of: new Date().toISOString(), message: text };
        }
      })
    ];
  }

  async start() {
    this.ctx.logger.info("echo.start");
  }
}

export default new EchoHelper();
```

### `packages/connectors/template/README.md`
```md
# Connector Helper Template

This package shows how to add a new **Connection Helper** to the local MCP.

## Implement the interface
Export a default object that implements the `ConnectionHelper` contract:
- `name`, `version`
- `init(ctx)` — receive DB, logger, and helper-specific `config`
- `tools()` — return MCP `Tool[]` (actions). Keep responses token-lean.
- `start()/stop()` — optional background lifecycle.

## Config
Add your helper to the project `config.json`:
```json
{
  "helpers": [
    { "name": "echo", "module": "@mcp/connector-template", "config": { "greeting": "hi" } }
  ]
}
```

## Tips
- Use *handles-first* payloads; add `expand` tools for large bodies.
- Include `as_of`, `source`, and `approx_freshness_seconds` when relevant.
- Redact secrets; enforce allowlists/denylists.

## Testing
- Unit test your tools.
- Seed scripts if you create tables.
- Aim for p95 < 200 ms for list operations on local data.
```

---

## 8) Helper Authoring Doc

Create `docs/helpers.md`:
```md
# Writing a Connection Helper

Connection Helpers extend mcp-local-tasks with new tools and (optionally) background jobs.

## Steps
1. Implement and export a default `ConnectionHelper` from your package.
2. Add it to `config.json` under `"helpers"`.
3. The server will load, init, and (optionally) start your helper, then register its tools.

## Design Rules
- Token-lean responses; return compact handles and add expansion tools.
- Honor privacy (redact secrets) and allowlists.
- Add `as_of` timestamps and `source` labels to list results.
- Handle rate limits and retries internally if you call external APIs.

## Versioning
- Keep `name` stable; bump `version` semver on changes.
- Document scopes and required env vars in the helper README.
```

---

## 9) Runbook

### Install & build
```bash
bun i
bun -w -r build
bun -w -r test   # optional; runs unit tests
```

### Run server
```bash
bun dev   # starts stdio MCP server
```

### Configure helpers
Edit `config.json` and add helper entries. The included `echo` template will register `echo.say`.

---

## 10) Acceptance Criteria

- `task.create`, `task.list`, `task.expand`, `task.update` work; unit tests pass.
- Helper loader registers tools from config; echo helper tool callable.
- `task.list` p95 < 200 ms on 5k seeded tasks (local).
- Token-lean responses (handles with previews).

---

## 11) Next Steps (beyond this doc)

- **Step 3:** Markdown exporter + prompt suggestions (append to `tasks.md`).  
- **Connectors:** Implement Slack + Microsoft helpers (Socket Mode, Device Code).  
- **Retrieval:** DuckDB + Qdrant hybrid search.  
- **Planner:** `task.plan_day` with calendar awareness.  
- **CLI/TUI:** `mcp-tasks` for local usage without an MCP client.

---

**End of Document** — You’re ready to scaffold the repo and start building.
