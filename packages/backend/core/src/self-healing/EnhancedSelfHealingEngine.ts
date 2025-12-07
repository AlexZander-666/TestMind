/**
 * EnhancedSelfHealingEngine - 增强型自愈测试引擎
 *
 * 基于 AI-Hybrid-Development-Pipeline 的架构优化原则：
 * - 5级定位策略引擎
 * - 智能失败分类器
 * - 自适应修复建议器
 * - 意图跟踪和学习
 * - 性能监控和缓存
 */

import { performance } from 'node:perf_hooks';

import type {
  FixCandidate,
  HealingTelemetry,
  SelfHealingPlan,
} from '@testmind/shared';

import type { LLMService } from '../llm/LLMService';
import { createComponentLogger } from '../utils/logger';

import { AutoFixPlanner } from './planners/AutoFixPlanner';
import {
  FailureClassifier,
  FailureType,
  type ClassificationResult,
  type TestFailure,
} from './FailureClassifier';
import { FixSuggester, type FixSuggestion, type FixContext } from './FixSuggester';
import { IntentTracker, ActionType, type TestIntent } from './IntentTracker';
import { LocatorEngine, type ElementDescriptor, type LocatorResult } from './LocatorEngine';
import { HealingStrategy, type SelfHealingResult } from './SelfHealingEngine';

const logger = createComponentLogger('EnhancedSelfHealingEngine');
type PerformanceStage = 'classification' | 'locator' | 'suggestion';

export { HealingStrategy } from './SelfHealingEngine';

// 常量定义
const HEALING_CONSTANTS = {
  MAX_RETRIES: 3,
  DEFAULT_TIMEOUT: 5000,
  CONFIDENCE_THRESHOLD: 0.7,
  CACHE_TTL: 300000, // 5分钟
  PERFORMANCE_LOG_INTERVAL: 1000,
} as const;

export interface HealingConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 置信度阈值 */
  confidenceThreshold: number;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;
  /** 自定义策略权重 */
  strategyWeights: Record<HealingStrategy, number>;
}

export interface EnhancedHealingResult extends SelfHealingResult {
  /** 自愈计划 */
  plan?: SelfHealingPlan;

  /** 候选修复 */
  candidates?: FixCandidate[];

  /** 详尽的遥测数据 */
  telemetry: HealingTelemetry;

  /** 向后兼容的性能字段 */
  performance: {
    classificationTime: number;
    locatorTime: number;
    suggestionTime: number;
    totalTime: number;
  };

  /** 缓存状态 */
  cacheHit: boolean;

  /** 学习指标 */
  learningMetrics: {
    intentMatchScore: number;
    historicalSuccessRate: number;
    patternRecognitionConfidence: number;
  };

  /** 元数据 */
  metadata: {
    version: string;
    timestamp: Date;
    environment: string;
    correlationId: string;
  };
}

export interface HealingCache {
  failures: Map<string, EnhancedHealingResult>;
  locators: Map<string, LocatorResult>;
  suggestions: Map<string, FixSuggestion[]>;
  lastCleanup: Date;
}

export interface HealingMetrics {
  totalAttempts: number;
  successfulHealings: number;
  failedHealings: number;
  averageConfidence: number;
  averageDuration: number;
  strategyUsage: Record<HealingStrategy, number>;
  cacheHitRate: number;
}

/**
 * 增强型自愈引擎
 *
 * 特性：
 * - 智能缓存机制
 * - 性能监控和指标收集
 * - 自适应学习
 * - 模式识别
 * - 多策略并行执行
 */
export class EnhancedSelfHealingEngine {
  private readonly config: HealingConfig;
  private readonly cache: HealingCache;
  private readonly metrics: HealingMetrics;
  private readonly stageTimings: Map<PerformanceStage, number> = new Map();
  private readonly planner: AutoFixPlanner;

