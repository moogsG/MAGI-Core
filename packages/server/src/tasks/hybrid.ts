/**
 * Hybrid search integration for tasks
 * Combines keyword (FTS5) + semantic (Qdrant) search with weighted ranking
 */

import type { DB } from "../db/index.js";
import type { TaskHandle } from "./types.js";

export interface HybridSearchFilters {
  state?: string[];
  priority?: string[];
}

export interface HybridSearchWeights {
  semantic?: number;
  recency?: number;
  priority?: number;
}

/**
 * Perform hybrid search on tasks
 * Note: Requires Qdrant to be running and initialized
 */
export async function queryHybrid(
  db: DB,
  query: string,
  k = 10,
  filters?: HybridSearchFilters
): Promise<TaskHandle[]> {
  const startTime = performance.now();

  // For now, use FTS5 keyword search as fallback
  // TODO: Integrate with @mcp/data package when Qdrant is available
  const keywordResults = await keywordSearch(db, query, k, filters);

  const totalTime = performance.now() - startTime;
  console.log(`Hybrid search (FTS5 only): ${keywordResults.length} results in ${totalTime.toFixed(2)}ms`);

  return keywordResults;
}

/**
 * Keyword search using SQLite FTS5
 */
async function keywordSearch(
  db: DB,
  query: string,
  limit: number,
  filters?: HybridSearchFilters
): Promise<TaskHandle[]> {
  let sql = `
    SELECT t.id, t.title AS t,
           substr(coalesce(t.summary, t.body, ''), 1, 300) AS p,
           t.state AS s, t.due_ts AS d
    FROM tasks t
    JOIN tasks_fts f ON f.rowid = t.rowid
    WHERE tasks_fts MATCH ?
  `;

  const params: any[] = [query];

  if (filters?.state?.length) {
    sql += ` AND t.state IN (${filters.state.map(() => "?").join(",")})`;
    params.push(...filters.state);
  }

  if (filters?.priority?.length) {
    sql += ` AND t.priority IN (${filters.priority.map(() => "?").join(",")})`;
    params.push(...filters.priority);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  const rows = db.query(sql).all(...params) as TaskHandle[];
  return rows;
}
