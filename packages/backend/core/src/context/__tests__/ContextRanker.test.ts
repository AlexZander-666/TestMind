import type { CodeChunk } from '@testmind/shared';
import { describe, it, expect } from 'vitest';

import { ContextRanker } from '../ContextRanker';

const createChunk = (id: string, filePath: string): CodeChunk => ({
  id,
  content: `function ${id}() { return '${id}'; }`,
  filePath,
  startLine: 1,
  endLine: 5,
  embedding: [],
});

describe('ContextRanker', () => {
  it('prioritizes semantic relevance combined with structural matches', () => {
    const ranker = new ContextRanker();
    const focusScope = '/repo/src/core';

    const candidates = [
      {
        chunk: createChunk('coreFn', `${focusScope}/Context.ts`),
        semantic: 0.5,
        structural: 1,
        dependency: 0.2,
        recency: 0.4,
        matchedStrategies: ['vector'],
        source: 'semantic' as const,
      },
      {
        chunk: createChunk('utilFn', '/repo/src/lib/utils.ts'),
        semantic: 0.9,
        structural: 0.1,
        dependency: 0.1,
        recency: 0.2,
        matchedStrategies: ['vector'],
        source: 'semantic' as const,
      },
    ];

    const ranked = ranker.rankCandidates(candidates, { focusScope });

    expect(ranked[0].chunk.id).toBe('coreFn');
    expect(ranked[0].factors.structural).toBeGreaterThan(ranked[1].factors.structural);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('keeps deterministic ordering using insertion order when scores match', () => {
    const ranker = new ContextRanker();

    const candidates = [
      {
        chunk: createChunk('first', '/repo/src/a.ts'),
        semantic: 0.6,
        structural: 0.4,
        dependency: 0.2,
        recency: 0.2,
        matchedStrategies: ['vector'],
        source: 'semantic' as const,
        insertionOrder: 0,
      },
      {
        chunk: createChunk('second', '/repo/src/b.ts'),
        semantic: 0.6,
        structural: 0.4,
        dependency: 0.2,
        recency: 0.2,
        matchedStrategies: ['vector'],
        source: 'semantic' as const,
        insertionOrder: 1,
      },
    ];

    const ranked = ranker.rankCandidates(candidates);
    expect(ranked[0].chunk.id).toBe('first');
    expect(ranked[1].chunk.id).toBe('second');
  });
});