  constructor(
    private readonly llmService: LLMService,
    private readonly locatorEngine: LocatorEngine,
    private readonly failureClassifier: FailureClassifier,
    private readonly fixSuggester: FixSuggester,
    private readonly intentTracker: IntentTracker,
    config?: Partial<HealingConfig>,
  ) {
    this.config = {
      maxRetries: HEALING_CONSTANTS.MAX_RETRIES,
      confidenceThreshold: HEALING_CONSTANTS.CONFIDENCE_THRESHOLD,
      enableCache: true,
      enablePerformanceMonitoring: true,
      strategyWeights: {
        [HealingStrategy.AUTO_FIX]: 0.4,
        [HealingStrategy.SMART_RETRY]: 0.2,
        [HealingStrategy.LOCATOR_REPLACEMENT]: 0.3,
        [HealingStrategy.TIMEOUT_EXTENSION]: 0.1,
        [HealingStrategy.ASSERTION_ADJUSTMENT]: 0.0,
        [HealingStrategy.MANUAL_INTERVENTION]: 0.0,
        [HealingStrategy.SUGGEST_FIX]: 0.1,
        [HealingStrategy.CANNOT_FIX]: 0.0,
      },
      ...config,
    };

    this.cache = {
      failures: new Map(),
      locators: new Map(),
      suggestions: new Map(),
      lastCleanup: new Date(),
    };

    this.metrics = {
      totalAttempts: 0,
      successfulHealings: 0,
      failedHealings: 0,
      averageConfidence: 0,
      averageDuration: 0,
      strategyUsage: Object.fromEntries(
        Object.values(HealingStrategy).map(strategy => [strategy, 0]),
      ) as Record<HealingStrategy, number>,
      cacheHitRate: 0,
    };

    this.planner = new AutoFixPlanner();
    // 定期清理缓存
    this.setupCacheCleanup();
  }

  /**
   * 主要的自愈方法
   *
   * @param failure 测试失败信息
   * @param context 额外的上下文信息
   * @returns 增强的自愈结果
   */
  async attemptHealing(
    failure: TestFailure,
    context?: Partial<FixContext>,
  ): Promise<EnhancedHealingResult> {
    this.stageTimings.clear();
    const startTime = performance.now();
    const correlationId = this.generateCorrelationId();

    logger.info('Starting enhanced self-healing attempt', {
      correlationId,
      selector: failure.selector,
      errorMessage: failure.errorMessage,
      testFile: failure.testFile,
    });

    try {
      this.metrics.totalAttempts++;

      // 1. 检查缓存
      const cacheKey = this.generateCacheKey(failure);
      const cacheResult = this.checkCache(cacheKey);
      if (cacheResult) {
        logger.info('Cache hit for healing attempt', { correlationId, cacheKey });
        return this.addCacheMetadata(cacheResult, correlationId, true);
      }

      // 2. 并行执行分类和定位器查找
      const [classificationResult, locatorResult] = await Promise.all([
        this.performClassification(failure),
        this.findAlternativelocators(failure),
      ]);

      // 3. 意图分析和学习
      const intent = await this.analyzeIntent(failure, classificationResult);

      // 4. 生成修复建议
      const suggestions = await this.generateSuggestions(
        failure,
        classificationResult,
        locatorResult,
        context,
      );

      // 5. 选择最佳策略
      const strategy = await this.selectOptimalStrategy(
        classificationResult,
        locatorResult,
        suggestions,
        intent,
      );

      // 6. 执行修复
      const healingResult = await this.executeHealing(
        strategy,
        failure,
        locatorResult,
        suggestions,
        classificationResult,
      );

      // 7. 生成遥测与自愈计划
      const telemetry = this.buildTelemetry(startTime, false);
      const plan = this.planner.createPlan({
        failure,
        suggestions,
        telemetry,
      });

      const enhancedResult = this.createEnhancedResult(
        healingResult,
        telemetry,
        intent,
        correlationId,
        false,
        plan,
        plan.candidates,
      );

      // 8. 更新缓存和指标
      await this.updateCacheAndMetrics(cacheKey, enhancedResult, strategy, intent, false);

      // 9. 返回增强结果
      return enhancedResult;

    } catch (error) {
      logger.error('Self-healing attempt failed', {
        correlationId,
        error: error as Record<string, unknown>,
      });

      // 创建失败结果
      const failureResult: SelfHealingResult = {
        healed: false,
        strategy: HealingStrategy.MANUAL_INTERVENTION,
        suggestions: [],
        classification: {
          failureType: FailureType.UNKNOWN,
          confidence: 0,
          reasoning: 'Engine failure',
          suggestedActions: [],
          isFlaky: false,
        },
        confidence: 0,
        duration: performance.now() - startTime,
      };

      return this.createEnhancedResult(
        failureResult,
        this.buildTelemetry(startTime, false),
        undefined,
        correlationId,
        false,
      );
    }
  }

