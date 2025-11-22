/**
 * HealingEngine - 自愈引擎
 * 
 * 统一协调整个测试自愈流程：
 * 1. 失败分析
 * 2. 失败分类
 * 3. 生成修复建议
 * 4. 应用修复（Diff-First）
 * 5. 验证修复
 */

import { LocatorEngine } from './LocatorEngine';
import { FailureClassifier, type TestFailure, type ClassificationResult } from './FailureClassifier';
import { FailureAnalyzer, type FailureContext, type AnalysisResult } from './FailureAnalyzer';
import { FixSuggester, type FixSuggestion, type FixContext } from './FixSuggester';
import type { LLMService } from '../llm/LLMService';
import { createComponentLogger } from '../utils/logger';
import { metrics, MetricNames } from '../utils/metrics';

const logger = createComponentLogger('HealingEngine');

export interface HealingConfig {
  enableAutoHealing?: boolean;
  enableLLMEnhancement?: boolean;
  maxHealingAttempts?: number;
  confidenceThreshold?: number;
  llmService?: LLMService;
}

export interface HealingRequest {
  testFailure: TestFailure;
  testCode: string;
  context?: any; // Page/Browser context from test framework
}

export interface HealingResult {
  success: boolean;
  healingApplied: boolean;
  analysis: AnalysisResult;
  classification: ClassificationResult;
  suggestions: FixSuggestion[];
  appliedSuggestion?: FixSuggestion;
  error?: string;
  metadata: {
    startTime: Date;
    endTime: Date;
    duration: number;
    attempts: number;
  };
}

export interface FailedTestInfo {
  testName: string;
  testFile: string;
  error: Error;
  testCode: string;
  context?: any;
}

/**
 * 自愈引擎
 */
export class HealingEngine {
  private locatorEngine: LocatorEngine;
  private failureClassifier: FailureClassifier;
  private failureAnalyzer: FailureAnalyzer;
  private fixSuggester: FixSuggester;
  private config: Required<Omit<HealingConfig, 'llmService'>> & { llmService?: LLMService };

  constructor(config: HealingConfig = {}) {
    this.config = {
      enableAutoHealing: config.enableAutoHealing ?? false,
      enableLLMEnhancement: config.enableLLMEnhancement ?? true,
      maxHealingAttempts: config.maxHealingAttempts ?? 3,
      confidenceThreshold: config.confidenceThreshold ?? 0.8,
      llmService: config.llmService,
    };

    // 初始化各个组件
    this.locatorEngine = new LocatorEngine({
      enableVisualMatching: true,
      enableSemanticMatching: config.enableLLMEnhancement,
      llmService: config.llmService,
    });

    this.failureClassifier = new FailureClassifier(config.llmService);
    this.failureAnalyzer = new FailureAnalyzer();
    this.fixSuggester = new FixSuggester(config.llmService);

    logger.info('HealingEngine initialized', {
      autoHealing: this.config.enableAutoHealing,
      llmEnhanced: this.config.enableLLMEnhancement,
    });
  }

