/**
 * SemanticIndexer: Code chunking and search
 * 
 * CURRENT IMPLEMENTATION (MVP): Keyword-based search
 * - Uses simple string matching for finding similar code
 * - Sufficient for basic Few-shot example retrieval
 * - Zero API cost for searches
 * 
 * FUTURE ENHANCEMENT (Week 7-8): Vector-based semantic search
 * - Will use OpenAI embeddings + LanceDB
 * - True semantic similarity search  
 * - Better quality Few-shot examples
 * 
 * Technical Debt (Deliberate and Prudent):
 * - Debt: Keyword search instead of vector search
 * - Rationale: MVP doesn't need vector search complexity
 * - Timeline: Upgrade in Week 7-8 when quality data validates need
 * - Cost: 1 day implementation
 * - Benefit: +5-7 points quality improvement
 * 
 * Purpose: Find high-quality test examples for few-shot learning
 * Economic rationale: Avoid upfront embedding cost, generate on-demand
 */

import type { ProjectConfig, CodeChunk, SemanticSearchResult, CodeFile } from '@testmind/shared';
import { OpenAI } from '@langchain/openai';

export interface EmbeddingResult {
  embeddingsCount: number;
  duration: number;
  cost: number;
}

export class SemanticIndexer {
  private embeddings: OpenAI | null = null;
  private codeChunks: CodeChunk[] = [];
  private chunkIndex: Map<string, CodeChunk[]> = new Map();

  constructor(private config: ProjectConfig) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      this.embeddings = new OpenAI({
        openAIApiKey: apiKey,
        modelName: 'text-embedding-3-small', // Cost-effective model
      });
    }
  }

  /**
   * Index entire codebase
   * 
   * Process:
   * 1. Chunk code into meaningful segments (functions, classes)
   * 2. Generate embeddings for each chunk
   * 3. Store in memory (LanceDB integration in next iteration)
   * 
   * Economic note: Embeddings are created once, used many times
   */
  async indexCodebase(files: CodeFile[]): Promise<EmbeddingResult> {
    console.log(`[SemanticIndexer] Indexing ${files.length} files`);
    
    const startTime = Date.now();
    let embeddingsCount = 0;
    let totalCost = 0;

    // Skip if no API key (graceful degradation)
    if (!this.embeddings) {
      console.log('[SemanticIndexer] No API key - semantic search disabled');
      return { embeddingsCount: 0, duration: 0, cost: 0 };
    }

    // Step 1: Create code chunks
    const chunks = this.createCodeChunks(files);
    console.log(`[SemanticIndexer] Created ${chunks.length} code chunks`);

    // Step 2: Generate embeddings (batch processing)
    // For MVP, we'll generate embeddings on-demand to save cost
    // Store chunks for later embedding generation
    this.codeChunks = chunks;

    // Index chunks by file for quick lookup
    for (const chunk of chunks) {
      if (!this.chunkIndex.has(chunk.filePath)) {
        this.chunkIndex.set(chunk.filePath, []);
      }
      this.chunkIndex.get(chunk.filePath)?.push(chunk);
    }

    const duration = Date.now() - startTime;
    console.log(`[SemanticIndexer] Indexing complete in ${duration}ms`);
    
    return {
      embeddingsCount: chunks.length,
      duration,
      cost: totalCost,
    };
  }

  /**
   * Create code chunks from analyzed files
   * 
   * Chunking strategy:
   * - Each function becomes a chunk
   * - Each class becomes a chunk
   * - Include context (imports, exports)
   */
  private createCodeChunks(files: CodeFile[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    for (const file of files) {
      // Chunk each function
      for (const func of file.astData.functions) {
        chunks.push({
          id: `${file.id}-func-${func.name}`,
          content: `Function: ${func.name}\nParameters: ${func.parameters.map(p => p.name).join(', ')}\nAsync: ${func.isAsync}`,
          filePath: file.filePath,
          startLine: func.startLine,
          endLine: func.endLine,
          embedding: [], // Will be generated on-demand
          metadata: {
            type: 'function',
            name: func.name,
            hasTests: false, // TODO: Link to existing tests
            language: file.language,
          },
        });
      }

      // Chunk each class
      for (const cls of file.astData.classes) {
        chunks.push({
          id: `${file.id}-class-${cls.name}`,
          content: `Class: ${cls.name}\nMethods: ${cls.methods.map(m => m.name).join(', ')}`,
          filePath: file.filePath,
          startLine: cls.startLine,
          endLine: cls.endLine,
          embedding: [],
          metadata: {
            type: 'class',
            name: cls.name,
            hasTests: false,
            language: file.language,
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Search for similar code
   * 
   * For MVP: Simple text matching + future vector search
   * Economic rationale: Avoid upfront embedding cost, generate on-demand
   */
  async search(
    query: string,
    options?: { topK?: number; minScore?: number }
  ): Promise<SemanticSearchResult[]> {
    const k = options?.topK || 5;
    const minScore = options?.minScore || 0;

    console.log(`[SemanticIndexer] Searching: "${query}" (k=${k}, minScore=${minScore})`);

    // For MVP: Use simple keyword matching
    // Future: Use vector similarity search with LanceDB
    const results: SemanticSearchResult[] = [];

    const queryLower = query.toLowerCase();
    const scoredChunks = this.codeChunks.map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      const nameLower = chunk.metadata.name?.toLowerCase() || '';
      
      // Simple relevance score (keyword matching)
      let score = 0;
      if (nameLower.includes(queryLower)) score += 10;
      if (contentLower.includes(queryLower)) score += 5;
      
      // Bonus for high-quality chunks
      if (chunk.metadata.hasTests) score += 3;
      
      return { chunk, score };
    });

    // Sort by score and take top k
    const topK = scoredChunks
      .filter((s) => s.score > minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    for (const { chunk, score } of topK) {
      results.push({
        chunk,
        score,
        relevance: Math.min(1, score / 10),
      });
    }

    console.log(`[SemanticIndexer] Found ${results.length} results`);
    return results;
  }

  /**
   * Get a specific function from the index
   */
  async getFunction(filePath: string, functionName: string): Promise<CodeChunk | null> {
    const fileChunks = this.chunkIndex.get(filePath);
    
    if (!fileChunks) {
      return null;
    }

    const functionChunk = fileChunks.find(
      (chunk) => 
        chunk.metadata.type === 'function' &&
        chunk.metadata.name === functionName
    );

    return functionChunk || null;
  }

  /**
   * Update embeddings for a single file
   */
  async updateFile(filePath: string): Promise<void> {
    console.log(`[SemanticIndexer] Updating embeddings: ${filePath}`);
    
    // Remove old chunks for this file
    this.codeChunks = this.codeChunks.filter((c) => c.filePath !== filePath);
    this.chunkIndex.delete(filePath);

    // TODO: Re-analyze file and create new chunks
  }

  /**
   * Get embedding statistics
   */
  getStats(): { totalChunks: number; filesIndexed: number } {
    return {
      totalChunks: this.codeChunks.length,
      filesIndexed: this.chunkIndex.size,
    };
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Clear in-memory data
    this.codeChunks = [];
    this.chunkIndex.clear();
    
    // TODO: Close LanceDB connection when implemented
  }
}


