import { QdrantClient } from "@qdrant/qdrant-js";
import type { QdrantConfig } from "./types.js";

/**
 * Initialize Qdrant collection for task vectors
 */
export async function initQdrant(config: QdrantConfig = {}): Promise<{ ok: boolean; collection: string }> {
  const {
    url = process.env.QDRANT_URL || "http://localhost:6333",
    apiKey = process.env.QDRANT_API_KEY,
    collectionName = "tasks_vec",
    vectorSize = 1536 // OpenAI text-embedding-3-small dimension
  } = config;

  const client = new QdrantClient({
    url,
    apiKey
  });

  try {
    // Check if collection exists
    const collections = await client.getCollections();
    const exists = collections.collections.some((c: any) => c.name === collectionName);

    if (exists) {
      console.log(`Collection '${collectionName}' already exists`);
      
      // Optionally recreate
      if (process.env.QDRANT_RECREATE === "true") {
        console.log(`Deleting existing collection '${collectionName}'...`);
        await client.deleteCollection(collectionName);
      } else {
        return { ok: true, collection: collectionName };
      }
    }

    // Create collection with vector configuration
    console.log(`Creating collection '${collectionName}' with vector size ${vectorSize}...`);
    await client.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: "Cosine" // Cosine similarity for semantic search
      },
      optimizers_config: {
        default_segment_number: 2
      },
      replication_factor: 1
    });

    // Create payload indexes for filtering
    await client.createPayloadIndex(collectionName, {
      field_name: "state",
      field_schema: "keyword"
    });

    await client.createPayloadIndex(collectionName, {
      field_name: "priority",
      field_schema: "keyword"
    });

    await client.createPayloadIndex(collectionName, {
      field_name: "created_ts",
      field_schema: "datetime"
    });

    await client.createPayloadIndex(collectionName, {
      field_name: "due_ts",
      field_schema: "datetime"
    });

    console.log(`Collection '${collectionName}' created successfully`);
    console.log(`  Vector size: ${vectorSize}`);
    console.log(`  Distance metric: Cosine`);
    console.log(`  Payload indexes: state, priority, created_ts, due_ts`);

    return { ok: true, collection: collectionName };
  } catch (error) {
    console.error("Qdrant initialization failed:", error);
    throw error;
  }
}

/**
 * Get Qdrant client instance
 */
export function getQdrantClient(config: QdrantConfig = {}): QdrantClient {
  const {
    url = process.env.QDRANT_URL || "http://localhost:6333",
    apiKey = process.env.QDRANT_API_KEY
  } = config;

  return new QdrantClient({ url, apiKey });
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  console.log("Initializing Qdrant...");
  const result = await initQdrant();
  console.log(`\nQdrant initialization complete: ${result.collection}`);
}
