import { randomUUID } from "crypto";
import type { DB } from "../db/index.js";
import type { Task, TaskHandle, TaskPriority, TaskState } from "./types.js";

function nowISO() { return new Date().toISOString(); }

export function createTask(db: DB, input: {
  title: string; body?: string | null; priority?: TaskPriority; due_ts?: string | null; source?: string | null;
}): { id: string; t: string; s: TaskState } {
  const id = "t_" + randomUUID().slice(0, 8);
  const ts = nowISO();
  db.query(`
    INSERT INTO tasks(id, title, body, state, priority, due_ts, source, created_ts, updated_ts)
    VALUES ($id, $title, $body, 'inbox', $priority, $due_ts, $source, $created_ts, $updated_ts)
  `).run({
    $id: id,
    $title: input.title,
    $body: input.body ?? null,
    $priority: input.priority ?? "med",
    $due_ts: input.due_ts ?? null,
    $source: input.source ?? "local",
    $created_ts: ts,
    $updated_ts: ts
  });

  // FTS is kept in sync automatically via triggers

  return { id, t: input.title, s: "inbox" };
}

export function listTaskHandles(db: DB, params: {
  limit?: number; state?: TaskState[]; priority?: TaskPriority[]; q?: string | null;
}): TaskHandle[] {
  const limit = params.limit ?? 20;

  if (params.q && params.q.trim().length > 0) {
    const rows = db.query(`
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

  const rows = db.query(sql).all(...bind);
  return rows as TaskHandle[];
}

export function expandTask(db: DB, id: string): Task | null {
  const row = db.query(`SELECT * FROM tasks WHERE id = ?`).get(id) as Task | undefined;
  return row ?? null;
}

export function updateTask(db: DB, id: string, patch: Partial<Omit<Task, "id" | "created_ts" | "updated_ts">>) {
  const existing = expandTask(db, id);
  if (!existing) return { ok: false as const, error: "NOT_FOUND" as const };

  const merged = { ...existing, ...patch, updated_ts: nowISO() };

  db.query(`
    UPDATE tasks SET
      title=$title, body=$body, state=$state, priority=$priority,
      estimate_min=$estimate_min, due_ts=$due_ts, source=$source,
      summary=$summary, updated_ts=$updated_ts
    WHERE id=$id
  `).run({
    $id: id,
    $title: merged.title,
    $body: merged.body ?? null,
    $state: merged.state,
    $priority: merged.priority,
    $estimate_min: merged.estimate_min ?? null,
    $due_ts: merged.due_ts ?? null,
    $source: merged.source ?? "local",
    $summary: merged.summary ?? null,
    $updated_ts: merged.updated_ts
  });

  // FTS is refreshed automatically via triggers

  return { ok: true as const };
}
