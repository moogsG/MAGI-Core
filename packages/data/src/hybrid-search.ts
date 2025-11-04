import type { QdrantClient } from "@qdrant/qdrant-js";
import { Database } from "bun:sqlite";
import { StubEmbedder } from "./embedder.js";

// Local type definition to avoid cross-package imports
export type TaskHandle = {
  id: string;
  t: string;
  p: string;
  s: string;
  d?: string | null;
};

export interface HybridSearchOptions {
  query: string;
  k?: number;
  filters?: {
    state?: string[];
    priority?: string[];
  };
  weights?: {
    semantic?: number;
    recency?: number;
    priority?: number;
  };
}

export interface ScoredTask {
  id: string;
  score: number;
  semanticScore?: number;
  recencyScore?: number;
  priorityScore?: number;
}

/**
 * Perform hybrid search combining keyword (FTS5) and semantic (Qdrant) search
 */
export async function queryHybrid(
  db: Database,
  qdrantClient: QdrantClient,
  collectionName: string,
  options: HybridSearchOptions
): Promise<TaskHandle[]> {
  const {
    query,
    k = 10,
    filters,
    weights = {
      semantic: 0.6,
      recency: 0.3,
      priority: 0.1
    }
  } = options;

  const startTime = performance.now();

  // Step 1: Keyword search via FTS5
  const keywordResults = await keywordSearch(db, query, k * 3, filters); // Get more for merging
  console.log(`Keyword search: ${keywordResults.length} results in ${(performance.now() - startTime).toFixed(2)}ms`);

  // Step 2: Semantic search via Qdrant
  const semanticStart = performance.now();
  const semanticResults = await semanticSearch(qdrantClient, collectionName, query, k * 3, filters);
  console.log(`Semantic search: ${semanticResults.length} results in ${(performance.now() - semanticStart).toFixed(2)}ms`);

  // Step 3: Merge and rank with weighted scoring
  const mergedResults = mergeAndRank(db, keywordResults, semanticResults, weights);

  // Step 4: Return top k as handles
  const topResults = mergedResults.slice(0, k);
  const handles = topResults.map(result => taskToHandle(db, result.id)).filter(Boolean) as TaskHandle[];

  const totalTime = performance.now() - startTime;
  console.log(`Hybrid search complete: ${handles.length} results in ${totalTime.toFixed(2)}ms`);

  return handles;
}

/**
 * Keyword search using SQLite FTS5
 */
async function keywordSearch(
  db: Database,
  query: string,
  limit: number,
  filters?: { state?: string[]; priority?: string[] }
): Promise<string[]> {
  let sql = `
    SELECT t.id
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

  const rows = db.query(sql).all(...params) as { id: string }[];
  return rows.map(r => r.id);
}

/**
 * Semantic search using Qdrant
 */
async function semanticSearch(
  qdrantClient: QdrantClient,
  collectionName: string,
  query: string,
  limit: number,
  filters?: { state?: string[]; priority?: string[] }
): Promise<Array<{ id: string; score: number }>> {
  // Generate query embedding
  const embedder = new StubEmbedder();
  const queryVector = await embedder.embed(query);

  // Build Qdrant filter
  const qdrantFilter: any = {};
  if (filters?.state?.length || filters?.priority?.length) {
    qdrantFilter.must = [];
    
    if (filters.state?.length) {
      qdrantFilter.must.push({
        key: "state",
        match: { any: filters.state }
      });
    }
    
    if (filters.priority?.length) {
      qdrantFilter.must.push({
        key: "priority",
        match: { any: filters.priority }
      });
    }
  }

  // Search Qdrant
  const searchResult = await qdrantClient.search(collectionName, {
    vector: queryVector,
    limit,
    filter: Object.keys(qdrantFilter).length > 0 ? qdrantFilter : undefined,
    with_payload: false
  });

  return searchResult.map((result: any) => ({
    id: result.id as string,
    score: result.score
  }));
}

/**
 * Merge keyword and semantic results with weighted ranking
 */
function mergeAndRank(
  db: Database,
  keywordIds: string[],
  semanticResults: Array<{ id: string; score: number }>,
  weights: { semantic?: number; recency?: number; priority?: number }
): ScoredTask[] {
  const { semantic = 0.6, recency = 0.3, priority = 0.1 } = weights;

  // Collect all unique task IDs
  const allIds = new Set([...keywordIds, ...semanticResults.map(r => r.id)]);

  // Get task metadata for scoring
  const tasks = Array.from(allIds).map(id => {
    const task = db.query(`
      SELECT id, created_ts, priority, state
      FROM tasks
      WHERE id = ?
    `).get(id) as any;
    return task;
  }).filter(Boolean);

  // Calculate scores
  const scored: ScoredTask[] = tasks.map(task => {
    // Semantic score (0-1, from Qdrant cosine similarity)
    const semanticResult = semanticResults.find(r => r.id === task.id);
    const semanticScore = semanticResult ? semanticResult.score : 0;

    // Recency score (0-1, based on created_ts)
    const recencyScore = calculateRecencyScore(task.created_ts);

    // Priority score (0-1, based on priority level)
    const priorityScore = calculatePriorityScore(task.priority);

    // Weighted total
    const totalScore = 
      (semanticScore * semantic) +
      (recencyScore * recency) +
      (priorityScore * priority);

    return {
      id: task.id,
      score: totalScore,
      semanticScore,
      recencyScore,
      priorityScore
    };
  });

  // Sort by total score descending
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Calculate recency score (0-1) based on created timestamp
 * More recent = higher score
 */
function calculateRecencyScore(createdTs: string): number {
  const now = Date.now();
  const created = new Date(createdTs).getTime();
  const ageMs = now - created;
  
  // Decay over 30 days
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const score = Math.max(0, 1 - (ageMs / thirtyDaysMs));
  
  return score;
}

/**
 * Calculate priority score (0-1)
 */
function calculatePriorityScore(priority: string): number {
  switch (priority) {
    case "high": return 1.0;
    case "med": return 0.5;
    case "low": return 0.2;
    default: return 0.5;
  }
}

/**
 * Convert task ID to handle
 */
function taskToHandle(db: Database, id: string): TaskHandle | null {
  const task = db.query(`
    SELECT id, title AS t, 
           substr(coalesce(summary, body, ''), 1, 300) AS p,
           state AS s, due_ts AS d
    FROM tasks
    WHERE id = ?
  `).get(id) as TaskHandle | undefined;

  return task || null;
}
