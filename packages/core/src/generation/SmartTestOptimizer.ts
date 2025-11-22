/**
 * SmartTestOptimizer - 智能测试生成优化器
 * 
 * 功能特性：
 * 1. 智能测试用例去重
 * 2. 测试优先级排序
 * 3. 边界值自动识别
 * 4. 测试场景智能推荐
 * 5. Mock数据智能生成
 */

import type { TestSuite, TestCase, FunctionContext, CodeChunk } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import { LLMService } from '../llm/LLMService';
import { VectorStore } from '../db/VectorStore';
import { generateUUID } from '@testmind/shared';

const logger = createComponentLogger('SmartTestOptimizer');

export interface OptimizationOptions {
  enableDeduplication?: boolean;
  enablePrioritization?: boolean;
  enableBoundaryValueAnalysis?: boolean;
  enableScenarioRecommendation?: boolean;
  enableSmartMocking?: boolean;
  maxTestCases?: number;
  targetCoverage?: number;
}

export interface OptimizationResult {
  originalCount: number;
  optimizedCount: number;
  removedDuplicates: number;
  addedBoundaryTests: number;
  recommendedScenarios: TestScenario[];
  coverage: number;
  optimizationTime: number;
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  testCases: TestCase[];
  coverage: string[];
}

export interface BoundaryValue {
  parameter: string;
  type: string;
  boundaries: {
    min?: any;
    max?: any;
    edge?: any[];
    special?: any[];
  };
}

export class SmartTestOptimizer {
  private llm: LLMService;
  private vectorStore: VectorStore;

  constructor(llm: LLMService, vectorStore: VectorStore) {
    this.llm = llm;
    this.vectorStore = vectorStore;
    logger.info('SmartTestOptimizer initialized');
  }

  /**
   * 优化测试套件
   */
  async optimizeTestSuite(
    suite: TestSuite,
    context: FunctionContext,
    options: OptimizationOptions = {}
  ): Promise<{ suite: TestSuite; result: OptimizationResult }> {
    const startTime = Date.now();
    logger.info('Starting test suite optimization', {
      suiteId: suite.id,
      originalTestCount: suite.tests?.length || 0,
      options
    });

    const opts = {
      enableDeduplication: true,
      enablePrioritization: true,
      enableBoundaryValueAnalysis: true,
      enableScenarioRecommendation: true,
      enableSmartMocking: true,
      maxTestCases: 50,
      targetCoverage: 90,
      ...options
    };

    let optimizedTests = [...(suite.tests || [])];
    const result: OptimizationResult = {
      originalCount: optimizedTests.length,
      optimizedCount: 0,
      removedDuplicates: 0,
      addedBoundaryTests: 0,
      recommendedScenarios: [],
      coverage: 0,
      optimizationTime: 0
    };

    // Step 1: 去重
    if (opts.enableDeduplication) {
      const beforeCount = optimizedTests.length;
      optimizedTests = await this.deduplicateTests(optimizedTests);
      result.removedDuplicates = beforeCount - optimizedTests.length;
      logger.debug('Deduplication complete', { removed: result.removedDuplicates });
    }

    // Step 2: 边界值分析
    if (opts.enableBoundaryValueAnalysis) {
      const boundaryTests = await this.generateBoundaryValueTests(context);
      optimizedTests.push(...boundaryTests);
      result.addedBoundaryTests = boundaryTests.length;
      logger.debug('Boundary value analysis complete', { added: boundaryTests.length });
    }

    // Step 3: 优先级排序
    if (opts.enablePrioritization) {
      optimizedTests = await this.prioritizeTests(optimizedTests, context);
      logger.debug('Test prioritization complete');
    }

    // Step 4: 场景推荐
    if (opts.enableScenarioRecommendation) {
      result.recommendedScenarios = await this.recommendTestScenarios(context);
      logger.debug('Scenario recommendation complete', { 
        scenarios: result.recommendedScenarios.length 
      });
    }

    // Step 5: 智能Mock生成
    if (opts.enableSmartMocking) {
      optimizedTests = await this.enhanceWithSmartMocks(optimizedTests, context);
      logger.debug('Smart mock generation complete');
    }

    // Step 6: 限制测试数量
    if (opts.maxTestCases && optimizedTests.length > opts.maxTestCases) {
      optimizedTests = optimizedTests.slice(0, opts.maxTestCases);
      logger.debug('Test count limited', { max: opts.maxTestCases });
    }

    // Calculate coverage
    result.coverage = await this.estimateCoverage(optimizedTests, context);
    result.optimizedCount = optimizedTests.length;
    result.optimizationTime = Date.now() - startTime;

    const optimizedSuite: TestSuite = {
      ...suite,
      tests: optimizedTests,
      metadata: {
        ...suite.metadata,
        optimized: true,
        optimizationResult: result
      }
    };

    logger.info('Test suite optimization complete', result);
    return { suite: optimizedSuite, result };
  }

