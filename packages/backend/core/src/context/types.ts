import type { CodeChunk, CodeFile } from '@testmind/shared';

import type { RankingCriteria } from './ContextRanker';

export interface ExplicitContextEntry {
  id: string;
  type: 'file' | 'function' | 'directory';
  path: string;
  content?: string;
  chunk?: CodeChunk;
  addedAt: Date;
  priority: number;
  matchedStrategies?: ('vector' | 'keyword' | 'dependency' | 'explicit')[];
}

export interface RankedChunk {
  chunk: CodeChunk;
  score: number;
  rank: number;
  source: 'explicit' | 'semantic' | 'dependency';
  factors: {
    semantic: number;
    structural: number;
    dependency: number;
    recency: number;
  };
  matchedStrategies: ('vector' | 'keyword' | 'dependency' | 'explicit')[];
}

export interface ContextRequest {
  projectId: string;
  query: string;
  focusScope?: string;
  explicitEntries?: ExplicitContextEntry[];
  maxTokens?: number;
  topK?: number;
  weights?: RankingCriteria;
  includeAutomatic?: boolean;
}

export interface ContextResponse {
  ranked: RankedChunk[];
  truncated: boolean;
  tokenUsage: {
    total: number;
    budget: number;
    truncatedCount: number;
  };
  diagnostics: {
    topFiles: string[];
    dependencyStats: {
      edgesTraversed: number;
      reverseHits: number;
      cyclesDetected: number;
    };
  };
  sources: {
    explicit: number;
    automatic: number;
    dependency: number;
  };
}

export interface ContextOptimizationMetrics {
  builds: number;
  avgBuildTimeMs: number;
  truncationRatio: number;
  lastDiagnostics?: ContextResponse['diagnostics'];
}

export interface DependencyNeighbor {
  path: string;
  weight: number;
  relation: 'imports' | 'importedBy' | 'transitive';
  lastModified?: number;
}

export interface ContextOptimizationServiceContract {
  buildContext(request: ContextRequest): Promise<ContextResponse>;
  warmGraph(files: CodeFile[]): Promise<void>;
  updateFile(file: CodeFile): Promise<void>;
  snapshotMetrics(): ContextOptimizationMetrics;
}
