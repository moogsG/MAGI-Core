export interface SnapshotOptions {
  dbPath?: string;
  outputDir?: string;
  tables?: string[];
}

export interface SnapshotResult {
  ok: boolean;
  files: string[];
  timestamp: string;
  rowCounts: Record<string, number>;
}

export interface DuckDBViewOptions {
  parquetDir: string;
  viewNames?: string[];
}

export interface QdrantConfig {
  url?: string;
  apiKey?: string;
  collectionName?: string;
  vectorSize?: number;
}