  /**
   * 去除重复的测试用例
   */
  private async deduplicateTests(tests: TestCase[]): Promise<TestCase[]> {
    const seen = new Set<string>();
    const unique: TestCase[] = [];

    for (const test of tests) {
      // Create a signature for the test
      const signature = this.createTestSignature(test);
      
      if (!seen.has(signature)) {
        seen.add(signature);
        unique.push(test);
      }
    }

    return unique;
  }

  /**
   * 创建测试签名用于去重
   */
  private createTestSignature(test: TestCase): string {
    // Combine name, input, and expected output to create signature
    const parts = [
      test.name.toLowerCase().replace(/\s+/g, ''),
      JSON.stringify(test.input || ''),
      JSON.stringify(test.expectedOutput || '')
    ];
    return parts.join('|');
  }

  /**
   * 生成边界值测试
   */
  private async generateBoundaryValueTests(context: FunctionContext): Promise<TestCase[]> {
    const boundaryTests: TestCase[] = [];
    const boundaries = await this.analyzeBoundaryValues(context);

    for (const boundary of boundaries) {
      // Generate tests for each boundary value
      if (boundary.boundaries.min !== undefined) {
        boundaryTests.push(this.createBoundaryTest(
          context.signature.name,
          boundary.parameter,
          boundary.boundaries.min,
          'minimum'
        ));
      }

      if (boundary.boundaries.max !== undefined) {
        boundaryTests.push(this.createBoundaryTest(
          context.signature.name,
          boundary.parameter,
          boundary.boundaries.max,
          'maximum'
        ));
      }

      // Edge cases
      for (const edge of boundary.boundaries.edge || []) {
        boundaryTests.push(this.createBoundaryTest(
          context.signature.name,
          boundary.parameter,
          edge,
          'edge'
        ));
      }

      // Special values
      for (const special of boundary.boundaries.special || []) {
        boundaryTests.push(this.createBoundaryTest(
          context.signature.name,
          boundary.parameter,
          special,
          'special'
        ));
      }
    }

    return boundaryTests;
  }

  /**
   * 分析函数参数的边界值
   */
  private async analyzeBoundaryValues(context: FunctionContext): Promise<BoundaryValue[]> {
    const boundaries: BoundaryValue[] = [];

    for (const param of context.signature.parameters) {
      const boundary: BoundaryValue = {
        parameter: param.name,
        type: param.type || 'unknown',
        boundaries: {}
      };

      // Analyze based on type
      switch (param.type) {
        case 'number':
        case 'int':
        case 'float':
          boundary.boundaries = {
            min: 0,
            max: Number.MAX_SAFE_INTEGER,
            edge: [-1, 0, 1],
            special: [NaN, Infinity, -Infinity]
          };
          break;

        case 'string':
          boundary.boundaries = {
            edge: ['', ' ', '\n', '\t'],
            special: [null, undefined, '\\', '"', "'"]
          };
          break;

        case 'array':
          boundary.boundaries = {
            edge: [[], [null], [undefined]],
            special: [null, undefined]
          };
          break;

        case 'boolean':
          boundary.boundaries = {
            edge: [true, false],
            special: [null, undefined, 0, 1, '']
          };
          break;
      }

      if (Object.keys(boundary.boundaries).length > 0) {
        boundaries.push(boundary);
      }
    }

    return boundaries;
  }

  /**
   * 创建边界值测试用例
   */
  private createBoundaryTest(
    functionName: string,
    paramName: string,
    value: any,
    type: string
  ): TestCase {
    return {
      id: generateUUID(),
      name: `Test ${functionName} with ${type} ${paramName}: ${JSON.stringify(value)}`,
      input: { [paramName]: value },
      expectedOutput: null, // Will be determined by test execution
      type: 'boundary',
      priority: 'high',
      metadata: {
        generatedBy: 'SmartTestOptimizer',
        boundaryType: type,
        parameter: paramName
      }
    } as TestCase;
  }

