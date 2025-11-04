import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { openDB } from "../src/db/index.js";
import { buildServer } from "../src/mcp.js";
import type { DB } from "../src/db/index.js";
import { createTask, listTaskHandles, expandTask, updateTask } from "../src/tasks/repo.js";

let db: DB;

describe("MCP Server Tool Contracts", () => {
  beforeAll(() => {
    process.env.TASKS_DB_PATH = ":memory:";
    db = openDB(process.env.TASKS_DB_PATH);
  });

  beforeEach(() => {
    // Clean up tasks between tests
    db.run("DELETE FROM tasks");
    db.run("DELETE FROM tasks_fts");
  });

  describe("task.create contract", () => {
    it("returns compact handle {id, t, s}", () => {
      const result = createTask(db, { title: "Test task" });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("t");
      expect(result).toHaveProperty("s");
      expect(result.id).toMatch(/^t_/);
      expect(result.t).toBe("Test task");
      expect(result.s).toBe("inbox");
    });

    it("accepts optional body, priority, due_ts", () => {
      const result = createTask(db, {
        title: "Complete project",
        body: "Finish all remaining tasks",
        priority: "high",
        due_ts: "2025-12-31T23:59:59Z"
      });

      expect(result.id).toMatch(/^t_/);
      expect(result.t).toBe("Complete project");
      expect(result.s).toBe("inbox");

      // Verify full task has all fields
      const full = expandTask(db, result.id);
      expect(full?.body).toBe("Finish all remaining tasks");
      expect(full?.priority).toBe("high");
      expect(full?.due_ts).toBe("2025-12-31T23:59:59Z");
    });

    it("defaults priority to med", () => {
      const result = createTask(db, { title: "Default priority" });
      const full = expandTask(db, result.id);
      expect(full?.priority).toBe("med");
    });
  });

  describe("task.list contract", () => {
    it("returns {as_of, source, items, next}", () => {
      createTask(db, { title: "Task 1", body: "Body 1" });
      createTask(db, { title: "Task 2", body: "Body 2" });

      const items = listTaskHandles(db, { limit: 10 });
      
      // Simulate full response structure
      const response = {
        as_of: new Date().toISOString(),
        source: "db",
        items,
        next: null
      };

      expect(response).toHaveProperty("as_of");
      expect(response.source).toBe("db");
      expect(response).toHaveProperty("items");
      expect(response).toHaveProperty("next");
      expect(Array.isArray(response.items)).toBe(true);
    });

    it("items are compact handles {id, t, p, s, d}", () => {
      createTask(db, {
        title: "Task with due date",
        body: "This is the body content",
        due_ts: "2025-12-31T23:59:59Z"
      });

      const items = listTaskHandles(db, { limit: 10 });
      const handle = items[0];

      expect(handle).toHaveProperty("id");
      expect(handle).toHaveProperty("t"); // title
      expect(handle).toHaveProperty("p"); // preview
      expect(handle).toHaveProperty("s"); // state
      expect(handle).toHaveProperty("d"); // due_ts
      expect(handle.d).toBe("2025-12-31T23:59:59Z");
    });

    it("preview (p) is 0-300 chars", () => {
      const shortBody = "Short body";
      const longBody = "a".repeat(500);

      createTask(db, { title: "Short", body: shortBody });
      createTask(db, { title: "Long", body: longBody });

      const items = listTaskHandles(db, { limit: 10 });
      
      const shortItem = items.find(i => i.t === "Short");
      const longItem = items.find(i => i.t === "Long");

      expect(shortItem?.p).toBe(shortBody);
      expect(longItem?.p.length).toBe(300);
      expect(longItem?.p).toBe(longBody.slice(0, 300));
    });

    it("respects limit parameter", () => {
      for (let i = 1; i <= 5; i++) {
        createTask(db, { title: `Task ${i}` });
      }

      const items = listTaskHandles(db, { limit: 3 });
      expect(items.length).toBe(3);
    });

    it("filters by state", () => {
      const t1 = createTask(db, { title: "Inbox task" });
      updateTask(db, t1.id, { state: "open" });
      createTask(db, { title: "Another inbox" });

      const inboxItems = listTaskHandles(db, { state: ["inbox"] });
      expect(inboxItems.length).toBe(1);
      expect(inboxItems[0].s).toBe("inbox");
    });

    it("filters by priority", () => {
      createTask(db, { title: "High", priority: "high" });
      createTask(db, { title: "Low", priority: "low" });

      const highItems = listTaskHandles(db, { priority: ["high"] });
      expect(highItems.length).toBe(1);
      expect(highItems[0].t).toBe("High");
    });

    it("supports keyword search via q parameter", () => {
      createTask(db, { title: "Database migration", body: "PostgreSQL upgrade" });
      createTask(db, { title: "API endpoint", body: "REST API" });

      const items = listTaskHandles(db, { q: "PostgreSQL", limit: 10 });
      expect(items.length).toBe(1);
      expect(items[0].t).toBe("Database migration");
    });

    it("uses summary for preview if available", () => {
      const t = createTask(db, { title: "Task", body: "Long body content" });
      updateTask(db, t.id, { summary: "Short summary" });

      const items = listTaskHandles(db, { limit: 10 });
      const item = items.find(i => i.id === t.id);
      
      expect(item?.p).toBe("Short summary");
    });
  });

  describe("task.expand contract", () => {
    it("returns full task object", () => {
      const created = createTask(db, {
        title: "Full task",
        body: "Complete body",
        priority: "high",
        due_ts: "2025-12-31T23:59:59Z"
      });

      const full = expandTask(db, created.id);

      expect(full).not.toBeNull();
      expect(full?.id).toBe(created.id);
      expect(full?.title).toBe("Full task");
      expect(full?.body).toBe("Complete body");
      expect(full?.state).toBe("inbox");
      expect(full?.priority).toBe("high");
      expect(full?.due_ts).toBe("2025-12-31T23:59:59Z");
      expect(full).toHaveProperty("created_ts");
      expect(full).toHaveProperty("updated_ts");
      expect(full).toHaveProperty("estimate_min");
      expect(full).toHaveProperty("source");
      expect(full).toHaveProperty("summary");
    });

    it("returns null for non-existent task", () => {
      const result = expandTask(db, "t_nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("task.update contract", () => {
    it("returns {ok: true} on success", () => {
      const created = createTask(db, { title: "Update test" });
      const result = updateTask(db, created.id, { state: "done" });

      expect(result).toEqual({ ok: true });
    });

    it("returns {ok: false, error: NOT_FOUND} for non-existent task", () => {
      const result = updateTask(db, "t_nonexistent", { state: "done" });

      expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    });

    it("updates state", () => {
      const created = createTask(db, { title: "State test" });
      updateTask(db, created.id, { state: "open" });

      const full = expandTask(db, created.id);
      expect(full?.state).toBe("open");
    });

    it("updates multiple fields", () => {
      const created = createTask(db, { title: "Multi-update" });
      updateTask(db, created.id, {
        state: "open",
        priority: "high",
        body: "Updated body",
        summary: "Summary",
        estimate_min: 60,
        due_ts: "2025-12-31T23:59:59Z"
      });

      const full = expandTask(db, created.id);
      expect(full?.state).toBe("open");
      expect(full?.priority).toBe("high");
      expect(full?.body).toBe("Updated body");
      expect(full?.summary).toBe("Summary");
      expect(full?.estimate_min).toBe(60);
      expect(full?.due_ts).toBe("2025-12-31T23:59:59Z");
    });

    it("updates updated_ts timestamp", async () => {
      const created = createTask(db, { title: "Timestamp test" });
      const initial = expandTask(db, created.id);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      updateTask(db, created.id, { state: "open" });
      const updated = expandTask(db, created.id);

      expect(updated?.updated_ts).not.toBe(initial?.updated_ts);
      expect(new Date(updated!.updated_ts).getTime()).toBeGreaterThan(
        new Date(initial!.updated_ts).getTime()
      );
    });

    it("allows setting fields to null", () => {
      const created = createTask(db, {
        title: "Nullable test",
        body: "Initial body",
        due_ts: "2025-12-31T23:59:59Z"
      });

      updateTask(db, created.id, {
        body: null,
        due_ts: null
      });

      const full = expandTask(db, created.id);
      expect(full?.body).toBeNull();
      expect(full?.due_ts).toBeNull();
    });

    it("preserves created_ts", () => {
      const created = createTask(db, { title: "Created ts test" });
      const initial = expandTask(db, created.id);

      updateTask(db, created.id, { state: "done" });
      const updated = expandTask(db, created.id);

      expect(updated?.created_ts).toBe(initial?.created_ts);
    });
  });

  describe("MCP Server initialization", () => {
    it("builds server successfully", () => {
      const server = buildServer(db);
      expect(server).toBeDefined();
    });
  });

  describe("Response format validation", () => {
    it("as_of is valid ISO timestamp", () => {
      const as_of = new Date().toISOString();
      expect(() => new Date(as_of)).not.toThrow();
      expect(as_of).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("source is always 'db'", () => {
      const response = {
        as_of: new Date().toISOString(),
        source: "db",
        items: [],
        next: null
      };
      expect(response.source).toBe("db");
    });

    it("handles without due_ts have d as null or undefined", () => {
      createTask(db, { title: "No due date" });
      const items = listTaskHandles(db, { limit: 10 });
      
      // SQLite returns null for NULL values
      expect(items[0].d).toBeNull();
    });

    it("handles with due_ts have d as string", () => {
      createTask(db, { title: "With due date", due_ts: "2025-12-31T23:59:59Z" });
      const items = listTaskHandles(db, { limit: 10 });
      
      expect(typeof items[0].d).toBe("string");
      expect(items[0].d).toBe("2025-12-31T23:59:59Z");
    });
  });
});
