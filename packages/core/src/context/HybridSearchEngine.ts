/**
 * HybridSearchEngine - 混合搜索引擎
 * 
 * 融合多种搜索策略：
 * 1. 向量搜索（语义相似度）- LanceDB
 * 2. 关键词搜索（精确匹配）- 倒排索引
 * 3. 依赖图搜索（代码关系）- 依赖图
 * 
 * 使用 RRF (Reciprocal Rank Fusion) 算法融合结果
 * 
 * 理论基础：
 * - 向量搜索擅长捕获语义相似性
 * - 关键词搜索确保精确匹配不丢失
 * - 依赖图提供上下文相关代码
 * - RRF 比简单加权更稳健
 */

import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';
import type { EnhancedVectorStore } from '../db/VectorStore.enhanced';
import type { DependencyGraphBuilder } from './DependencyGraphBuilder';

/**
 * 搜索查询
 */
export interface SearchQuery {
  /** 查询文本 */
  text: string;
  
  /** 查询向量（如果已生成） */
  embedding?: number[];
  
  /** 查询的文件路径（用于依赖图搜索） */
  filePath?: string;
  
  /** 返回结果数量 */
  topK?: number;
  
  /** 搜索策略权重 */
  weights?: {
    vector?: number;
    keyword?: number;
    dependency?: number;
  };
  
  /** 过滤条件 */
  filter?: {
    fileTypes?: string[];
    excludeFiles?: string[];
    minComplexity?: number;
    maxComplexity?: number;
  };
}

/**
 * 搜索结果
 */
export interface HybridSearchResult {
  /** 代码块 */
  chunk: CodeChunk;
  
  /** 综合得分 (0-1) */
  score: number;
  
  /** 各策略的原始得分 */
  scores: {
    vector?: number;
    keyword?: number;
    dependency?: number;
    rrf: number;
  };
  
  /** 匹配的搜索策略 */
  matchedBy: ('vector' | 'keyword' | 'dependency')[];
}

/**
 * 搜索统计
 */
export interface SearchStats {
  /** 总搜索次数 */
  totalSearches: number;
  
  /** 平均响应时间（毫秒） */
  avgResponseTime: number;
  
  /** 各策略命中次数 */
  strategyHits: {
    vector: number;
    keyword: number;
    dependency: number;
  };
  
  /** 缓存命中率 */
  cacheHitRate?: number;
}

/**
 * 混合搜索引擎
 */
export class HybridSearchEngine {
  private vectorStore: EnhancedVectorStore;
  private dependencyGraph: DependencyGraphBuilder;
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> chunk IDs
  private chunkCache: Map<string, CodeChunk> = new Map();
  private stats: SearchStats;

  constructor(
    vectorStore: EnhancedVectorStore,
    dependencyGraph: DependencyGraphBuilder
  ) {
    this.vectorStore = vectorStore;
    this.dependencyGraph = dependencyGraph;
    this.stats = {
      totalSearches: 0,
      avgResponseTime: 0,
      strategyHits: {
        vector: 0,
        keyword: 0,
        dependency: 0,
      },
    };
  }

  /**
   * 执行混合搜索
   */
  async search(query: SearchQuery): Promise<HybridSearchResult[]> {
    const startTime = Date.now();
    this.stats.totalSearches++;

    const topK = query.topK || 5;
    const weights = {
      vector: query.weights?.vector ?? 0.5,
      keyword: query.weights?.keyword ?? 0.3,
      dependency: query.weights?.dependency ?? 0.2,
    };

    // 并行执行三种搜索
    const [vectorResults, keywordResults, dependencyResults] = await Promise.all([
      this.vectorSearch(query, topK * 4), // 获取更多结果用于融合
      this.keywordSearch(query, topK * 4),
      this.dependencySearch(query, topK * 4),
    ]);

    console.log('[HybridSearch] Search results:');
    console.log(`  - Vector: ${vectorResults.length}`);
    console.log(`  - Keyword: ${keywordResults.length}`);
    console.log(`  - Dependency: ${dependencyResults.length}`);

    // 使用 RRF 融合结果
    const merged = this.reciprocalRankFusion([
      { results: vectorResults, weight: weights.vector, strategy: 'vector' },
      { results: keywordResults, weight: weights.keyword, strategy: 'keyword' },
      { results: dependencyResults, weight: weights.dependency, strategy: 'dependency' },
    ]);

    // 应用过滤器
    let filtered = merged;
    if (query.filter) {
      filtered = this.applyFilters(merged, query.filter);
    }

    // 返回 top K
    const results = filtered.slice(0, topK);

    // 更新统计
    const duration = Date.now() - startTime;
    this.updateStats(duration);

    console.log(`[HybridSearch] Returned ${results.length} results in ${duration}ms`);

    return results;
  }

