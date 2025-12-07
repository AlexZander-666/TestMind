import type { CodeChunk } from '@testmind/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ContextOptimizationService } from '../ContextOptimizationService';
import { ContextRanker } from '../ContextRanker';
import type { DependencyGraphBuilder } from '../DependencyGraphBuilder';
import type { SemanticIndexer } from '../SemanticIndexer';
import type { ExplicitContextEntry } from '../types';

const createChunk = (id: string, filePath: string, content: string): CodeChunk => ({
  id,
  content,
  filePath,
  startLine: 1,
  endLine: 5,
  embedding: [],
});

describe('ContextOptimizationService', () => {
  let semanticIndexerMock: {
    search: ReturnType<typeof vi.fn>;
    getChunksByFile: ReturnType<typeof vi.fn>;
  };
  let dependencyGraphMock: {
    getRelatedFiles: ReturnType<typeof vi.fn>;
    detectCircularDependencies: ReturnType<typeof vi.fn>;
    buildGraph: ReturnType<typeof vi.fn>;
    updateFile: ReturnType<typeof vi.fn>;
  };
  let service: ContextOptimizationService;

  beforeEach(() => {
    const autoChunk = createChunk('auto', '/repo/src/auto.ts', 'auto content');
    const depChunk = createChunk('dep', '/repo/src/dep.ts', 'dep content goes here');

    semanticIndexerMock = {
      search: vi.fn().mockResolvedValue([
        { chunk: autoChunk, score: 0.9, relevance: 0.9 },
      ]),
      getChunksByFile: vi.fn().mockReturnValue([depChunk]),
    };

    dependencyGraphMock = {
      getRelatedFiles: vi.fn().mockResolvedValue([
        {
          path: '/repo/src/dep.ts',
          weight: 0.75,
          relation: 'imports' as const,
          lastModified: Date.now(),
        },
      ]),
      detectCircularDependencies: vi.fn().mockReturnValue([
        ['/repo/src/auto.ts', '/repo/src/dep.ts'],
      ]),
      buildGraph: vi.fn(),
      updateFile: vi.fn(),
    };

    service = new ContextOptimizationService(
      semanticIndexerMock as unknown as SemanticIndexer,
      dependencyGraphMock as unknown as DependencyGraphBuilder,
      new ContextRanker(),
    );
  });

  it('builds ranked context with explicit, semantic, and dependency signals', async () => {
    const explicitEntry: ExplicitContextEntry = {
      id: 'file:/repo/src/explicit.ts',
      type: 'file',
      path: '/repo/src/explicit.ts',
      content: 'export const focus = true;',
      addedAt: new Date(),
      priority: 10,
    };

    const response = await service.buildContext({
      projectId: 'test',
      query: 'optimize context',
      explicitEntries: [explicitEntry],
      maxTokens: 200,
    });

    expect(response.ranked.length).toBeGreaterThan(0);
    expect(response.ranked[0].source).toBe('explicit');
    expect(response.sources.explicit).toBe(1);
    expect(response.sources.dependency).toBe(1);
    expect(response.diagnostics.dependencyStats.edgesTraversed).toBeGreaterThanOrEqual(1);
    expect(response.diagnostics.dependencyStats.cyclesDetected).toBeGreaterThanOrEqual(1);
    expect(response.tokenUsage.total).toBeGreaterThan(0);

    const snapshot = service.snapshotMetrics();
    expect(snapshot.builds).toBe(1);
    expect(snapshot.lastDiagnostics?.topFiles.length).toBeGreaterThan(0);
    expect(semanticIndexerMock.search).toHaveBeenCalledWith(
      'optimize context',
      expect.objectContaining({ topK: expect.any(Number) }),
    );
  });
});
