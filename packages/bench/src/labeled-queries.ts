import type { LabeledQuery } from "./types.js";

/**
 * Labeled test queries for precision@10 evaluation
 * Each query has a set of known relevant task IDs from the benchmark dataset
 */
export const LABELED_QUERIES: LabeledQuery[] = [
  {
    query: "authentication login bug",
    description: "Tasks related to authentication and login issues",
    relevantIds: [
      // These IDs are deterministic based on our seeding
      // Tasks with "authentication" in title/body
    ],
  },
  {
    query: "rate limiting API throttle",
    description: "Tasks about API rate limiting and throttling",
    relevantIds: [],
  },
  {
    query: "memory leak performance",
    description: "Tasks about memory leaks and performance issues",
    relevantIds: [],
  },
  {
    query: "database optimization query",
    description: "Database and SQL optimization tasks",
    relevantIds: [],
  },
  {
    query: "documentation update docs",
    description: "Documentation-related tasks",
    relevantIds: [],
  },
];

/**
 * Build labeled dataset by querying the database for relevant tasks
 */
export function buildLabeledDataset(db: any): LabeledQuery[] {
  const queries: LabeledQuery[] = [
    {
      query: "authentication login",
      description: "Authentication and login tasks",
      relevantIds: db.query(`
        SELECT id FROM tasks 
        WHERE source = 'benchmark' 
        AND (title LIKE '%authentication%' OR body LIKE '%authentication%' OR title LIKE '%login%' OR body LIKE '%login%')
        LIMIT 20
      `).all().map((r: any) => r.id),
    },
    {
      query: "rate limiting API",
      description: "Rate limiting and API tasks",
      relevantIds: db.query(`
        SELECT id FROM tasks 
        WHERE source = 'benchmark' 
        AND (title LIKE '%rate limiting%' OR body LIKE '%rate limiting%' OR title LIKE '%API%' OR body LIKE '%API%')
        LIMIT 20
      `).all().map((r: any) => r.id),
    },
    {
      query: "memory leak",
      description: "Memory leak tasks",
      relevantIds: db.query(`
        SELECT id FROM tasks 
        WHERE source = 'benchmark' 
        AND (title LIKE '%memory%' OR body LIKE '%memory%' OR title LIKE '%leak%' OR body LIKE '%leak%')
        LIMIT 20
      `).all().map((r: any) => r.id),
    },
    {
      query: "database optimization",
      description: "Database optimization tasks",
      relevantIds: db.query(`
        SELECT id FROM tasks 
        WHERE source = 'benchmark' 
        AND (title LIKE '%database%' OR body LIKE '%database%' OR title LIKE '%SQL%' OR body LIKE '%SQL%' OR title LIKE '%query%' OR body LIKE '%query%')
        LIMIT 20
      `).all().map((r: any) => r.id),
    },
    {
      query: "documentation",
      description: "Documentation tasks",
      relevantIds: db.query(`
        SELECT id FROM tasks 
        WHERE source = 'benchmark' 
        AND (title LIKE '%documentation%' OR body LIKE '%documentation%' OR title LIKE '%docs%' OR body LIKE '%docs%')
        LIMIT 20
      `).all().map((r: any) => r.id),
    },
  ];
  
  return queries.filter(q => q.relevantIds.length > 0);
}

/**
 * Calculate precision@k for a query result
 */
export function calculatePrecisionAtK(
  retrievedIds: string[],
  relevantIds: string[],
  k: number
): number {
  const topK = retrievedIds.slice(0, k);
  const relevantSet = new Set(relevantIds);
  const relevantInTopK = topK.filter(id => relevantSet.has(id)).length;
  return relevantInTopK / k;
}

/**
 * Calculate mean average precision (MAP) across all queries
 */
export function calculateMAP(
  results: Array<{ retrievedIds: string[]; relevantIds: string[] }>,
  k: number
): number {
  if (results.length === 0) return 0;
  
  const precisions = results.map(r => 
    calculatePrecisionAtK(r.retrievedIds, r.relevantIds, k)
  );
  
  return precisions.reduce((sum, p) => sum + p, 0) / precisions.length;
}
