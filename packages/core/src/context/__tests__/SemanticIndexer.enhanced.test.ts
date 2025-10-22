/**
 * SemanticIndexer 增强功能单元测试
 * 测试模糊匹配、Token 分词、同义词扩展
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticIndexer } from '../SemanticIndexer';
import type { ProjectConfig, CodeFile } from '@testmind/shared';

describe('SemanticIndexer - Enhanced Features', () => {
  let indexer: SemanticIndexer;
  const mockConfig: ProjectConfig = {
    id: 'test-project',
    name: 'Test Project',
    rootPath: '/test',
    config: {
      includePatterns: ['**/*.ts'],
      excludePatterns: ['**/node_modules/**'],
      testFramework: 'vitest',
    },
  };

  beforeEach(async () => {
    indexer = new SemanticIndexer(mockConfig);

    // 索引一些测试数据
    const mockFiles: CodeFile[] = [
      {
        filePath: '/test/src/auth/getUserName.ts',
        astData: {
          imports: [],
          exports: [],
          functions: [{
            name: 'getUserName',
            parameters: [],
            returnType: 'string',
            isAsync: false,
            isExported: true,
            startLine: 1,
            endLine: 5,
          }],
          classes: [],
        },
        metadata: { language: 'typescript' },
      },
      {
        filePath: '/test/src/auth/loginUser.ts',
        astData: {
          imports: [],
          exports: [],
          functions: [{
            name: 'loginUser',
            parameters: [],
            returnType: 'Promise<User>',
            isAsync: true,
            isExported: true,
            startLine: 1,
            endLine: 10,
          }],
          classes: [],
        },
        metadata: { language: 'typescript' },
      },
      {
        filePath: '/test/src/utils/formatNumber.ts',
        astData: {
          imports: [],
          exports: [],
          functions: [{
            name: 'formatNumber',
            parameters: [],
            returnType: 'string',
            isAsync: false,
            isExported: true,
            startLine: 1,
            endLine: 3,
          }],
          classes: [],
        },
        metadata: { language: 'typescript' },
      },
    ];

    await indexer.indexCodebase(mockFiles);
  });

  describe('Fuzzy Matching', () => {
    it('should find functions with typos', async () => {
      // 查询有拼写错误
      const results = await indexer.search('getUserNam', { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.metadata.name).toBe('getUserName');
    });

    it('should match partial names', async () => {
      const results = await indexer.search('userName', { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.metadata.name).toBe('getUserName');
    });

    it('should handle case insensitivity', async () => {
      const results = await indexer.search('GETUSERNAME', { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.metadata.name).toBe('getUserName');
    });
  });

  describe('Token-based Matching', () => {
    it('should split camelCase correctly', async () => {
      // 查询分词形式
      const results = await indexer.search('get user name', { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.metadata.name).toBe('getUserName');
    });

    it('should handle different naming conventions', async () => {
      const results = await indexer.search('user_name', { topK: 5 });

      // 应该能匹配到 getUserName（都有 user 和 name token）
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Semantic Expansion', () => {
    it('should expand authentication synonyms', async () => {
      // 使用同义词查询
      const results = await indexer.search('authentication', { topK: 5 });

      // 应该找到 loginUser（auth 和 authentication 是同义词）
      expect(results.length).toBeGreaterThan(0);
      const hasAuthRelated = results.some(r => 
        r.chunk.metadata.name?.includes('login') || 
        r.chunk.filePath.includes('auth')
      );
      expect(hasAuthRelated).toBe(true);
    });

    it('should expand test-related synonyms', async () => {
      // test 的同义词包括 spec, case, verify
      // 这些应该在搜索时被考虑
      const results1 = await indexer.search('test user', { topK: 5 });
      const results2 = await indexer.search('verify user', { topK: 5 });

      // 应该返回相似的结果
      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-factor Scoring', () => {
    it('should prioritize exact matches', async () => {
      const results = await indexer.search('loginUser', { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.metadata.name).toBe('loginUser');
      expect(results[0].relevance).toBeGreaterThan(0.8);
    });

    it('should rank by relevance', async () => {
      const results = await indexer.search('user', { topK: 5 });

      // getUserName 和 loginUser 都包含 user
      expect(results.length).toBeGreaterThan(0);
      
      // 所有结果都应该相关
      results.forEach(r => {
        expect(
          r.chunk.metadata.name?.toLowerCase().includes('user') ||
          r.chunk.filePath.toLowerCase().includes('user')
        ).toBe(true);
      });
    });

    it('should score based on multiple factors', async () => {
      const results = await indexer.search('format', { topK: 5 });

      const formatNumberResult = results.find(r => r.chunk.metadata.name === 'formatNumber');
      expect(formatNumberResult).toBeDefined();
      expect(formatNumberResult!.score).toBeGreaterThan(0);
      expect(formatNumberResult!.relevance).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const start = Date.now();
      const results = await indexer.search('function', { topK: 10 });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // 应该 < 100ms
    });

    it('should respect topK parameter', async () => {
      const results = await indexer.search('user', { topK: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should respect minScore parameter', async () => {
      const results = await indexer.search('user', { topK: 10, minScore: 10 });

      results.forEach(r => {
        expect(r.score).toBeGreaterThan(10);
      });
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
























