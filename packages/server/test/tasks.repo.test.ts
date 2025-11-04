import { describe, it, expect, beforeAll } from "vitest";
import { openDB } from "../src/db/index.js";
import { createTask, expandTask, listTaskHandles, updateTask } from "../src/tasks/repo.js";
import type { DB } from "../src/db/index.js";

let db: DB;

describe("tasks repo", () => {
  beforeAll(() => {
    process.env.TASKS_DB_PATH = ":memory:";
    db = openDB(process.env.TASKS_DB_PATH);
  });

  it("creates and lists tasks", () => {
    const t = createTask(db, { 
      title: "Write MCP README", 
      body: "Outline features", 
      priority: "high" 
    });
    expect(t.id).toMatch(/^t_/);
    
    const items = listTaskHandles(db, { limit: 10 });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty("t");
    expect(items[0]).toHaveProperty("p");
  });

  it("expands a task", () => {
    const t = createTask(db, { 
      title: "Fix flaky tests", 
      body: "CI fails sometimes", 
      priority: "med" 
    });
    const full = expandTask(db, t.id);
    expect(full?.title).toBe("Fix flaky tests");
  });

  it("updates a task", () => {
    const t = createTask(db, { 
      title: "Investigate invoice mismatch", 
      body: "Pax8 delta" 
    });
    const res = updateTask(db, t.id, { 
      state: "open", 
      priority: "high", 
      summary: "Mismatch reproduced" 
    });
    expect(res.ok).toBe(true);
    
    const full = expandTask(db, t.id);
    expect(full?.state).toBe("open");
    expect(full?.priority).toBe("high");
    expect(full?.summary).toContain("reproduced");
  });

  it("keyword search via FTS", () => {
    createTask(db, { 
      title: "Azure billing mismatch", 
      body: "recon steps", 
      priority: "med" 
    });
    const items = listTaskHandles(db, { q: "billing", limit: 5 });
    expect(items.length).toBeGreaterThan(0);
  });
});