  private async measureStage<T>(stage: PerformanceStage, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    this.stageTimings.set(stage, performance.now() - start);
    return result;
  }

  /**
   * 执行失败分类
   */
  private async performClassification(failure: TestFailure): Promise<ClassificationResult> {
    return this.measureStage('classification', () => this.failureClassifier.classify(failure));
  }

  /**
   * 查找替代定位器
   */
  private async findAlternativelocators(failure: TestFailure): Promise<LocatorResult[]> {
    if (!failure.selector) {
      return [];
    }

    return this.measureStage('locator', async () => {
      const descriptor: ElementDescriptor = {
        cssSelector: failure.selector,
        textContent: failure.expectedValue ? String(failure.expectedValue) : undefined,
        semanticIntent: `Element for ${failure.testName}`,
      };

      const primary = await this.locatorEngine.locateElement(descriptor);
      return primary ? [primary] : [];
    });
  }

  /**
   * 分析测试意图
   */
  private async analyzeIntent(
    failure: TestFailure,
    classification: ClassificationResult,
  ): Promise<TestIntent | undefined> {
    if (!failure.selector) {
      return undefined;
    }

    return this.intentTracker.findIntent(failure.testName, failure.selector);
  }

  /**
   * 生成修复建议
   */
  private async generateSuggestions(
    failure: TestFailure,
    classification: ClassificationResult,
    locators: LocatorResult[],
    context?: Partial<FixContext>,
  ): Promise<FixSuggestion[]> {
    return this.measureStage('suggestion', async () => {
      const alternativeSelectors = locators
        .map(locator => this.convertLocatorToDescriptor(locator))
        .filter(descriptor => Object.keys(descriptor).length > 0);

      const fixContext: FixContext = {
        ...context,
        testCode: context?.testCode ?? '',
        currentSelector: context?.currentSelector ?? failure.selector,
        alternativeSelectors,
        failureClassification: classification,
      };

      return this.fixSuggester.suggestFixes(failure, fixContext);
    });
  }

  /**
   * 将 LocatorResult 转换为 ElementDescriptor
   */
  private convertLocatorToDescriptor(locator: LocatorResult): ElementDescriptor {
    const descriptor: ElementDescriptor = {};

    if (locator.metadata?.selector) {
      descriptor.cssSelector = locator.metadata.selector;
    }

    if (locator.metadata?.xpath) {
      descriptor.xpath = locator.metadata.xpath;
    }

    if (locator.metadata?.textContent) {
      descriptor.textContent = locator.metadata.textContent;
    }

    return descriptor;
  }

  /**
   * 选择最优策略
   */
  private async selectOptimalStrategy(
    classification: ClassificationResult,
    locators: LocatorResult[],
    suggestions: FixSuggestion[],
    intent?: TestIntent,
  ): Promise<HealingStrategy> {
    // 基于多个因素选择策略
    const strategyScores = new Map<HealingStrategy, number>();

    for (const strategy of Object.values(HealingStrategy)) {
      let score = this.config.strategyWeights[strategy];

      // 根据分类结果调整权重
      score += this.getStrategyClassificationBonus(strategy, classification);

      // 根据定位器可用性调整权重
      score += this.getStrategyLocatorBonus(strategy, locators);

      // 根据历史成功记录调整权重
      score += this.getStrategyHistoryBonus(strategy, intent);

      strategyScores.set(strategy, score);
    }

    // 选择得分最高的策略
    const rankedStrategies = Array.from(strategyScores.entries()).sort(
      ([, a], [, b]) => b - a,
    );
    const bestStrategy = rankedStrategies[0]?.[0] ?? HealingStrategy.MANUAL_INTERVENTION;

    logger.debug('Selected optimal healing strategy', {
      strategy: bestStrategy,
      scores: Object.fromEntries(strategyScores),
    });

    return bestStrategy;
  }