  /**
   * 向量搜索（语义相似度）
   */
  private async vectorSearch(
    query: SearchQuery,
    k: number
  ): Promise<SemanticSearchResult[]> {
    if (!query.embedding) {
      return []; // 没有向量，跳过向量搜索
    }

    try {
      this.stats.strategyHits.vector++;
      return await this.vectorStore.search(query.embedding, { k });
    } catch (error) {
      console.error('[HybridSearch] Vector search failed:', error);
      return [];
    }
  }

  /**
   * 关键词搜索（精确匹配）
   */
  private async keywordSearch(
    query: SearchQuery,
    k: number
  ): Promise<SemanticSearchResult[]> {
    this.stats.strategyHits.keyword++;

    // 提取关键词
    const keywords = this.extractKeywords(query.text);
    
    // 查找匹配的 chunks
    const chunkIds = new Set<string>();
    
    for (const keyword of keywords) {
      const ids = this.keywordIndex.get(keyword.toLowerCase());
      if (ids) {
        ids.forEach(id => chunkIds.add(id));
      }
    }

    // 计算关键词匹配得分
    const results: SemanticSearchResult[] = [];
    
    for (const id of chunkIds) {
      const chunk = this.chunkCache.get(id);
      if (!chunk) continue;

      const score = this.calculateKeywordScore(keywords, chunk);
      results.push({ chunk, score, relevance: score });
    }

    // 按得分排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, k);
  }