  /**
   * 主要的自愈方法
   */
  async healTest(request: HealingRequest): Promise<HealingResult> {
    const startTime = new Date();
    const attempts = 0;

    logger.info('Starting test healing', {
      testName: request.testFailure.testName,
      error: request.testFailure.errorMessage,
    });

    // 记录指标
    metrics.incrementCounter(MetricNames.HEALING_ATTEMPTS, 1, {
      testName: request.testFailure.testName,
    });

    try {
      // 步骤 1: 分析失败上下文
      logger.debug('Step 1: Analyzing failure context');
      const failureContext = await this.collectFailureContext(
        request.testFailure,
        request.testCode,
        request.context
      );

      const analysis = await this.failureAnalyzer.analyzeFailure(failureContext);

      // 步骤 2: 分类失败类型
      logger.debug('Step 2: Classifying failure type');
      const classification = await this.failureClassifier.classify(
        request.testFailure
      );

      logger.info('Failure classified', {
        type: classification.failureType,
        confidence: classification.confidence,
        isFlaky: classification.isFlaky,
      });

      // 步骤 3: 生成修复建议
      logger.debug('Step 3: Generating fix suggestions');
      const fixContext: FixContext = {
        testCode: request.testCode,
        currentSelector: request.testFailure.selector,
        failureClassification: classification,
      };

      // 如果是选择器问题，尝试查找替代选择器
      if (
        classification.failureType === 'test_fragility' as any &&
        request.testFailure.selector
      ) {
        const alternativeSelectors = await this.findAlternativeSelectors(
          request.testFailure.selector,
          request.context
        );
        fixContext.alternativeSelectors = alternativeSelectors;
      }

      const suggestions = await this.fixSuggester.suggestFixes(
        request.testFailure,
        fixContext
      );

      logger.info(`Generated ${suggestions.length} fix suggestions`);

      // 步骤 4: 应用修复（如果启用自动修复）
      let appliedSuggestion: FixSuggestion | undefined;
      let healingApplied = false;

      if (
        this.config.enableAutoHealing &&
        suggestions.length > 0 &&
        suggestions[0] &&
        suggestions[0].confidence >= this.config.confidenceThreshold
      ) {
        logger.info('Auto-healing enabled, applying top suggestion');
        appliedSuggestion = suggestions[0];
        healingApplied = await this.applySuggestion(
          appliedSuggestion,
          request.testCode
        );

        if (healingApplied && appliedSuggestion) {
          metrics.incrementCounter(MetricNames.HEALING_SUCCESS, 1, {
            fixType: appliedSuggestion.type,
          });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // 记录自愈时长
      metrics.recordHistogram(MetricNames.HEALING_DURATION, duration);

      const result: HealingResult = {
        success: suggestions.length > 0,
        healingApplied,
        analysis,
        classification,
        suggestions,
        appliedSuggestion,
        metadata: {
          startTime,
          endTime,
          duration,
          attempts: attempts + 1,
        },
      };

      logger.info('Healing complete', {
        success: result.success,
        healingApplied: result.healingApplied,
        suggestions: suggestions.length,
        duration,
      });

      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      logger.error('Healing failed', { error });

      metrics.incrementCounter(MetricNames.HEALING_FAILURES, 1);

      return {
        success: false,
        healingApplied: false,
        analysis: {
          errorMessage: request.testFailure.errorMessage,
          errorType: 'Unknown',
          possibleCauses: [],
          contextData: {},
        } as AnalysisResult,
        classification: {
          failureType: 'unknown',
          confidence: 0,
          reasoning: 'Healing engine error',
          suggestedActions: [],
          isFlaky: false,
        } as ClassificationResult,
        suggestions: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          startTime,
          endTime,
          duration,
          attempts: attempts + 1,
        },
      };
    }
  }

  /**
   * 收集失败上下文
   */
  private async collectFailureContext(
    failure: TestFailure,
    testCode: string,
    context?: any
  ): Promise<FailureContext> {
    return this.failureAnalyzer.collectFailureContext(
      {
        name: failure.testName,
        message: failure.errorMessage,
        stack: failure.stackTrace,
      } as Error,
      testCode,
      failure.testName,
      context
    );
  }

  /**
   * 查找替代选择器
   */
  private async findAlternativeSelectors(
    failedSelector: string,
    context?: any
  ): Promise<any[]> {
    try {
      // 解析失败的选择器
      const descriptor = this.parseSelector(failedSelector);

      // 使用 LocatorEngine 建议替代方案
      const suggestions = await this.locatorEngine.suggestAlternativeLocators(
        descriptor,
        context
      );

      logger.debug(`Found ${suggestions.length} alternative selectors`);

      return suggestions;
    } catch (error) {
      logger.warn('Failed to find alternative selectors', { error });
      return [];
    }
  }

  /**
   * 解析选择器字符串为 ElementDescriptor
   */
  private parseSelector(selector: string): any {
    // 简单的解析逻辑
    if (selector.startsWith('#')) {
      return { id: selector.substring(1) };
    } else if (selector.startsWith('//')) {
      return { xpath: selector };
    } else {
      return { cssSelector: selector };
    }
  }

  /**
   * 应用修复建议
   */
  private async applySuggestion(
    suggestion: FixSuggestion,
    testCode: string
  ): Promise<boolean> {
    try {
      logger.info('Applying suggestion', {
        type: suggestion.type,
        confidence: suggestion.confidence,
      });

      // 在真实实现中，这里会：
      // 1. 解析 diff
      // 2. 应用到测试文件
      // 3. 创建 Git commit
      // 4. 可选：自动运行测试验证

      // 现在只是模拟
      logger.debug('Suggestion applied (simulation)');

      return true;
    } catch (error) {
      logger.error('Failed to apply suggestion', { error });
      return false;
    }
  }

  /**
   * 批量自愈多个测试
   */
  async healMultipleTests(
    failures: FailedTestInfo[]
  ): Promise<Map<string, HealingResult>> {
    logger.info(`Healing ${failures.length} failed tests`);

    const results = new Map<string, HealingResult>();

    // 并行处理多个测试（限制并发数）
    const concurrency = 3;
    const chunks = this.chunkArray(failures, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (failure) => {
          const result = await this.healTest({
            testFailure: {
              testName: failure.testName,
              testFile: failure.testFile,
              errorMessage: failure.error.message,
              stackTrace: failure.error.stack || '',
              timestamp: new Date(),
            },
            testCode: failure.testCode,
            context: failure.context,
          });

          return { key: failure.testFile, result };
        })
      );

      for (const { key, result } of chunkResults) {
        results.set(key, result);
      }
    }

    logger.info('Batch healing complete', {
      total: failures.length,
      success: Array.from(results.values()).filter((r) => r.success).length,
    });

    return results;
  }

  /**
   * 获取自愈统计信息
   */
  getStatistics(): {
    totalAttempts: number;
    successfulHealings: number;
    failedHealings: number;
    averageDuration: number;
    successRate: number;
  } {
    // 从 metrics 系统获取统计数据
    const totalAttempts = metrics.getCounter(MetricNames.HEALING_ATTEMPTS) || 0;
    const successfulHealings = metrics.getCounter(MetricNames.HEALING_SUCCESS) || 0;
    const failedHealings = metrics.getCounter(MetricNames.HEALING_FAILURES) || 0;
    const averageDuration = metrics.getHistogramAverage(MetricNames.HEALING_DURATION) || 0;

    const successRate = totalAttempts > 0 ? successfulHealings / totalAttempts : 0;

    return {
      totalAttempts,
      successfulHealings,
      failedHealings,
      averageDuration,
      successRate,
    };
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * 便捷工厂函数
 */
export function createHealingEngine(config?: HealingConfig): HealingEngine {
  return new HealingEngine(config);
}