  /**
   * 执行修复
   */
  private async executeHealing(
    strategy: HealingStrategy,
    failure: TestFailure,
    locators: LocatorResult[],
    suggestions: FixSuggestion[],
    classification: ClassificationResult,
  ): Promise<SelfHealingResult> {
    const startTime = performance.now();

    try {
      let healed = false;
      let newLocator: LocatorResult | undefined;

      switch (strategy) {
        case HealingStrategy.AUTO_FIX:
          healed = await this.executeAutoFix(failure, suggestions);
          break;

        case HealingStrategy.LOCATOR_REPLACEMENT:
          newLocator = await this.executeLocatorReplacement(locators);
          healed = !!newLocator;
          break;

        case HealingStrategy.SMART_RETRY:
          healed = await this.executeSmartRetry(failure);
          break;

        case HealingStrategy.TIMEOUT_EXTENSION:
          healed = await this.executeTimeoutExtension(failure);
          break;

        case HealingStrategy.ASSERTION_ADJUSTMENT:
          healed = await this.executeAssertionAdjustment(failure, suggestions);
          break;

        case HealingStrategy.MANUAL_INTERVENTION:
        case HealingStrategy.SUGGEST_FIX:
        case HealingStrategy.CANNOT_FIX:
          healed = false;
          break;

        default:
          throw new Error(`Unknown healing strategy: ${strategy}`);
      }

      const duration = performance.now() - startTime;

      return {
        healed,
        strategy,
        suggestions,
        classification,
        newLocator,
        confidence: this.calculateConfidence(strategy, suggestions),
        duration,
      };

    } catch (error) {
      logger.error('Healing execution failed', {
        strategy,
        error: error as Record<string, unknown>,
      });

      throw error;
    }
  }

  /**
   * 计算自愈置信度
   */
  private calculateConfidence(
    strategy: HealingStrategy,
    suggestions: FixSuggestion[],
  ): number {
    let confidence = 0;

    // 基于策略的基础置信度
    const strategyConfidence: Record<HealingStrategy, number> = {
      [HealingStrategy.AUTO_FIX]: 0.9,
      [HealingStrategy.LOCATOR_REPLACEMENT]: 0.8,
      [HealingStrategy.SMART_RETRY]: 0.6,
      [HealingStrategy.TIMEOUT_EXTENSION]: 0.7,
      [HealingStrategy.ASSERTION_ADJUSTMENT]: 0.5,
      [HealingStrategy.MANUAL_INTERVENTION]: 0.1,
      [HealingStrategy.SUGGEST_FIX]: 0.4,
      [HealingStrategy.CANNOT_FIX]: 0.2,
    };

    confidence = strategyConfidence[strategy];

    // 基于建议质量调整
    if (suggestions.length > 0) {
      const avgSuggestionConfidence = suggestions.reduce(
        (sum, suggestion) => sum + suggestion.confidence,
        0,
      ) / suggestions.length;

      confidence = (confidence + avgSuggestionConfidence) / 2;
    }

    return Math.min(confidence, 1);
  }

  /**
   * 执行自动修复
   */
  private async executeAutoFix(failure: TestFailure, suggestions: FixSuggestion[]): Promise<boolean> {
    // TODO: 实现自动修复逻辑
    logger.debug('Executing auto fix', { suggestions: suggestions.length });
    return false;
  }

  /**
   * 执行定位器替换
   */
  private async executeLocatorReplacement(locators: LocatorResult[]): Promise<LocatorResult | undefined> {
    return locators.find(locator => locator.confidence > 0.8);
  }

