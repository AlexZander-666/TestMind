import type { CodeChunk, CodeFile } from '@testmind/shared';
import { TestMindError } from '@testmind/shared';

import { createComponentLogger } from '../utils/logger';
import { metrics } from '../utils/metrics';

import { ContextRanker } from './ContextRanker';
import type { RankCandidate } from './ContextRanker';
import type { DependencyGraphBuilder } from './DependencyGraphBuilder';
import type { SemanticIndexer } from './SemanticIndexer';
import type {
  ContextOptimizationMetrics,
  ContextOptimizationServiceContract,
  ContextRequest,
  ContextResponse,
  ExplicitContextEntry,
  RankedChunk,
} from './types';

const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_TOP_K = 20;

interface TokenBudgetResult {
  ranked: RankedChunk[];
  totalTokens: number;
  truncated: boolean;
}

export class ContextOptimizationService implements ContextOptimizationServiceContract {
  private readonly logger = createComponentLogger('ContextOptimizationService');
  private readonly ranker: ContextRanker;

  private readonly telemetry = {
    builds: 0,
    truncated: 0,
    totalDuration: 0,
    lastDiagnostics: undefined as ContextResponse['diagnostics'] | undefined,
  };

  constructor(
    private readonly semanticIndexer: SemanticIndexer,
    private readonly dependencyGraph: DependencyGraphBuilder,
    ranker?: ContextRanker,
  ) {
    this.ranker = ranker ?? new ContextRanker();
  }

  async warmGraph(files: CodeFile[]): Promise<void> {
    await this.dependencyGraph.buildGraph(files);
  }

  async updateFile(file: CodeFile): Promise<void> {
    await this.dependencyGraph.updateFile(file.filePath, file);
  }

  snapshotMetrics(): ContextOptimizationMetrics {
    const { builds, truncated, totalDuration, lastDiagnostics } = this.telemetry;
    return {
      builds,
      avgBuildTimeMs: builds === 0 ? 0 : Math.round(totalDuration / builds),
      truncationRatio: builds === 0 ? 0 : truncated / builds,
      lastDiagnostics,
    };
  }

  async buildContext(request: ContextRequest): Promise<ContextResponse> {
    const query = request.query.trim();
    if (!query) {
      throw new TestMindError(
        'Context request payload is missing repo metadata or search text',
        'CTX_OPT_INVALID_INPUT',
      );
    }

    const start = Date.now();
    const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;

    const explicitEntries = request.explicitEntries ?? [];
    const explicitChunks = await this.convertExplicitEntries(explicitEntries);

    const includeAutomatic = request.includeAutomatic ?? true;
    const semanticResults = includeAutomatic
      ? await this.semanticIndexer.search(query, {
        topK: request.topK ?? DEFAULT_TOP_K,
        minScore: 0,
      })
      : [];

    const candidateMap = new Map<string, RankCandidate>();
    const dependencyStats = {
      edgesTraversed: 0,
      reverseHits: 0,
      cyclesDetected: 0,
    };

    const registerCandidate = (candidate: RankCandidate) => {
      const existing = candidateMap.get(candidate.chunk.id);
      if (!existing) {
        candidateMap.set(candidate.chunk.id, { ...candidate });
        return;
      }

      existing.semantic = Math.max(existing.semantic ?? 0, candidate.semantic ?? 0);
      existing.structural = Math.max(existing.structural ?? 0, candidate.structural ?? 0);
      existing.dependency = Math.max(existing.dependency ?? 0, candidate.dependency ?? 0);
      existing.recency = Math.max(existing.recency ?? 0, candidate.recency ?? 0);
      existing.source =
        existing.source === 'explicit' ? existing.source : candidate.source || existing.source;

      for (const strategy of candidate.matchedStrategies || []) {
        if (!existing.matchedStrategies?.includes(strategy)) {
          existing.matchedStrategies?.push(strategy);
        }
      }
    };

    for (const entry of explicitChunks) {
      registerCandidate({
        chunk: entry,
        source: 'explicit',
        semantic: 1,
        structural: request.focusScope && entry.filePath.startsWith(request.focusScope) ? 1 : 0.5,
        recency: entry.metadata?.recentlyModified ? 1 : 0.4,
        matchedStrategies: ['explicit'],
      });
    }

    if (includeAutomatic) {
      for (const semanticResult of semanticResults) {
        registerCandidate({
          chunk: semanticResult.chunk,
          source: 'semantic',
          semantic: Math.max(0, Math.min(1, semanticResult.relevance ?? semanticResult.score ?? 0)),
          structural:
            request.focusScope &&
            semanticResult.chunk.filePath.startsWith(request.focusScope)
              ? 0.9
              : 0.3,
          recency: semanticResult.chunk.metadata?.recentlyModified ? 0.8 : 0.3,
          matchedStrategies: ['vector'],
        });
      }
    }

    const dependencyChunks = await this.collectDependencyChunks(
      [...explicitChunks, ...(includeAutomatic ? semanticResults.map((r) => r.chunk) : [])],
      dependencyStats,
    );

    for (const depInfo of dependencyChunks) {
      registerCandidate(depInfo);
    }

    const ranked = this.ranker.rankCandidates(
      Array.from(candidateMap.values()).map((candidate, index) => ({
        ...candidate,
        insertionOrder: index,
      })),
      { focusScope: request.focusScope, weights: request.weights },
    );

    const { ranked: budgeted, totalTokens, truncated } = this.applyTokenBudget(
      ranked,
      maxTokens,
    );

    const diagnostics = {
      topFiles: budgeted.slice(0, 5).map((r) => r.chunk.filePath),
      dependencyStats,
    };

    const response: ContextResponse = {
      ranked: budgeted,
      truncated,
      tokenUsage: {
        total: totalTokens,
        budget: maxTokens,
        truncatedCount: ranked.length - budgeted.length,
      },
      diagnostics,
      sources: this.calculateSourceBreakdown(budgeted),
    };

    this.telemetry.builds += 1;
    if (truncated) {
      this.telemetry.truncated += 1;
    }
    this.telemetry.totalDuration += Date.now() - start;
    this.telemetry.lastDiagnostics = diagnostics;

    const duration = Date.now() - start;
    metrics.recordHistogram('context.build.duration_ms', duration, {
      projectId: request.projectId,
    });
    metrics.recordGauge('context.build.truncated_ratio', response.tokenUsage.truncatedCount, {
      projectId: request.projectId,
    });

    return response;
  }

