/**
 * VectorStore: Vector storage for semantic search
 * 
 * IMPROVED: Implementing vector storage using SQLite with JSON support
 * This provides a working vector storage solution without external dependencies
 */

import * as path from 'path';

import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import Database from 'better-sqlite3';
import * as fs from 'fs-extra';

import { createComponentLogger } from '../utils/logger';


const logger = createComponentLogger('VectorStore');

export class VectorStore {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath = '.testmind/vectors.db') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize vector database
   */
  async initialize(): Promise<void> {
    logger.info('Initializing vector store');
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(this.dbPath));
    
    // Open database connection
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    // Create tables
    this.createTables();
    
    logger.info('Vector store initialized successfully');
  }

  /**
   * Create database tables for vector storage
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Code chunks table with embeddings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT, -- JSON array of floats
        metadata TEXT, -- JSON object
        start_line INTEGER,
        end_line INTEGER,
        language TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(file_path, chunk_index)
      )
    `);

    // File index table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_index (
        file_path TEXT PRIMARY KEY,
        chunk_count INTEGER NOT NULL,
        last_modified INTEGER,
        file_hash TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_file_path ON code_chunks(file_path);
      CREATE INDEX IF NOT EXISTS idx_chunks_language ON code_chunks(language);
    `);
  }

  /**
   * Insert code chunks with embeddings
   */
  async insertChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.info('Inserting chunks', { count: chunks.length });
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_chunks
      (id, file_path, chunk_index, content, embedding, metadata, start_line, end_line, language, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((chunks: CodeChunk[]) => {
      for (const chunk of chunks) {
        stmt.run(
          chunk.id || generateUUID(),
          chunk.filePath,
          chunk.chunkIndex,
          chunk.content,
          JSON.stringify(chunk.embedding || []),
          JSON.stringify(chunk.metadata || {}),
          chunk.startLine,
          chunk.endLine,
          chunk.language,
          Date.now(),
        );
      }
    });

    insertMany(chunks);
    
    // Update file index
    const filePaths = [...new Set(chunks.map(c => c.filePath))];
    for (const filePath of filePaths) {
      const count = chunks.filter(c => c.filePath === filePath).length;
      this.updateFileIndex(filePath, count);
    }
    
    logger.debug('Chunks inserted successfully');
  }

  /**
   * Update file index
   */
  private updateFileIndex(filePath: string, chunkCount: number): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_index
      (file_path, chunk_count, last_modified, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(filePath, chunkCount, Date.now(), Date.now());
  }

  /**
   * Search for similar code
   */
  async search(queryEmbedding: number[], k = 5): Promise<SemanticSearchResult[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.debug('Searching for similar code', { k });
    
    // Get all chunks with embeddings
    const stmt = this.db.prepare(`
      SELECT id, file_path, chunk_index, content, embedding, metadata, start_line, end_line, language
      FROM code_chunks
      WHERE embedding IS NOT NULL AND embedding != '[]'
    `);
    
    const chunks = stmt.all() as any[];
    
    // Calculate cosine similarity for each chunk
    const results = chunks.map(chunk => {
      const embedding = JSON.parse(chunk.embedding) as number[];
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      
      return {
        id: chunk.id,
        filePath: chunk.file_path,
        content: chunk.content,
        similarity,
        metadata: JSON.parse(chunk.metadata || '{}'),
        startLine: chunk.start_line,
        endLine: chunk.end_line,
        language: chunk.language,
        chunkIndex: chunk.chunk_index,
      };
    });
    
    // Sort by similarity and return top k
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, k).map(r => ({
      chunk: {
        id: r.id,
        filePath: r.filePath,
        chunkIndex: r.chunkIndex ?? 0,
        content: r.content,
        startLine: r.startLine ?? 0,
        endLine: r.endLine ?? 0,
        embedding: [],
        metadata: r.metadata ?? {},
        language: r.language,
      },
      chunkId: r.id,
      filePath: r.filePath,
      content: r.content,
      score: r.similarity,
      relevance: r.similarity,
      metadata: r.metadata,
      startLine: r.startLine,
      endLine: r.endLine,
    }));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      const a = vec1[i] ?? 0;
      const b = vec2[i] ?? 0;
      dotProduct += a * b;
      norm1 += a * a;
      norm2 += b * b;
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    
    if (denominator === 0) {
      return 0;
    }
    
    return dotProduct / denominator;
  }

  /**
   * Update embeddings for specific files
   */
  async updateFile(filePath: string, chunks: CodeChunk[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.info('Updating embeddings for file', { filePath });
    
    // Use transaction for atomicity
    const transaction = this.db.transaction(() => {
      // Delete old embeddings
      this.db!.prepare('DELETE FROM code_chunks WHERE file_path = ?').run(filePath);
      
      // Insert new chunks
      if (chunks.length > 0) {
        this.insertChunks(chunks);
      }
    });
    
    transaction();
  }

  /**
   * Delete embeddings for a file
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.info('Deleting embeddings for file', { filePath });
    
    // Delete chunks
    const deleteChunks = this.db.prepare('DELETE FROM code_chunks WHERE file_path = ?');
    const result = deleteChunks.run(filePath);
    
    // Delete from file index
    const deleteIndex = this.db.prepare('DELETE FROM file_index WHERE file_path = ?');
    deleteIndex.run(filePath);
    
    logger.debug('Deleted embeddings', { filePath, chunksDeleted: result.changes });
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{ totalChunks: number; totalFiles: number; avgChunksPerFile: number }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const chunkCount = this.db.prepare('SELECT COUNT(*) as count FROM code_chunks').get() as any;
    const fileCount = this.db.prepare('SELECT COUNT(*) as count FROM file_index').get() as any;
    
    const avgChunksPerFile = fileCount.count > 0 
      ? Math.round(chunkCount.count / fileCount.count * 10) / 10 
      : 0;
    
    return {
      totalChunks: chunkCount.count,
      totalFiles: fileCount.count,
      avgChunksPerFile,
    };
  }

  /**
   * Search by content (keyword search)
   */
  async searchByContent(query: string, k = 10): Promise<SemanticSearchResult[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.debug('Searching by content', { query, k });
    
    const stmt = this.db.prepare(`
      SELECT id, file_path, chunk_index, content, metadata, start_line, end_line, language
      FROM code_chunks
      WHERE content LIKE ?
      LIMIT ?
    `);
    
    const chunks = stmt.all(`%${query}%`, k) as any[];
    
    return chunks.map(chunk => {
      const metadata = JSON.parse(chunk.metadata || '{}');
      const normalizedChunk: CodeChunk = {
        id: chunk.id,
        filePath: chunk.file_path,
        chunkIndex: chunk.chunk_index ?? 0,
        content: chunk.content,
        startLine: chunk.start_line ?? 0,
        endLine: chunk.end_line ?? 0,
        embedding: [],
        metadata,
        language: chunk.language,
      };

      return {
        chunk: normalizedChunk,
        chunkId: chunk.id,
        filePath: chunk.file_path,
        content: chunk.content,
        score: 1.0,
        relevance: 1.0,
        metadata,
        startLine: chunk.start_line,
        endLine: chunk.end_line,
      };
    });
  }

  /**
   * Get chunks by file path
   */
  async getChunksByFile(filePath: string): Promise<CodeChunk[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM code_chunks
      WHERE file_path = ?
      ORDER BY chunk_index
    `);
    
    const rows = stmt.all(filePath) as any[];
    
    return rows.map(row => ({
      id: row.id,
      filePath: row.file_path,
      chunkIndex: row.chunk_index,
      content: row.content,
      embedding: JSON.parse(row.embedding || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      startLine: row.start_line,
      endLine: row.end_line,
      language: row.language,
    } as CodeChunk));
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.warn('Clearing all vector store data');
    
    this.db.exec('DELETE FROM code_chunks');
    this.db.exec('DELETE FROM file_index');
    
    logger.info('Vector store cleared');
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    logger.info('Closing vector store connection');
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

