  /**
   * 执行智能重试
   */
  private async executeSmartRetry(failure: TestFailure): Promise<boolean> {
    // TODO: 实现智能重试逻辑
    logger.debug('Executing smart retry', { errorMessage: failure.errorMessage });
    return false;
  }

  /**
   * 执行超时延长
   */
  private async executeTimeoutExtension(failure: TestFailure): Promise<boolean> {
    // TODO: 实现超时延长逻辑
    logger.debug('Executing timeout extension', { currentTimeout: failure.timeout });
    return false;
  }

  /**
   * 执行断言调整
   */
  private async executeAssertionAdjustment(failure: TestFailure, suggestions: FixSuggestion[]): Promise<boolean> {
    // TODO: 实现断言调整逻辑
    logger.debug('Executing assertion adjustment', { suggestions: suggestions.length });
    return false;
  }

  /**
   * 缓存相关方法
   */
  private generateCacheKey(failure: TestFailure): string {
    const parts = [
      failure.testName,
      failure.testFile,
      failure.selector,
      failure.errorMessage,
    ].filter(Boolean);
    return parts.join(':');
  }

  private checkCache(key: string): EnhancedHealingResult | null {
    if (!this.config.enableCache) {
      return null;
    }

    return this.cache.failures.get(key) || null;
  }

  private async updateCacheAndMetrics(
    key: string,
    result: EnhancedHealingResult,
    strategy: HealingStrategy,
    intent?: TestIntent,
    cacheHit: boolean = false,
  ): Promise<void> {
    if (this.config.enableCache && !cacheHit) {
      this.cache.failures.set(key, result);
    }

    // 更新指标
    if (result.healed) {
      this.metrics.successfulHealings++;
    } else {
      this.metrics.failedHealings++;
    }

    this.metrics.strategyUsage[strategy]++;
    this.metrics.averageConfidence =
      (this.metrics.averageConfidence * (this.metrics.totalAttempts - 1) + result.confidence) /
      this.metrics.totalAttempts;

    this.metrics.averageDuration =
      (this.metrics.averageDuration * (this.metrics.totalAttempts - 1) + result.duration) /
      this.metrics.totalAttempts;

    this.metrics.cacheHitRate = cacheHit
      ? (this.metrics.cacheHitRate * (this.metrics.totalAttempts - 1) + 1) / this.metrics.totalAttempts
      : (this.metrics.cacheHitRate * (this.metrics.totalAttempts - 1)) / this.metrics.totalAttempts;

    // 记录意图
    if (intent) {
      this.intentTracker.updateIntentStatus(intent.id, result.healed);
    }
  }

  private setupCacheCleanup(): void {
    // 每小时清理一次过期缓存
    setInterval(() => {
      this.cleanupCache();
    }, HEALING_CONSTANTS.CACHE_TTL);
  }

  private cleanupCache(): void {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - HEALING_CONSTANTS.CACHE_TTL);

    this.cache.failures.clear();
    this.cache.locators.clear();
    this.cache.suggestions.clear();
    this.cache.lastCleanup = now;