  private async convertExplicitEntries(entries: ExplicitContextEntry[]): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    for (const entry of entries) {
      if (entry.chunk) {
        chunks.push(entry.chunk);
        continue;
      }

      if (entry.content) {
        const contentChunks = await this.chunkFileContent(entry.path, entry.content);
        chunks.push(...contentChunks);
        continue;
      }

      if (entry.type === 'directory') {
        const directoryChunks = await this.getDirectoryChunks(entry.path);
        chunks.push(...directoryChunks);
      }
    }

    return chunks;
  }

  private async chunkFileContent(filePath: string, content: string): Promise<CodeChunk[]> {
    if (!content) {
      return [];
    }

    const lines = content.split('\n');
    return [
      {
        id: `explicit:${filePath}`,
        content,
        filePath,
        startLine: 1,
        endLine: lines.length,
        embedding: [],
        imports: [],
        exports: [],
        dependencies: [],
        metadata: {
          type: 'module',
          name: filePath.split('/').pop() || filePath,
          recentlyModified: true,
        },
      },
    ];
  }

  private async getDirectoryChunks(directoryPath: string): Promise<CodeChunk[]> {
    try {
      const results = await this.semanticIndexer.search('*', {
        topK: 200,
        minScore: 0,
      });

      return results
        .filter((r) => r.chunk.filePath.startsWith(directoryPath))
        .map((r) => r.chunk);
    } catch (error) {
      this.logger.error('Failed to load directory chunks', { directoryPath, error });
      return [];
    }
  }

  private async collectDependencyChunks(
    seeds: CodeChunk[],
    stats: ContextResponse['diagnostics']['dependencyStats'],
  ): Promise<RankCandidate[]> {
    if (seeds.length === 0) {
      return [];
    }

    const discovered: RankCandidate[] = [];
    const visitedFiles = new Set<string>();

    for (const chunk of seeds) {
      if (!chunk.filePath || visitedFiles.has(chunk.filePath)) {
        continue;
      }

      visitedFiles.add(chunk.filePath);
      const cycles = this.dependencyGraph.detectCircularDependencies(chunk.filePath);
      stats.cyclesDetected += cycles.length;
      const neighbors = await this.dependencyGraph.getRelatedFiles(chunk.filePath, {
        includeReverse: true,
        maxDepth: 2,
      });

      stats.edgesTraversed += neighbors.length;
      stats.reverseHits += neighbors.filter((n) => n.relation === 'importedBy').length;

      for (const neighbor of neighbors) {
        const neighborChunks = this.semanticIndexer.getChunksByFile(neighbor.path);
        if (neighborChunks.length === 0) {
          continue;
        }

        for (const neighborChunk of neighborChunks) {
          discovered.push({
            chunk: neighborChunk,
            source: 'dependency',
            dependency: neighbor.weight,
            structural: chunk.filePath === neighborChunk.filePath ? 1 : 0.4,
            semantic: 0.3,
            recency: neighbor.lastModified ? this.normalizeRecency(neighbor.lastModified) : 0.3,
            matchedStrategies: ['dependency'],
          });
        }
      }
    }

    return discovered;
  }

  private normalizeRecency(timestamp: number): number {
    const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    if (ageDays <= 1) return 1;
    if (ageDays <= 7) return 0.8;
    if (ageDays <= 30) return 0.5;
    if (ageDays <= 90) return 0.3;
    return 0.1;
  }

  private applyTokenBudget(ranked: RankedChunk[], maxTokens: number): TokenBudgetResult {
    const kept: RankedChunk[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const entry of ranked) {
      const tokens = this.estimateTokens(entry.chunk.content || '');
      if (totalTokens + tokens > maxTokens) {
        truncated = true;
        break;
      }

      totalTokens += tokens;
      kept.push(entry);
    }

    return { ranked: kept, totalTokens, truncated };
  }

  private estimateTokens(content: string): number {
    if (!content) return 0;
    return Math.ceil(content.length / 4);
  }

  private calculateSourceBreakdown(ranked: RankedChunk[]): ContextResponse['sources'] {
    const counts = {
      explicit: 0,
      automatic: 0,
      dependency: 0,
    };

    for (const entry of ranked) {
      if (entry.source === 'explicit') {
        counts.explicit += 1;
      } else if (entry.source === 'dependency') {
        counts.dependency += 1;
      } else {
        counts.automatic += 1;
      }
    }

    return counts;
  }
}
