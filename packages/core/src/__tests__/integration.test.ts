/**
 * TestMind v1.0 Integration Test Suite
 * 综合性测试套件，确保所有核心功能正常工作
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { 
  DatabaseService,
  VectorStore,
  SmartTestOptimizer,
  AdvancedSelfHealingEngine,
  CoverageAnalyzer,
  APITestGenerator,
  LLMService,
  TestGenerator,
  ContextEngine,
  StaticAnalyzer,
  createComponentLogger
} from '../index';
import { generateUUID } from '@testmind/shared';
import * as fs from 'fs-extra';
import * as path from 'path';

const logger = createComponentLogger('IntegrationTest');

describe('TestMind v1.0 Integration Tests', () => {
  let db: DatabaseService;
  let vectorStore: VectorStore;
  let llm: LLMService;
  let contextEngine: ContextEngine;
  const testDir = '.testmind-test';

  beforeAll(async () => {
    // Setup test environment
    await fs.ensureDir(testDir);
    
    // Initialize services
    db = new DatabaseService(path.join(testDir, 'test.db'));
    await db.initialize();
    
    vectorStore = new VectorStore(path.join(testDir, 'vectors.db'));
    await vectorStore.initialize();
    
    // Mock LLM for testing
    llm = new LLMService({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4'
    });
    
    // Mock LLM responses
    vi.spyOn(llm, 'generate').mockImplementation(async () => ({
      content: 'Mocked LLM response',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
    }));
    
    logger.info('Test environment initialized');
  });

  afterAll(async () => {
    // Cleanup
    await db.close();
    await vectorStore.close();
    await fs.remove(testDir);
    logger.info('Test environment cleaned up');
  });

  describe('Database Operations', () => {
    it('should save and retrieve projects', async () => {
      const project = {
        id: generateUUID(),
        name: 'Test Project',
        repoPath: '/test/repo',
        language: 'typescript',
        testFramework: 'vitest',
        config: { testDir: '__tests__' }
      };

      await db.saveProject(project);
      const retrieved = await db.getProject(project.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(project.name);
      expect(retrieved?.config).toEqual(project.config);
    });

    it('should handle transactions correctly', async () => {
      const project = {
        id: generateUUID(),
        name: 'Transaction Test',
        repoPath: '/test/repo',
        language: 'typescript',
        testFramework: 'jest',
        config: {}
      };

      db.beginTransaction();
      try {
        await db.saveProject(project);
        db.commitTransaction();
      } catch (error) {
        db.rollbackTransaction();
        throw error;
      }

      const retrieved = await db.getProject(project.id);
      expect(retrieved).toBeDefined();
    });

    it('should calculate database statistics', async () => {
      const stats = await db.getStats();
      expect(stats).toBeDefined();
      expect(stats.projects.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Vector Store Operations', () => {
    it('should insert and search chunks', async () => {
      const chunks = [
        {
          id: generateUUID(),
          filePath: '/test/file.ts',
          chunkIndex: 0,
          content: 'function testFunction() { return true; }',
          embedding: Array(128).fill(0).map(() => Math.random()),
          startLine: 1,
          endLine: 3,
          language: 'typescript'
        },
        {
          id: generateUUID(),
          filePath: '/test/file.ts',
          chunkIndex: 1,
          content: 'class TestClass { constructor() {} }',
          embedding: Array(128).fill(0).map(() => Math.random()),
          startLine: 4,
          endLine: 6,
          language: 'typescript'
        }
      ];

      await vectorStore.insertChunks(chunks);

      // Test semantic search
      const queryEmbedding = Array(128).fill(0).map(() => Math.random());
      const results = await vectorStore.search(queryEmbedding, 2);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('score');
      expect(results[0].score).toBeGreaterThanOrEqual(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    });

    it('should perform keyword search', async () => {
      const results = await vectorStore.searchByContent('function', 5);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should get vector store statistics', async () => {
      const stats = await vectorStore.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalChunks).toBeGreaterThanOrEqual(0);
      expect(stats.totalFiles).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Smart Test Optimizer', () => {
    it('should optimize test suite', async () => {
      const optimizer = new SmartTestOptimizer(llm, vectorStore);
      
      const suite = {
        id: generateUUID(),
        projectId: 'test-project',
        tests: [
          {
            id: generateUUID(),
            name: 'Test 1',
            input: { value: 1 },
            expectedOutput: { result: true }
          },
          {
            id: generateUUID(),
            name: 'Test 1', // Duplicate
            input: { value: 1 },
            expectedOutput: { result: true }
          },
          {
            id: generateUUID(),
            name: 'Test 2',
            input: { value: 2 },
            expectedOutput: { result: false }
          }
        ]
      };

      const context = {
        signature: {
          name: 'testFunction',
          parameters: [
            { name: 'value', type: 'number' }
          ],
          returnType: 'boolean'
        }
      };

      const { suite: optimized, result } = await optimizer.optimizeTestSuite(
        suite as any,
        context as any
      );

      expect(optimized.tests?.length).toBeLessThanOrEqual(suite.tests.length);
      expect(result.removedDuplicates).toBeGreaterThan(0);
      expect(result.coverage).toBeGreaterThan(0);
    });
  });

  describe('Advanced Self-Healing Engine', () => {
    it('should heal failed tests', async () => {
      const healingEngine = new AdvancedSelfHealingEngine(
        vectorStore,
        llm,
        db
      );

      const test = {
        id: generateUUID(),
        name: 'Failed Test',
        type: 'ui'
      };

      const error = {
        type: 'element-not-found',
        message: 'Element not found: #submit-button',
        locator: '#submit-button',
        timestamp: Date.now()
      };

      const environment = {
        browser: 'chrome',
        browserVersion: '120.0',
        os: 'windows',
        timestamp: Date.now()
      };

      const result = await healingEngine.healTest(
        test as any,
        error,
        environment
      );

      expect(result).toBeDefined();
      expect(result.strategy).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should predict test failures', async () => {
      const healingEngine = new AdvancedSelfHealingEngine(
        vectorStore,
        llm,
        db
      );

      const tests = [
        {
          id: generateUUID(),
          name: 'Test 1',
          steps: Array(15).fill({ action: 'click' }),
          metadata: {
            lastModified: Date.now() - 1000 * 60 * 60,
            dependencies: ['api', 'database']
          }
        }
      ];

      const insights = await healingEngine.predictFailures(tests as any);

      expect(insights).toHaveLength(tests.length);
      expect(insights[0].riskScore).toBeGreaterThanOrEqual(0);
      expect(insights[0].riskScore).toBeLessThanOrEqual(1);
      expect(insights[0].recommendations).toBeDefined();
    });
  });

  describe('Coverage Analyzer', () => {
    it('should analyze test coverage', async () => {
      const staticAnalyzer = new StaticAnalyzer(
        { id: 'test', repoPath: testDir } as any,
        {} as any
      );
      
      const analyzer = new CoverageAnalyzer(db, staticAnalyzer);

      const testSuites = [
        {
          id: generateUUID(),
          projectId: 'test-project',
          tests: [],
          metadata: {
            coverage: {
              lines: { total: 100, covered: 80 },
              branches: { total: 20, covered: 15 },
              functions: { total: 10, covered: 8 }
            }
          }
        }
      ];

      const codeFiles = [
        {
          id: generateUUID(),
          projectId: 'test-project',
          filePath: '/test/file.ts',
          language: 'typescript',
          content: 'function test() { return true; }',
          astData: {
            functions: [
              {
                name: 'test',
                startLine: 1,
                endLine: 1,
                isExported: true
              }
            ],
            classes: [],
            imports: [],
            exports: []
          }
        }
      ];

      const report = await analyzer.analyzeCoverage(
        'test-project',
        testSuites as any,
        codeFiles as any
      );

      expect(report).toBeDefined();
      expect(report.summary.lineCoverage).toBeGreaterThanOrEqual(0);
      expect(report.summary.lineCoverage).toBeLessThanOrEqual(100);
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should generate coverage heatmap', async () => {
      const staticAnalyzer = new StaticAnalyzer(
        { id: 'test', repoPath: testDir } as any,
        {} as any
      );
      
      const analyzer = new CoverageAnalyzer(db, staticAnalyzer);

      const coverage = {
        filePath: '/test/file.ts',
        lineCoverage: 80,
        branchCoverage: 75,
        functionCoverage: 90,
        lines: [
          { lineNumber: 1, executed: true, hitCount: 5 },
          { lineNumber: 2, executed: false, hitCount: 0 },
          { lineNumber: 3, executed: true, hitCount: 3 }
        ],
        branches: [],
        functions: [],
        uncoveredRegions: []
      };

      const heatmap = await analyzer.generateHeatmap(
        '/test/file.ts',
        coverage
      );

      expect(heatmap).toBeDefined();
      expect(heatmap.heatmap).toBeDefined();
      expect(Array.isArray(heatmap.heatmap)).toBe(true);
      expect(heatmap.maxHitCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('API Test Generator', () => {
    it('should generate tests from OpenAPI spec', async () => {
      const generator = new APITestGenerator(llm);

      const openAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'http://localhost:3000' }],
        paths: {
          '/users': {
            get: {
              summary: 'Get all users',
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            post: {
              summary: 'Create user',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': { description: 'Created' }
              }
            }
          }
        }
      };

      const { suite, mockData } = await generator.generateFromOpenAPI(
        openAPISpec
      );

      expect(suite).toBeDefined();
      expect(suite.tests).toBeDefined();
      expect(suite.tests.length).toBeGreaterThan(0);
      expect(mockData).toBeDefined();
    });

    it('should generate security tests', async () => {
      const generator = new APITestGenerator(llm);

      const config = {
        baseURL: 'http://localhost:3000',
        endpoints: [
          {
            path: '/api/data',
            method: 'POST' as const,
            parameters: [
              {
                name: 'query',
                in: 'query' as const,
                schema: { type: 'string' }
              }
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      content: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        ],
        includeSecurityTests: true
      };

      const { suite } = await generator.generateAPITests(config);

      const securityTests = suite.tests?.filter(t => 
        t.metadata?.testType === 'security'
      );

      expect(securityTests).toBeDefined();
      expect(securityTests?.length).toBeGreaterThan(0);
      
      const sqlInjectionTest = securityTests?.find(t => 
        t.name.includes('SQL Injection')
      );
      expect(sqlInjectionTest).toBeDefined();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full test generation workflow', async () => {
      // Step 1: Analyze code
      const codeFile = {
        id: generateUUID(),
        projectId: 'e2e-test',
        filePath: '/test/calculator.ts',
        language: 'typescript',
        content: `
          export function add(a: number, b: number): number {
            return a + b;
          }
          
          export function subtract(a: number, b: number): number {
            return a - b;
          }
        `,
        astData: {
          functions: [
            {
              name: 'add',
              startLine: 2,
              endLine: 4,
              parameters: [
                { name: 'a', type: 'number' },
                { name: 'b', type: 'number' }
              ],
              returnType: 'number',
              isExported: true
            },
            {
              name: 'subtract',
              startLine: 6,
              endLine: 8,
              parameters: [
                { name: 'a', type: 'number' },
                { name: 'b', type: 'number' }
              ],
              returnType: 'number',
              isExported: true
            }
          ],
          classes: [],
          imports: [],
          exports: []
        }
      };

      // Step 2: Save to database
      await db.saveCodeFile(codeFile as any);

      // Step 3: Generate tests
      const testGenerator = new TestGenerator(
        { id: 'e2e-test' } as any,
        llm
      );

      const functionContext = {
        signature: {
          name: 'add',
          parameters: [
            { name: 'a', type: 'number' },
            { name: 'b', type: 'number' }
          ],
          returnType: 'number'
        },
        filePath: '/test/calculator.ts',
        dependencies: [],
        sideEffects: []
      };

      const tests = await testGenerator.generateUnitTests(functionContext as any);

      expect(tests).toBeDefined();
      expect(tests.tests).toBeDefined();
      expect(tests.tests?.length).toBeGreaterThan(0);

      // Step 4: Optimize tests
      const optimizer = new SmartTestOptimizer(llm, vectorStore);
      const { suite: optimized } = await optimizer.optimizeTestSuite(
        tests,
        functionContext as any
      );

      expect(optimized).toBeDefined();
      expect(optimized.tests).toBeDefined();

      // Step 5: Analyze coverage
      const staticAnalyzer = new StaticAnalyzer(
        { id: 'e2e-test', repoPath: testDir } as any,
        {} as any
      );
      
      const coverageAnalyzer = new CoverageAnalyzer(db, staticAnalyzer);
      const report = await coverageAnalyzer.analyzeCoverage(
        'e2e-test',
        [optimized],
        [codeFile as any]
      );

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();

      logger.info('End-to-end workflow completed successfully', {
        testsGenerated: optimized.tests?.length,
        coverage: report.summary.functionCoverage
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Generate large dataset
      const chunks = Array(1000).fill(0).map((_, i) => ({
        id: generateUUID(),
        filePath: `/test/file${i}.ts`,
        chunkIndex: 0,
        content: `function test${i}() { return ${i}; }`,
        embedding: Array(128).fill(0).map(() => Math.random()),
        startLine: 1,
        endLine: 1,
        language: 'typescript'
      }));

      // Batch insert
      await vectorStore.insertChunks(chunks);

      // Search performance
      const queryEmbedding = Array(128).fill(0).map(() => Math.random());
      const results = await vectorStore.search(queryEmbedding, 10);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toHaveLength(10);
      
      logger.info('Performance test completed', {
        chunksProcessed: chunks.length,
        duration,
        throughput: Math.round(chunks.length / (duration / 1000))
      });
    });

    it('should optimize memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process multiple operations
      for (let i = 0; i < 100; i++) {
        const project = {
          id: generateUUID(),
          name: `Project ${i}`,
          repoPath: `/test/repo${i}`,
          language: 'typescript',
          testFramework: 'jest',
          config: {}
        };
        
        await db.saveProject(project);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
      
      logger.info('Memory usage test completed', {
        memoryIncreaseMB: Math.round(memoryIncrease)
      });
    });
  });
});