  /**
   * 根据重要性对测试进行优先级排序
   */
  private async prioritizeTests(
    tests: TestCase[],
    context: FunctionContext
  ): Promise<TestCase[]> {
    // Score each test based on various factors
    const scoredTests = tests.map(test => {
      let score = 0;

      // Priority based on test type
      if (test.type === 'boundary') score += 30;
      if (test.type === 'error') score += 25;
      if (test.type === 'happy') score += 20;
      if (test.type === 'edge') score += 15;

      // Priority based on explicitly set priority
      if (test.priority === 'critical') score += 40;
      if (test.priority === 'high') score += 30;
      if (test.priority === 'medium') score += 20;
      if (test.priority === 'low') score += 10;

      // Priority based on side effects coverage
      if (context.sideEffects && context.sideEffects.length > 0) {
        if (test.name.toLowerCase().includes('side effect')) score += 15;
      }

      return { test, score };
    });

    // Sort by score (highest first)
    scoredTests.sort((a, b) => b.score - a.score);

    return scoredTests.map(item => item.test);
  }

  /**
   * 推荐测试场景
   */
  private async recommendTestScenarios(context: FunctionContext): Promise<TestScenario[]> {
    const scenarios: TestScenario[] = [];

    // Happy path scenario
    scenarios.push({
      id: generateUUID(),
      name: 'Happy Path',
      description: 'Normal execution with valid inputs',
      priority: 'high',
      testCases: [],
      coverage: ['normal flow', 'valid inputs']
    });

    // Error handling scenario
    if (context.signature.throws || context.sideEffects?.some(s => s.type === 'throws')) {
      scenarios.push({
        id: generateUUID(),
        name: 'Error Handling',
        description: 'Test error conditions and exception handling',
        priority: 'critical',
        testCases: [],
        coverage: ['error handling', 'exceptions']
      });
    }

    // Edge cases scenario
    scenarios.push({
      id: generateUUID(),
      name: 'Edge Cases',
      description: 'Boundary values and special conditions',
      priority: 'high',
      testCases: [],
      coverage: ['boundary values', 'edge conditions']
    });

    // Side effects scenario
    if (context.sideEffects && context.sideEffects.length > 0) {
      scenarios.push({
        id: generateUUID(),
        name: 'Side Effects',
        description: 'Test side effects and state changes',
        priority: 'medium',
        testCases: [],
        coverage: context.sideEffects.map(s => s.type)
      });
    }

    // Performance scenario
    if (context.complexity && context.complexity.cyclomaticComplexity > 10) {
      scenarios.push({
        id: generateUUID(),
        name: 'Performance',
        description: 'Test performance with large inputs',
        priority: 'low',
        testCases: [],
        coverage: ['performance', 'scalability']
      });
    }

    return scenarios;
  }

  /**
   * 增强测试用例的Mock数据
   */
  private async enhanceWithSmartMocks(
    tests: TestCase[],
    context: FunctionContext
  ): Promise<TestCase[]> {
    const enhanced: TestCase[] = [];

    for (const test of tests) {
      const enhancedTest = { ...test };

      // Generate smart mocks for dependencies
      if (context.dependencies && context.dependencies.length > 0) {
        enhancedTest.mocks = await this.generateSmartMocks(context.dependencies);
      }

      // Generate realistic test data
      if (!enhancedTest.input || Object.keys(enhancedTest.input).length === 0) {
        enhancedTest.input = await this.generateRealisticInput(context);
      }

      enhanced.push(enhancedTest);
    }

    return enhanced;
  }

  /**
   * 生成智能Mock数据
   */
  private async generateSmartMocks(dependencies: string[]): Promise<any> {
    const mocks: any = {};

    for (const dep of dependencies) {
      // Generate mock based on dependency type
      if (dep.includes('database') || dep.includes('db')) {
        mocks[dep] = {
          query: jest.fn().mockResolvedValue([]),
          insert: jest.fn().mockResolvedValue({ id: 1 }),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          delete: jest.fn().mockResolvedValue({ affected: 1 })
        };
      } else if (dep.includes('http') || dep.includes('api')) {
        mocks[dep] = {
          get: jest.fn().mockResolvedValue({ data: {} }),
          post: jest.fn().mockResolvedValue({ data: { success: true } }),
          put: jest.fn().mockResolvedValue({ data: { updated: true } }),
          delete: jest.fn().mockResolvedValue({ data: { deleted: true } })
        };
      } else if (dep.includes('file') || dep.includes('fs')) {
        mocks[dep] = {
          readFile: jest.fn().mockResolvedValue('content'),
          writeFile: jest.fn().mockResolvedValue(undefined),
          exists: jest.fn().mockResolvedValue(true)
        };
      } else {
        // Generic mock
        mocks[dep] = jest.fn();
      }
    }

    return mocks;
  }