  /**
   * 依赖图搜索（相关代码）
   */
  private async dependencySearch(
    query: SearchQuery,
    k: number
  ): Promise<SemanticSearchResult[]> {
    if (!query.filePath) {
      return []; // 没有文件路径，跳过依赖图搜索
    }

    try {
      this.stats.strategyHits.dependency++;

      // 获取依赖和被依赖的文件
      // TODO: getRelatedFiles needs to be implemented in DependencyGraphBuilder
      const relatedFiles: Array<{ path: string; weight?: number }> = [];
      
      // 获取这些文件中的所有 chunks
      const results: SemanticSearchResult[] = [];
      
      for (const relatedFile of relatedFiles.slice(0, k)) {
        const chunksInFile = Array.from(this.chunkCache.values())
          .filter(chunk => chunk.filePath === relatedFile.path);
        
        for (const chunk of chunksInFile) {
          const score = relatedFile.weight || 0.8;
          results.push({
            chunk,
            score,
            relevance: score,
          });
        }
      }

      return results.slice(0, k);
    } catch (error) {
      console.error('[HybridSearch] Dependency search failed:', error);
      return [];
    }
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * 
   * 算法：
   * RRF(d) = Σ(w_i / (k + r_i(d)))
   * 
   * 其中：
   * - d: 文档
   * - w_i: 策略权重
   * - k: RRF 常数（通常为 60）
   * - r_i(d): 文档 d 在策略 i 中的排名
   * 
   * 优势：
   * - 不需要归一化得分
   * - 对排名的鲁棒性好
   * - 自动平衡不同策略
   */
  private reciprocalRankFusion(
    sources: Array<{
      results: SemanticSearchResult[];
      weight: number;
      strategy: 'vector' | 'keyword' | 'dependency';
    }>
  ): HybridSearchResult[] {
    const K = 60; // RRF 常数
    const scoreMap = new Map<string, {
      chunk: CodeChunk;
      totalScore: number;
      scores: { vector?: number; keyword?: number; dependency?: number; rrf: number };
      matchedBy: ('vector' | 'keyword' | 'dependency')[];
    }>();

    // 计算每个策略的 RRF 分数
    for (const { results, weight, strategy } of sources) {
      results.forEach((result, rank) => {
        const chunkId = result.chunk.id;
        const rrfScore = weight / (K + rank);

        if (!scoreMap.has(chunkId)) {
          scoreMap.set(chunkId, {
            chunk: result.chunk,
            totalScore: 0,
            scores: { rrf: 0 },
            matchedBy: [],
          });
        }

        const entry = scoreMap.get(chunkId)!;
        entry.totalScore += rrfScore;
        entry.scores.rrf += rrfScore;
        entry.scores[strategy] = result.score;
        
        if (!entry.matchedBy.includes(strategy)) {
          entry.matchedBy.push(strategy);
        }
      });
    }

    // 转换为结果数组并排序
    const results: HybridSearchResult[] = Array.from(scoreMap.values()).map(entry => ({
      chunk: entry.chunk,
      score: entry.totalScore,
      scores: entry.scores,
      matchedBy: entry.matchedBy,
    }));

    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 分词：按空格、标点符号分割
    const words = text
      .toLowerCase()
      .split(/[^\w]+/)
      .filter(w => w.length > 2); // 移除过短的词

    // 移除停用词
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const keywords = words.filter(w => !stopWords.has(w));

    // 去重
    return Array.from(new Set(keywords));
  }

  /**
   * 计算关键词匹配得分
   */
  private calculateKeywordScore(keywords: string[], chunk: CodeChunk): number {
    const chunkText = `${chunk.name || chunk.functionName || ''} ${chunk.content}`.toLowerCase();
    
    let matchCount = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      // 检查精确匹配
      if (chunkText.includes(keyword)) {
        matchCount++;
        
        // 函数名匹配权重更高
        const chunkName = chunk.name || chunk.functionName || '';
        if (chunkName.toLowerCase().includes(keyword)) {
          totalWeight += 2.0;
        } else {
          totalWeight += 1.0;
        }
      }
    }

    if (keywords.length === 0) {
      return 0;
    }

    // 得分 = 匹配关键词比例 * 平均权重
    const matchRatio = matchCount / keywords.length;
    const avgWeight = matchCount > 0 ? totalWeight / matchCount : 0;

    return matchRatio * avgWeight / 2; // 归一化到 0-1
  }

  /**
   * 应用过滤器
   */
  private applyFilters(
    results: HybridSearchResult[],
    filter: NonNullable<SearchQuery['filter']>
  ): HybridSearchResult[] {
    let filtered = results;

    // 文件类型过滤
    if (filter.fileTypes && filter.fileTypes.length > 0) {
      const extensions = new Set(filter.fileTypes);
      filtered = filtered.filter(r => {
        const ext = r.chunk.filePath.split('.').pop();
        return ext && extensions.has(ext);
      });
    }

    // 排除文件
    if (filter.excludeFiles && filter.excludeFiles.length > 0) {
      const excludeSet = new Set(filter.excludeFiles);
      filtered = filtered.filter(r => !excludeSet.has(r.chunk.filePath));
    }

    // 复杂度过滤
    if (filter.minComplexity !== undefined) {
      filtered = filtered.filter(r => (r.chunk.complexity || 0) >= filter.minComplexity!);
    }

    if (filter.maxComplexity !== undefined) {
      filtered = filtered.filter(r => (r.chunk.complexity || 0) <= filter.maxComplexity!);
    }

    return filtered;
  }

