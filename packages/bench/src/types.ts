export interface BenchmarkResult {
  operation: string;
  samples: number;
  latencies: number[]; // in milliseconds
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  tokensPerRequest?: number;
}

export interface BenchmarkSuite {
  timestamp: string;
  results: BenchmarkResult[];
  summary: {
    totalSamples: number;
    totalDuration: number;
    precision?: {
      map10: number;
      queries: number;
    };
  };
}

export interface LabeledQuery {
  query: string;
  relevantIds: string[];
  description: string;
}
