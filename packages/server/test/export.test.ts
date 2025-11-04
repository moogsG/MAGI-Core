import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { openDB } from "../src/db/index.js";
import { createTask, exportMarkdown } from "../src/tasks/repo.js";
import { 
  groupTasks, 
  formatTaskMarkdown, 
  formatMarkdownDocument,
  fetchTasksForExport 
} from "../src/tasks/export.js";
import type { DB } from "../src/db/index.js";
import type { TaskWithContext } from "../src/tasks/export.types.js";
import { readFileSync, unlinkSync, existsSync } from "node:fs";

let db: DB;

describe("task export", () => {
  beforeAll(() => {
    process.env.TASKS_DB_PATH = ":memory:";
    db = openDB(process.env.TASKS_DB_PATH);

    // Seed test data with specific dates for consistent snapshots
    const baseDate = new Date("2024-11-01T10:00:00Z");
    
    // Tasks from today
    createTask(db, {
      title: "Implement markdown export",
      body: "Add export functionality with grouping and prompt templates",
      priority: "high",
      due_ts: new Date("2024-11-05T00:00:00Z").toISOString(),
      source: "github"
    });

    createTask(db, {
      title: "Write unit tests",
      body: "Add comprehensive test coverage including snapshots",
      priority: "high",
      source: "local"
    });

    // Tasks from yesterday
    const yesterday = new Date(baseDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    createTask(db, {
      title: "Review pull request",
      body: "Check code quality and test coverage",
      priority: "med",
      source: "github"
    });

    // Update created_ts to yesterday for testing grouping
    db.query(`
      UPDATE tasks 
      SET created_ts = $ts 
      WHERE title = 'Review pull request'
    `).run({ $ts: yesterday.toISOString() });

    // Tasks from last week
    const lastWeek = new Date(baseDate);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    createTask(db, {
      title: "Fix bug in authentication",
      body: "Users unable to login with SSO",
      priority: "high",
      source: "slack"
    });

    db.query(`
      UPDATE tasks 
      SET created_ts = $ts 
      WHERE title = 'Fix bug in authentication'
    `).run({ $ts: lastWeek.toISOString() });

    // Low priority task
    createTask(db, {
      title: "Update documentation",
      body: "Add examples for new API endpoints",
      priority: "low",
      source: "notion"
    });
  });

  describe("fetchTasksForExport", () => {
    it("fetches all tasks without filter", () => {
      const tasks = fetchTasksForExport(db);
      expect(tasks.length).toBeGreaterThanOrEqual(5);
      expect(tasks[0]).toHaveProperty("id");
      expect(tasks[0]).toHaveProperty("title");
      expect(tasks[0]).toHaveProperty("created_ts");
    });

    it("filters by state", () => {
      // Update one task to 'open' state
      const tasks = fetchTasksForExport(db);
      db.query(`UPDATE tasks SET state = 'open' WHERE id = ?`).run(tasks[0].id);

      const openTasks = fetchTasksForExport(db, { state: ["open"] });
      expect(openTasks.length).toBeGreaterThanOrEqual(1);
      expect(openTasks.every(t => t.state === "open")).toBe(true);
    });

    it("filters by priority", () => {
      const highPriorityTasks = fetchTasksForExport(db, { priority: ["high"] });
      expect(highPriorityTasks.length).toBeGreaterThanOrEqual(2);
      expect(highPriorityTasks.every(t => t.priority === "high")).toBe(true);
    });

    it("filters by multiple criteria", () => {
      const filtered = fetchTasksForExport(db, {
        state: ["inbox"],
        priority: ["high", "med"]
      });
      expect(filtered.every(t => 
        t.state === "inbox" && (t.priority === "high" || t.priority === "med")
      )).toBe(true);
    });
  });

  describe("groupTasks", () => {
    it("groups tasks by day", () => {
      const tasks = fetchTasksForExport(db);
      const grouped = groupTasks(tasks, "day");
      
      expect(grouped.length).toBeGreaterThanOrEqual(2);
      expect(grouped[0]).toHaveProperty("groupKey");
      expect(grouped[0]).toHaveProperty("groupLabel");
      expect(grouped[0]).toHaveProperty("tasks");
      expect(Array.isArray(grouped[0].tasks)).toBe(true);
    });

    it("groups tasks by state", () => {
      const tasks = fetchTasksForExport(db);
      const grouped = groupTasks(tasks, "state");
      
      expect(grouped.length).toBeGreaterThanOrEqual(1);
      expect(grouped.some(g => g.groupKey === "inbox")).toBe(true);
    });

    it("groups tasks by priority", () => {
      const tasks = fetchTasksForExport(db);
      const grouped = groupTasks(tasks, "priority");
      
      expect(grouped.length).toBeGreaterThanOrEqual(2);
      expect(grouped.some(g => g.groupKey === "high")).toBe(true);
      expect(grouped.some(g => g.groupKey === "low")).toBe(true);
    });

    it("sorts date groups in descending order (most recent first)", () => {
      const tasks = fetchTasksForExport(db);
      const grouped = groupTasks(tasks, "day");
      
      if (grouped.length >= 2) {
        expect(grouped[0].groupKey >= grouped[1].groupKey).toBe(true);
      }
    });
  });

  describe("formatTaskMarkdown", () => {
    it("formats task with all fields", () => {
      const task: TaskWithContext = {
        id: "t_12345678",
        title: "Test Task",
        state: "open",
        priority: "high",
        due_ts: "2024-11-05T00:00:00Z",
        source: "github",
        created_ts: "2024-11-01T10:00:00Z",
        context: "This is a test task with context"
      };

      const markdown = formatTaskMarkdown(task, false);
      
      expect(markdown).toContain("### Test Task");
      expect(markdown).toContain("**ID:** `t_12345678`");
      expect(markdown).toContain("**State:** 🔄 open");
      expect(markdown).toContain("**Priority:** 🔴 high");
      expect(markdown).toContain("**Due:**");
      expect(markdown).toContain("**Source:** github");
      expect(markdown).toContain("**Created:**");
      expect(markdown).toContain("**Context:**");
      expect(markdown).toContain("This is a test task with context");
      expect(markdown).toContain("---");
    });

    it("formats task with prompts", () => {
      const task: TaskWithContext = {
        id: "t_12345678",
        title: "Test Task",
        state: "inbox",
        priority: "med",
        due_ts: null,
        source: "local",
        created_ts: "2024-11-01T10:00:00Z",
        context: ""
      };

      const markdown = formatTaskMarkdown(task, true);
      
      expect(markdown).toContain("**💡 Suggested Prompts:**");
      expect(markdown).toContain("🔍 Investigate:");
      expect(markdown).toContain("📝 Summarize:");
      expect(markdown).toContain("📋 Plan:");
      expect(markdown).toContain("🧪 Test:");
      expect(markdown).toContain('Find likely root causes and quick diagnostics for "Test Task"');
    });

    it("formats task without optional fields", () => {
      const task: TaskWithContext = {
        id: "t_87654321",
        title: "Minimal Task",
        state: "done",
        priority: "low",
        due_ts: null,
        source: null,
        created_ts: "2024-11-01T10:00:00Z",
        context: ""
      };

      const markdown = formatTaskMarkdown(task, false);
      
      expect(markdown).toContain("### Minimal Task");
      expect(markdown).toContain("**State:** ✅ done");
      expect(markdown).toContain("**Priority:** 🟢 low");
      expect(markdown).toContain("**Source:** local");
      expect(markdown).not.toContain("**Due:**");
      expect(markdown).not.toContain("**Context:**");
    });

    it("matches snapshot for complete task", () => {
      const task: TaskWithContext = {
        id: "t_snapshot",
        title: "Snapshot Test Task",
        state: "open",
        priority: "high",
        due_ts: "2024-12-01T00:00:00Z",
        source: "github",
        created_ts: "2024-11-01T12:00:00Z",
        context: "This task is used for snapshot testing to ensure consistent markdown formatting."
      };

      const markdown = formatTaskMarkdown(task, true);
      expect(markdown).toMatchSnapshot();
    });
  });

  describe("formatMarkdownDocument", () => {
    it("formats complete document with groups", () => {
      const tasks = fetchTasksForExport(db);
      const grouped = groupTasks(tasks, "day");
      const markdown = formatMarkdownDocument(grouped, true);

      expect(markdown).toContain("# Tasks Export");
      expect(markdown).toContain("*Generated:");
      expect(markdown).toContain("##");
      expect(markdown).toContain("task");
      expect(markdown).toContain("---");
    });

    it("includes task count in group headers", () => {
      const tasks = fetchTasksForExport(db);
      const grouped = groupTasks(tasks, "priority");
      const markdown = formatMarkdownDocument(grouped, false);

      expect(markdown).toMatch(/\*\d+ tasks?\*/);
    });

    it("matches snapshot for grouped document", () => {
      const tasks = fetchTasksForExport(db, { priority: ["high"] });
      // Sort by title for deterministic ordering
      const sortedTasks = tasks.slice(0, 2).sort((a, b) => a.title.localeCompare(b.title));
      const grouped = groupTasks(sortedTasks, "priority");
      const markdown = formatMarkdownDocument(grouped, true);

      // Normalize dynamic values for consistent snapshots
      const normalized = markdown
        .replace(/\*Generated:.*?\*/, "*Generated: [TIMESTAMP]*")
        .replace(/\*\*Created:\*\* .*/g, "**Created:** [DATE]")
        .replace(/- \*\*ID:\*\* `t_[a-f0-9]+`/g, "- **ID:** `t_[ID]`")
        .replace(/\*\*State:\*\* [^\n]+/g, "**State:** [STATE]")
        .replace(/\*\d+ tasks?\*/g, "*[N] tasks*");

      expect(normalized).toMatchSnapshot();
    });
  });

  describe("exportMarkdown", () => {
    const testPath = "./test-export.md";

    afterEach(() => {
      if (existsSync(testPath)) {
        unlinkSync(testPath);
      }
    });

    it("exports to file with default options", () => {
      const result = exportMarkdown(db, { path: testPath });

      expect(result.ok).toBe(true);
      expect(result.path).toContain("test-export.md");
      expect(result.taskCount).toBeGreaterThanOrEqual(5);
      expect(result.groupCount).toBeGreaterThanOrEqual(1);
      expect(existsSync(testPath)).toBe(true);

      const content = readFileSync(testPath, "utf-8");
      expect(content).toContain("# Tasks Export");
      expect(content).toContain("**💡 Suggested Prompts:**");
    });

    it("exports with groupBy=state", () => {
      const result = exportMarkdown(db, { 
        path: testPath, 
        groupBy: "state" 
      });

      expect(result.ok).toBe(true);
      const content = readFileSync(testPath, "utf-8");
      expect(content).toContain("## Inbox");
    });

    it("exports with groupBy=priority", () => {
      const result = exportMarkdown(db, { 
        path: testPath, 
        groupBy: "priority" 
      });

      expect(result.ok).toBe(true);
      const content = readFileSync(testPath, "utf-8");
      expect(content).toMatch(/## (High|Med|Low) Priority/);
    });

    it("exports without prompts", () => {
      const result = exportMarkdown(db, { 
        path: testPath, 
        includePrompts: false 
      });

      expect(result.ok).toBe(true);
      const content = readFileSync(testPath, "utf-8");
      expect(content).not.toContain("**💡 Suggested Prompts:**");
    });

    it("exports with state filter", () => {
      // Mark one task as done
      const tasks = fetchTasksForExport(db);
      db.query(`UPDATE tasks SET state = 'done' WHERE id = ?`).run(tasks[0].id);

      const result = exportMarkdown(db, { 
        path: testPath,
        filter: { state: ["done"] }
      });

      expect(result.ok).toBe(true);
      expect(result.taskCount).toBeGreaterThanOrEqual(1);
      
      const content = readFileSync(testPath, "utf-8");
      expect(content).toContain("**State:** ✅ done");
    });

    it("exports with priority filter", () => {
      const result = exportMarkdown(db, { 
        path: testPath,
        filter: { priority: ["high"] }
      });

      expect(result.ok).toBe(true);
      const content = readFileSync(testPath, "utf-8");
      expect(content).toContain("**Priority:** 🔴 high");
    });

    it("uses MARKDOWN_PATH environment variable", () => {
      const envPath = "./env-test-export.md";
      process.env.MARKDOWN_PATH = envPath;

      try {
        exportMarkdown(db);
        expect(existsSync(envPath)).toBe(true);
        unlinkSync(envPath);
      } finally {
        delete process.env.MARKDOWN_PATH;
      }
    });

    it("creates valid markdown structure", () => {
      const result = exportMarkdown(db, { path: testPath });
      const content = readFileSync(testPath, "utf-8");

      // Check document structure
      expect(content).toMatch(/^# Tasks Export/);
      expect(content).toContain("*Generated:");
      expect(content).toMatch(/## .+/); // At least one group header
      expect(content).toMatch(/### .+/); // At least one task header
      expect(content).toContain("**ID:**");
      expect(content).toContain("**State:**");
      expect(content).toContain("**Priority:**");
      expect(content).toContain("---");
    });
  });

  describe("prompt templates", () => {
    it("generates deterministic investigate prompt", () => {
      const task: TaskWithContext = {
        id: "t_test",
        title: "Authentication Bug",
        state: "open",
        priority: "high",
        due_ts: null,
        source: "slack",
        created_ts: "2024-11-01T10:00:00Z",
        context: ""
      };

      const markdown = formatTaskMarkdown(task, true);
      expect(markdown).toContain(
        'Find likely root causes and quick diagnostics for "Authentication Bug"'
      );
    });

    it("generates deterministic summarize prompt", () => {
      const task: TaskWithContext = {
        id: "t_test",
        title: "API Refactoring",
        state: "open",
        priority: "med",
        due_ts: null,
        source: "github",
        created_ts: "2024-11-01T10:00:00Z",
        context: ""
      };

      const markdown = formatTaskMarkdown(task, true);
      expect(markdown).toContain(
        'Summarize prior context and links for "API Refactoring" in 5 bullets'
      );
    });

    it("generates deterministic plan prompt", () => {
      const task: TaskWithContext = {
        id: "t_test",
        title: "Database Migration",
        state: "inbox",
        priority: "high",
        due_ts: null,
        source: "local",
        created_ts: "2024-11-01T10:00:00Z",
        context: ""
      };

      const markdown = formatTaskMarkdown(task, true);
      expect(markdown).toContain(
        'Propose a step-by-step plan to complete "Database Migration"'
      );
    });

    it("generates deterministic test prompt", () => {
      const task: TaskWithContext = {
        id: "t_test",
        title: "Payment Processing",
        state: "open",
        priority: "high",
        due_ts: null,
        source: "github",
        created_ts: "2024-11-01T10:00:00Z",
        context: ""
      };

      const markdown = formatTaskMarkdown(task, true);
      expect(markdown).toContain(
        'List test cases and edge conditions for "Payment Processing"'
      );
    });
  });
});