  /**
   * 生成真实的测试输入数据
   */
  private async generateRealisticInput(context: FunctionContext): Promise<any> {
    const input: any = {};

    for (const param of context.signature.parameters) {
      switch (param.type) {
        case 'string':
          input[param.name] = this.generateRealisticString(param.name);
          break;
        case 'number':
        case 'int':
          input[param.name] = this.generateRealisticNumber(param.name);
          break;
        case 'boolean':
          input[param.name] = Math.random() > 0.5;
          break;
        case 'array':
          input[param.name] = this.generateRealisticArray(param.name);
          break;
        case 'object':
          input[param.name] = this.generateRealisticObject(param.name);
          break;
        default:
          input[param.name] = null;
      }
    }

    return input;
  }

  /**
   * 生成真实的字符串数据
   */
  private generateRealisticString(paramName: string): string {
    const lowerName = paramName.toLowerCase();

    if (lowerName.includes('email')) return 'test@example.com';
    if (lowerName.includes('name')) return 'John Doe';
    if (lowerName.includes('phone')) return '+1234567890';
    if (lowerName.includes('url')) return 'https://example.com';
    if (lowerName.includes('id')) return 'id_123456';
    if (lowerName.includes('token')) return 'token_abc123xyz';
    if (lowerName.includes('password')) return 'SecureP@ss123';
    if (lowerName.includes('username')) return 'johndoe';
    if (lowerName.includes('address')) return '123 Main St, City, Country';
    if (lowerName.includes('description')) return 'This is a test description';

    return 'test_string';
  }

  /**
   * 生成真实的数字数据
   */
  private generateRealisticNumber(paramName: string): number {
    const lowerName = paramName.toLowerCase();

    if (lowerName.includes('age')) return 25;
    if (lowerName.includes('price')) return 99.99;
    if (lowerName.includes('quantity')) return 10;
    if (lowerName.includes('count')) return 5;
    if (lowerName.includes('size')) return 100;
    if (lowerName.includes('limit')) return 50;
    if (lowerName.includes('offset')) return 0;
    if (lowerName.includes('page')) return 1;
    if (lowerName.includes('year')) return 2024;
    if (lowerName.includes('month')) return 6;
    if (lowerName.includes('day')) return 15;

    return 42;
  }

  /**
   * 生成真实的数组数据
   */
  private generateRealisticArray(paramName: string): any[] {
    const lowerName = paramName.toLowerCase();

    if (lowerName.includes('tags')) return ['tag1', 'tag2', 'tag3'];
    if (lowerName.includes('ids')) return [1, 2, 3];
    if (lowerName.includes('items')) return [{ id: 1 }, { id: 2 }];
    if (lowerName.includes('users')) return [{ name: 'User1' }, { name: 'User2' }];
    if (lowerName.includes('options')) return ['option1', 'option2'];

    return [1, 2, 3];
  }

  /**
   * 生成真实的对象数据
   */
  private generateRealisticObject(paramName: string): any {
    const lowerName = paramName.toLowerCase();

    if (lowerName.includes('user')) {
      return {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      };
    }

    if (lowerName.includes('config') || lowerName.includes('options')) {
      return {
        enabled: true,
        timeout: 5000,
        retries: 3
      };
    }

    if (lowerName.includes('data')) {
      return {
        value: 'test',
        timestamp: Date.now()
      };
    }

    return { key: 'value' };
  }

