import type { QdrantClient } from "@qdrant/qdrant-js";
import { Database } from "bun:sqlite";

export interface EmbedderConfig {
  mode?: "stub" | "openai";
  apiKey?: string;
  model?: string;
  batchSize?: number;
  vectorSize?: number;
}

export interface TaskEmbedding {
  id: string;
  vector: number[];
  payload: {
    title: string;
    body?: string;
    summary?: string;
    state: string;
    priority: string;
    created_ts: string;
    due_ts?: string;
  };
}

/**
 * Stub embedder - generates random vectors for testing
 */
export class StubEmbedder {
  private vectorSize: number;

  constructor(config: EmbedderConfig = {}) {
    this.vectorSize = config.vectorSize || 1536;
  }

  /**
   * Generate a random normalized vector
   */
  private generateRandomVector(): number[] {
    const vector = Array.from({ length: this.vectorSize }, () => Math.random() - 0.5);
    
    // Normalize to unit length
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }

  /**
   * Embed a single text (stub implementation)
   */
  async embed(text: string): Promise<number[]> {
    // For stub, we just return a random vector
    // In production, this would call OpenAI API
    return this.generateRandomVector();
  }

  /**
   * Embed multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => this.generateRandomVector());
  }
}

/**
 * Batch process tasks and upsert to Qdrant
 */
export async function batchEmbedTasks(
  dbPath: string,
  qdrantClient: QdrantClient,
  collectionName: string,
  config: EmbedderConfig = {}
): Promise<{ ok: boolean; count: number }> {
  const { batchSize = 100 } = config;
  
  const db = new Database(dbPath, { readonly: true });
  const embedder = new StubEmbedder(config);

  try {
    // Fetch all tasks
    const tasks = db.query(`
      SELECT id, title, body, summary, state, priority, created_ts, due_ts
      FROM tasks
      ORDER BY created_ts DESC
    `).all() as any[];

    console.log(`Processing ${tasks.length} tasks in batches of ${batchSize}...`);

    let processedCount = 0;

    // Process in batches
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      
      // Create text for embedding (title + body + summary)
      const texts = batch.map(task => {
        const parts = [task.title];
        if (task.body) parts.push(task.body);
        if (task.summary) parts.push(task.summary);
        return parts.join(" ");
      });

      // Generate embeddings
      const vectors = await embedder.embedBatch(texts);

      // Prepare points for Qdrant
      const points = batch.map((task, idx) => ({
        id: task.id,
        vector: vectors[idx],
        payload: {
          title: task.title,
          body: task.body || "",
          summary: task.summary || "",
          state: task.state,
          priority: task.priority,
          created_ts: task.created_ts,
          due_ts: task.due_ts || null
        }
      }));

      // Upsert to Qdrant
      await qdrantClient.upsert(collectionName, {
        wait: true,
        points
      });

      processedCount += batch.length;
      console.log(`  Processed ${processedCount}/${tasks.length} tasks`);
    }

    console.log(`Successfully embedded ${processedCount} tasks`);
    return { ok: true, count: processedCount };
  } finally {
    db.close();
  }
}

/**
 * Real OpenAI embedder (placeholder for future implementation)
 */
export class OpenAIEmbedder {
  private apiKey: string;
  private model: string;

  constructor(config: EmbedderConfig) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
    this.model = config.model || "text-embedding-3-small";
  }

  async embed(text: string): Promise<number[]> {
    // TODO: Implement OpenAI API call
    // const response = await fetch("https://api.openai.com/v1/embeddings", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${this.apiKey}`,
    //     "Content-Type": "application/json"
    //   },
    //   body: JSON.stringify({
    //     model: this.model,
    //     input: text
    //   })
    // });
    // const data = await response.json();
    // return data.data[0].embedding;
    
    throw new Error("OpenAI embedder not yet implemented - use stub mode");
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // TODO: Implement batch OpenAI API call
    throw new Error("OpenAI embedder not yet implemented - use stub mode");
  }
}
