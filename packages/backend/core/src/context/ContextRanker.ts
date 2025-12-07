/**
 * ContextRanker - 上下文相关性排序
 * 
 * 对搜索结果进行智能排序，基于多种因素
 */

import type { CodeChunk, FunctionContext } from '@testmind/shared';

import type { RankedChunk } from './types';

export interface RankingCriteria {
  /** 语义相关性权重 */
  semanticWeight?: number;
  /** 结构相关性权重（是否在同一模块） */
  structuralWeight?: number;
  /** 依赖关系权重 */
  dependencyWeight?: number;
  /** 最近修改权重 */
  recencyWeight?: number;
}

export interface RankedContext {
  context: FunctionContext | CodeChunk;
  score: number;
  factors: {
    semantic: number;
    structural: number;
    dependency: number;
    recency: number;
  };
}

export interface RankOptions {
  focusScope?: string;
  weights?: RankingCriteria;
}

export interface RankCandidate {
  chunk: CodeChunk;
  semantic?: number;
  structural?: number;
  dependency?: number;
  recency?: number;
  source?: RankedChunk['source'];
  matchedStrategies?: RankedChunk['matchedStrategies'];
  insertionOrder?: number;
}

/**
 * Context Ranker
 */
export class ContextRanker {
  private readonly criteria: Required<RankingCriteria>;

  constructor(criteria: RankingCriteria = {}) {
    this.criteria = {
      semanticWeight: criteria.semanticWeight ?? 0.5,
      structuralWeight: criteria.structuralWeight ?? 0.2,
      dependencyWeight: criteria.dependencyWeight ?? 0.2,
      recencyWeight: criteria.recencyWeight ?? 0.1,
    };
  }

  /**
   * Rank function contexts or code chunks
   */
  rankContexts(contexts: (FunctionContext | CodeChunk)[], options?: RankOptions): RankedContext[] {
    const candidates: RankCandidate[] = contexts.map((context, index) => {
      const chunk = this.toChunk(context);
      return {
        chunk,
        semantic: 0.5,
        structural: this.deriveStructuralScore(chunk, options?.focusScope),
        dependency: 0,
        recency: 0.3,
        source: 'semantic',
        matchedStrategies: ['vector'],
        insertionOrder: index,
      };
    });

    const rankedChunks = this.rankCandidates(candidates, options);
    return rankedChunks.map(result => ({
      context: result.chunk,
      score: result.score,
      factors: result.factors,
    }));
  }

  /**
   * Rank code chunks
   */
  rankChunks(chunks: CodeChunk[], options?: RankOptions): RankedContext[] {
    return this.rankContexts(chunks, options);
  }

  /**
   * Rank enriched candidates with factor metadata
   */
  rankCandidates(candidates: RankCandidate[], options?: RankOptions): RankedChunk[] {
    const weights = {
      semanticWeight: options?.weights?.semanticWeight ?? this.criteria.semanticWeight,
      structuralWeight: options?.weights?.structuralWeight ?? this.criteria.structuralWeight,
      dependencyWeight: options?.weights?.dependencyWeight ?? this.criteria.dependencyWeight,
      recencyWeight: options?.weights?.recencyWeight ?? this.criteria.recencyWeight,
    };

    const scored = candidates.map((candidate, index) => {
      const factors = {
        semantic: this.clamp(candidate.semantic ?? 0),
        structural:
          candidate.structural ??
          this.deriveStructuralScore(candidate.chunk, options?.focusScope),
        dependency: this.clamp(
          candidate.dependency ?? (candidate.source === 'dependency' ? 0.7 : 0),
        ),
        recency: this.clamp(candidate.recency ?? 0.2),
      };

      const score =
        factors.semantic * weights.semanticWeight +
        factors.structural * weights.structuralWeight +
        factors.dependency * weights.dependencyWeight +
        factors.recency * weights.recencyWeight;

      return {
        candidate,
        factors,
        score,
        order: candidate.insertionOrder ?? index,
      };
    });

    scored.sort((a, b) => {
      if (b.score === a.score) {
        return a.order - b.order;
      }
      return b.score - a.score;
    });

    return scored.map((entry, rank) => ({
      chunk: entry.candidate.chunk,
      score: Number(entry.score.toFixed(4)),
      rank: rank + 1,
      source: entry.candidate.source ?? 'semantic',
      factors: entry.factors,
      matchedStrategies: entry.candidate.matchedStrategies ?? [],
    }));
  }

  private clamp(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  private deriveStructuralScore(chunk: CodeChunk, focusScope?: string): number {
    if (!focusScope) {
      return 0.4;
    }
    return chunk.filePath.startsWith(focusScope) ? 1 : 0.2;
  }

  private toChunk(context: FunctionContext | CodeChunk): CodeChunk {
    if ((context as CodeChunk).content !== undefined) {
      return context as CodeChunk;
    }

    const fn = context as FunctionContext;
    const {signature} = fn;
    return {
      id: `fn:${signature.filePath}:${signature.name}`,
      content: signature.documentation || signature.name,
      filePath: signature.filePath,
      startLine: 0,
      endLine: 0,
      embedding: [],
      metadata: {
        type: 'function',
        name: signature.name,
      },
    };
  }
}

/**
 * Factory function
 */
export function createContextRanker(criteria?: RankingCriteria): ContextRanker {
  return new ContextRanker(criteria);
}