    logger.info('Cache cleanup completed', {
      clearedAt: now.toISOString(),
      cutoffTime: cutoffTime.toISOString(),
    });
  }

  /**
   * 性能监控
   */
  private buildTelemetry(startTime: number, cacheHit: boolean): HealingTelemetry {
    const classificationTimeMs = this.stageTimings.get('classification') ?? 0;
    const locatorTimeMs = this.stageTimings.get('locator') ?? 0;
    const suggestionTimeMs = this.stageTimings.get('suggestion') ?? 0;
    const totalTimeMs = performance.now() - startTime;
    const executionTimeMs = Math.max(
      totalTimeMs - (classificationTimeMs + locatorTimeMs + suggestionTimeMs),
      0,
    );

    return {
      classificationTimeMs,
      locatorTimeMs,
      suggestionTimeMs,
      plannerTimeMs: 0,
      executionTimeMs,
      totalTimeMs,
      cacheHit,
      retries: 0,
      successRate: this.getHistoricalSuccessRate(),
    };
  }

  /**
   * 创建增强结果
   */
  private createEnhancedResult(
    baseResult: SelfHealingResult,
    telemetry: HealingTelemetry,
    intent: TestIntent | undefined,
    correlationId: string | undefined,
    cacheHit: boolean,
    plan?: SelfHealingPlan,
    candidates?: FixCandidate[],
  ): EnhancedHealingResult {
    const performance = {
      classificationTime: telemetry.classificationTimeMs,
      locatorTime: telemetry.locatorTimeMs,
      suggestionTime: telemetry.suggestionTimeMs,
      totalTime: telemetry.totalTimeMs,
    };

    return {
      ...baseResult,
      plan,
      candidates,
      telemetry,
      performance,
      cacheHit,
      learningMetrics: {
        intentMatchScore: intent ? 0.75 : 0,
        historicalSuccessRate: this.getHistoricalSuccessRate(),
        patternRecognitionConfidence: this.calculatePatternRecognitionConfidence(),
      },
      metadata: {
        version: '2.0.0',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development',
        correlationId: correlationId || this.generateCorrelationId(),
      },
    };
  }

  private addCacheMetadata(
    result: EnhancedHealingResult,
    correlationId: string,
    cacheHit: boolean,
  ): EnhancedHealingResult {
    return {
      ...result,
      cacheHit,
      telemetry: {
        ...result.telemetry,
        cacheHit,
      },
      metadata: {
        ...result.metadata,
        correlationId,
      },
    };
  }

  /**
   * 辅助方法
   */
  private generateCorrelationId(): string {
    return `heal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private getStrategyClassificationBonus(
    strategy: HealingStrategy,
    classification: ClassificationResult,
  ): number {
    // 基于分类结果给予策略奖励
    const bonusMap: Partial<Record<FailureType, Partial<Record<HealingStrategy, number>>>> = {
      [FailureType.TEST_FRAGILITY]: {
        [HealingStrategy.LOCATOR_REPLACEMENT]: 0.3,
        [HealingStrategy.AUTO_FIX]: 0.2,
      },
      [FailureType.ENVIRONMENT]: {
        [HealingStrategy.SMART_RETRY]: 0.2,
        [HealingStrategy.TIMEOUT_EXTENSION]: 0.2,
      },
      [FailureType.REAL_BUG]: {
        [HealingStrategy.MANUAL_INTERVENTION]: 0.3,
        [HealingStrategy.ASSERTION_ADJUSTMENT]: 0.1,
      },
    };

    return bonusMap[classification.failureType]?.[strategy] ?? 0;
  }

  private getStrategyLocatorBonus(
    strategy: HealingStrategy,
    locators: LocatorResult[],
  ): number {
    if (strategy === HealingStrategy.LOCATOR_REPLACEMENT && locators.length > 0) {
      return locators.some(locator => locator.confidence > 0.8) ? 0.3 : 0.1;
    }
    return 0;
  }

  private getStrategyHistoryBonus(
    strategy: HealingStrategy,
    intent?: TestIntent,
  ): number {
    // 基于历史成功记录给予策略奖励
    const totalUsage = this.metrics.strategyUsage[strategy];
    if (totalUsage === 0) return 0;

    const successRate = this.metrics.successfulHealings / this.metrics.totalAttempts;

    // 如果某个策略历史成功率较高，给予奖励
    return successRate > 0.7 ? 0.2 : 0;
  }

  private getHistoricalSuccessRate(): number {
    return this.metrics.totalAttempts > 0
      ? this.metrics.successfulHealings / this.metrics.totalAttempts
      : 0;
  }

  private calculatePatternRecognitionConfidence(): number {
    // TODO: 实现模式识别置信度计算
    return 0.5;
  }

  /**
   * 公共API
   */
  getMetrics(): HealingMetrics {
    return { ...this.metrics };
  }

  async clearCache(): Promise<void> {
    this.cache.failures.clear();
    this.cache.locators.clear();
    this.cache.suggestions.clear();
    this.cache.lastCleanup = new Date();

    logger.info('Cache cleared manually');
  }

  updateConfig(newConfig: Partial<HealingConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info('Healing configuration updated', { newConfig });
  }
}