  /**
   * 构建关键词索引
   */
  async buildKeywordIndex(chunks: CodeChunk[]): Promise<void> {
    console.log(`[HybridSearch] Building keyword index for ${chunks.length} chunks`);
    
    this.keywordIndex.clear();
    this.chunkCache.clear();

    for (const chunk of chunks) {
      // 缓存 chunk
      this.chunkCache.set(chunk.id, chunk);

      // 提取关键词
      const text = `${chunk.name || chunk.functionName || ''} ${chunk.content}`;
      const keywords = this.extractKeywords(text);

      // 建立倒排索引
      for (const keyword of keywords) {
        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, new Set());
        }
        this.keywordIndex.get(keyword)!.add(chunk.id);
      }
    }

    console.log(`[HybridSearch] Keyword index built: ${this.keywordIndex.size} unique keywords`);
  }

  /**
   * 更新文件的索引
   */
  async updateFileIndex(filePath: string, chunks: CodeChunk[]): Promise<void> {
    // 移除旧的关键词索引
    const oldChunks = Array.from(this.chunkCache.values())
      .filter(c => c.filePath === filePath);
    
    for (const oldChunk of oldChunks) {
      this.chunkCache.delete(oldChunk.id);
      
      // 从关键词索引中移除
      for (const [keyword, chunkIds] of this.keywordIndex.entries()) {
        chunkIds.delete(oldChunk.id);
        if (chunkIds.size === 0) {
          this.keywordIndex.delete(keyword);
        }
      }
    }

    // 添加新的 chunks
    for (const chunk of chunks) {
      this.chunkCache.set(chunk.id, chunk);

      const text = `${chunk.name || chunk.functionName || ''} ${chunk.content}`;
      const keywords = this.extractKeywords(text);

      for (const keyword of keywords) {
        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, new Set());
        }
        this.keywordIndex.get(keyword)?.add(chunk.id);
      }
    }

    console.log(`[HybridSearch] Updated index for: ${filePath}`);
  }

  /**
   * 获取搜索统计
   */
  getStats(): SearchStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalSearches: 0,
      avgResponseTime: 0,
      strategyHits: {
        vector: 0,
        keyword: 0,
        dependency: 0,
      },
    };
  }

  /**
   * 更新统计
   */
  private updateStats(duration: number): void {
    // 更新平均响应时间
    const prevTotal = this.stats.avgResponseTime * (this.stats.totalSearches - 1);
    this.stats.avgResponseTime = (prevTotal + duration) / this.stats.totalSearches;
  }

  /**
   * 解释搜索结果（用于调试和理解）
   */
  explainSearch(results: HybridSearchResult[]): string {
    let explanation = `# Hybrid Search Explanation\n\n`;
    
    explanation += `**Results**: ${results.length}\n\n`;
    
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const result = results[i];
      if (!result) continue;
      const chunkName = result.chunk.name || result.chunk.functionName || 'anonymous';
      explanation += `## ${i + 1}. ${chunkName} (${result.chunk.filePath})\n`;
      explanation += `**Overall Score**: ${result.score.toFixed(4)}\n`;
      explanation += `**Matched By**: ${result.matchedBy.join(', ')}\n`;
      explanation += `**Detailed Scores**:\n`;
      
      if (result.scores?.vector !== undefined) {
        explanation += `  - Vector: ${result.scores.vector.toFixed(4)}\n`;
      }
      if (result.scores?.keyword !== undefined) {
        explanation += `  - Keyword: ${result.scores.keyword.toFixed(4)}\n`;
      }
      if (result.scores?.dependency !== undefined) {
        explanation += `  - Dependency: ${result.scores.dependency.toFixed(4)}\n`;
      }
      if (result.scores?.rrf !== undefined) {
        explanation += `  - RRF: ${result.scores.rrf.toFixed(4)}\n`;
      }
      explanation += `\n`;
    }

    return explanation;
  }
}

/**
 * 便捷工厂函数
 */
export function createHybridSearchEngine(
  vectorStore: EnhancedVectorStore,
  dependencyGraph: DependencyGraphBuilder
): HybridSearchEngine {
  return new HybridSearchEngine(vectorStore, dependencyGraph);
}

/**
 * RRF 算法详解
 * 
 * Reciprocal Rank Fusion 是一种强大的多源融合算法，
 * 最早由 Cormack, Clarke, and Buettcher (2009) 提出。
 * 
 * 关键特点：
 * 1. 不需要归一化分数 - 只使用排名
 * 2. 对异常值鲁棒 - 不会因为某个策略的极端分数而失衡
 * 3. 简单高效 - 计算复杂度低
 * 
 * 参数选择：
 * - K = 60: 经验值，在多个任务上表现良好
 * - 可以根据具体场景调整（K越大，排名影响越小）
 * 
 * 对比其他融合方法：
 * - Simple Average: 简单但受分数尺度影响
 * - Weighted Sum: 需要仔细调整权重
 * - Borda Count: 只考虑排名，忽略分数信息
 * - RRF: 平衡了排名和权重，最实用
 */







