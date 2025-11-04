import type { Database } from "bun:sqlite";
import type { JiraIssue } from "./types.js";

function nowISO(): string {
  return new Date().toISOString();
}

function preview(text: string | null | undefined, maxLen = 300): string {
  if (!text) return "";
  return text.slice(0, maxLen).trim();
}

interface JiraIssueRow {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  priority: string | null;
  assignee: string | null;
  assignee_display_name: string | null;
  reporter: string | null;
  reporter_display_name: string | null;
  created: string;
  updated: string;
  due_date: string | null;
  issue_type: string;
  project_key: string;
  project_name: string;
  web_url: string;
  labels: string | null;
  created_ts: string;
}

export interface JiraIssueHandle {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority?: string;
  assignee?: string;
  issue_type: string;
  project_key: string;
  updated: string;
  link: string;
  as_of: string;
  source: string;
  approx_freshness_seconds: number;
}

/**
 * Upsert a Jira issue into the database
 */
export function upsertJiraIssue(db: Database, issue: JiraIssue): void {
  const created_ts = nowISO();
  const labels = issue.labels ? JSON.stringify(issue.labels) : null;

  const existing = db
    .query<JiraIssueRow, [string]>("SELECT * FROM jira_issues WHERE id = ?")
    .get(issue.id);

  if (existing) {
    // Update existing issue
    db.query(`
      UPDATE jira_issues 
      SET key = ?, summary = ?, description = ?, status = ?, priority = ?, 
          assignee = ?, assignee_display_name = ?, reporter = ?, reporter_display_name = ?,
          updated = ?, due_date = ?, issue_type = ?, project_key = ?, project_name = ?,
          web_url = ?, labels = ?
      WHERE id = ?
    `).run(
      issue.key,
      issue.summary,
      preview(issue.description),
      issue.status,
      issue.priority || null,
      issue.assignee || null,
      issue.assignee_display_name || null,
      issue.reporter || null,
      issue.reporter_display_name || null,
      issue.updated,
      issue.due_date || null,
      issue.issue_type,
      issue.project_key,
      issue.project_name,
      issue.web_url,
      labels,
      issue.id
    );
  } else {
    // Insert new issue
    db.query(`
      INSERT INTO jira_issues (
        id, key, summary, description, status, priority, 
        assignee, assignee_display_name, reporter, reporter_display_name,
        created, updated, due_date, issue_type, project_key, project_name,
        web_url, labels, created_ts
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      issue.id,
      issue.key,
      issue.summary,
      preview(issue.description),
      issue.status,
      issue.priority || null,
      issue.assignee || null,
      issue.assignee_display_name || null,
      issue.reporter || null,
      issue.reporter_display_name || null,
      issue.created,
      issue.updated,
      issue.due_date || null,
      issue.issue_type,
      issue.project_key,
      issue.project_name,
      issue.web_url,
      labels,
      created_ts
    );
  }
}

/**
 * Get Jira issues with compact handles
 */
export function getJiraIssues(
  db: Database,
  filters: {
    assignee?: string;
    status?: string[];
    project_keys?: string[];
    limit?: number;
  } = {}
): JiraIssueHandle[] {
  const { assignee, status, project_keys, limit = 50 } = filters;

  let query = `
    SELECT id, key, summary, status, priority, assignee_display_name as assignee,
           issue_type, project_key, updated, web_url, created_ts
    FROM jira_issues
    WHERE 1=1
  `;

  const params: any[] = [];

  if (assignee) {
    query += ` AND assignee = ?`;
    params.push(assignee);
  }

  if (status && status.length > 0) {
    const placeholders = status.map(() => "?").join(",");
    query += ` AND status IN (${placeholders})`;
    params.push(...status);
  }

  if (project_keys && project_keys.length > 0) {
    const placeholders = project_keys.map(() => "?").join(",");
    query += ` AND project_key IN (${placeholders})`;
    params.push(...project_keys);
  }

  query += ` ORDER BY updated DESC LIMIT ?`;
  params.push(limit);

  const rows = db.query<any, any[]>(query).all(...params);

  const asOf = nowISO();

  return rows.map((row) => {
    const createdAt = new Date(row.created_ts);
    const now = new Date(asOf);
    const freshnessSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    return {
      id: row.id,
      key: row.key,
      summary: row.summary,
      status: row.status,
      priority: row.priority || undefined,
      assignee: row.assignee || undefined,
      issue_type: row.issue_type,
      project_key: row.project_key,
      updated: row.updated,
      link: row.web_url,
      as_of: asOf,
      source: "jira",
      approx_freshness_seconds: freshnessSeconds,
    };
  });
}

/**
 * Get a single Jira issue by ID or key
 */
export function getJiraIssue(
  db: Database,
  idOrKey: string
): JiraIssueRow | null {
  const row = db
    .query<JiraIssueRow, [string, string]>(
      "SELECT * FROM jira_issues WHERE id = ? OR key = ?"
    )
    .get(idOrKey, idOrKey);

  return row || null;
}

/**
 * Delete a Jira issue from the database
 */
export function deleteJiraIssue(db: Database, id: string): void {
  db.query("DELETE FROM jira_issues WHERE id = ?").run(id);
}