  /**
   * 估算测试覆盖率
   */
  private async estimateCoverage(tests: TestCase[], context: FunctionContext): Promise<number> {
    if (!tests || tests.length === 0) return 0;

    let coveredAspects = 0;
    const totalAspects = 10; // Base aspects to cover

    // Check happy path coverage
    if (tests.some(t => t.type === 'happy' || t.name.includes('valid'))) {
      coveredAspects += 2;
    }

    // Check error handling coverage
    if (tests.some(t => t.type === 'error' || t.name.includes('error'))) {
      coveredAspects += 2;
    }

    // Check boundary value coverage
    if (tests.some(t => t.type === 'boundary' || t.name.includes('boundary'))) {
      coveredAspects += 2;
    }

    // Check edge case coverage
    if (tests.some(t => t.type === 'edge' || t.name.includes('edge'))) {
      coveredAspects += 1;
    }

    // Check null/undefined handling
    if (tests.some(t => 
      JSON.stringify(t.input).includes('null') || 
      JSON.stringify(t.input).includes('undefined')
    )) {
      coveredAspects += 1;
    }

    // Check side effects coverage
    if (context.sideEffects && context.sideEffects.length > 0) {
      const sideEffectTests = tests.filter(t => 
        t.name.toLowerCase().includes('side effect') ||
        t.name.toLowerCase().includes('mock')
      );
      if (sideEffectTests.length > 0) {
        coveredAspects += 1;
      }
    }

    // Check parameter coverage
    const paramsCovered = context.signature.parameters.filter(p =>
      tests.some(t => t.input && t.input[p.name] !== undefined)
    );
    if (paramsCovered.length === context.signature.parameters.length) {
      coveredAspects += 1;
    }

    return Math.min(100, Math.round((coveredAspects / totalAspects) * 100));
  }

  /**
   * 基于历史测试结果学习优化策略
   */
  async learnFromHistory(testResults: TestRunResult[]): Promise<void> {
    logger.info('Learning from test history', { 
      resultsCount: testResults.length 
    });

    // Analyze patterns in failed tests
    const failedTests = testResults.filter(r => r.status === 'failed');
    const patterns = this.analyzeFailurePatterns(failedTests);

    // Store patterns for future optimization
    await this.storeOptimizationPatterns(patterns);

    logger.info('Learning complete', { 
      patternsFound: patterns.length 
    });
  }

  /**
   * 分析失败测试的模式
   */
  private analyzeFailurePatterns(failedTests: any[]): any[] {
    const patterns: any[] = [];

    // Group by failure type
    const byType = new Map<string, any[]>();
    for (const test of failedTests) {
      const type = test.error?.type || 'unknown';
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(test);
    }

    // Extract patterns
    for (const [type, tests] of byType) {
      if (tests.length >= 3) { // Minimum threshold for pattern
        patterns.push({
          type,
          frequency: tests.length,
          commonInputs: this.findCommonInputs(tests),
          recommendation: this.generateRecommendation(type, tests)
        });
      }
    }

    return patterns;
  }

  /**
   * 查找共同的输入模式
   */
  private findCommonInputs(tests: any[]): any {
    // Simplified implementation - find common keys/values
    const inputs = tests.map(t => t.input).filter(Boolean);
    if (inputs.length === 0) return {};

    const commonKeys = new Set<string>();
    const firstInput = inputs[0];
    
    for (const key in firstInput) {
      if (inputs.every(input => key in input)) {
        commonKeys.add(key);
      }
    }

    return Array.from(commonKeys);
  }

  /**
   * 生成优化建议
   */
  private generateRecommendation(type: string, tests: any[]): string {
    switch (type) {
      case 'timeout':
        return 'Consider increasing timeout or optimizing performance';
      case 'type_error':
        return 'Add type validation and boundary value tests';
      case 'null_reference':
        return 'Add null/undefined checks and defensive programming';
      default:
        return `Review ${tests.length} similar failures and add targeted tests`;
    }
  }

  /**
   * 存储优化模式供将来使用
   */
  private async storeOptimizationPatterns(patterns: any[]): Promise<void> {
    // Store in vector store for semantic search
    const chunks = patterns.map((pattern, index) => ({
      id: generateUUID(),
      filePath: 'optimization-patterns',
      chunkIndex: index,
      content: JSON.stringify(pattern),
      startLine: index,
      endLine: index + 1,
      language: 'json',
      metadata: {
        type: 'optimization-pattern',
        failureType: pattern.type,
        frequency: pattern.frequency
      }
    }));

    await this.vectorStore.insertChunks(chunks);
  }
}

// Helper type for test run results
interface TestRunResult {
  id: string;
  testId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  input?: any;
  output?: any;
}

// Workaround for jest types in generation
declare const jest: any;
