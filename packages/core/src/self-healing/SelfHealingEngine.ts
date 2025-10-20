/**
 * SelfHealingEngine - 自愈测试引擎
 * 
 * 集成所有自愈组件，提供统一的自愈工作流：
 * 1. 检测测试失败
 * 2. 分类失败类型
 * 3. 尝试自动修复
 * 4. 生成修复建议（Diff-First）
 * 5. 记录意图，为未来自愈做准备
 */

import type { LLMService } from '../llm/LLMService';
import { LocatorEngine, type ElementDescriptor, type LocatorResult } from './LocatorEngine';
import { FailureClassifier, type TestFailure, type ClassificationResult } from './FailureClassifier';
import { FixSuggester, type FixSuggestion, type FixContext } from './FixSuggester';
import { IntentTracker, ActionType, type TestIntent } from './IntentTracker';

export interface SelfHealingResult {
  /** 是否成功自愈 */
  healed: boolean;
  
  /** 使用的策略 */
  strategy: HealingStrategy;
  
  /** 修复建议列表 */
  suggestions: FixSuggestion[];
  
  /** 失败分类结果 */
  classification: ClassificationResult;
  
  /** 新的元素定位（如果找到） */
  newLocator?: LocatorResult;
  
  /** 意图记录（用于未来自愈） */
  intent?: TestIntent;
  
  /** 自愈置信度 (0-1) */
  confidence: number;
  
  /** 执行时间（毫秒） */
  duration: number;
}

export enum HealingStrategy {
  /** 自动修复（无需人工干预） */
  AUTO_FIX = 'auto_fix',
  
  /** 建议修复（需要人工审查） */
  SUGGEST_FIX = 'suggest_fix',
  
  /** 无法修复 */
  CANNOT_FIX = 'cannot_fix'
}

export interface SelfHealingConfig {
  /** 是否启用自动修复（不需审查） */
  enableAutoFix?: boolean;
  
  /** 自动修复的最小置信度阈值 */
  autoFixConfidenceThreshold?: number;
  
  /** 是否启用意图跟踪 */
  enableIntentTracking?: boolean;
  
  /** 是否启用LLM增强 */
  enableLLM?: boolean;
  
  /** LLM服务 */
  llmService?: LLMService;
}

/**
 * 自愈引擎
 */
export class SelfHealingEngine {
  private locatorEngine: LocatorEngine;
  private failureClassifier: FailureClassifier;
  private fixSuggester: FixSuggester;
  private intentTracker: IntentTracker;
  private config: Required<Omit<SelfHealingConfig, 'llmService'>>;
  private llmService?: LLMService;

  constructor(config: SelfHealingConfig = {}) {
    const {
      enableAutoFix = false,
      autoFixConfidenceThreshold = 0.9,
      enableIntentTracking = true,
      enableLLM = true,
      llmService
    } = config;

    this.config = {
      enableAutoFix,
      autoFixConfidenceThreshold,
      enableIntentTracking,
      enableLLM: enableLLM && !!llmService
    };

    this.llmService = llmService;

    // 初始化所有组件
    this.locatorEngine = new LocatorEngine({
      enableSemanticMatching: this.config.enableLLM,
      minConfidenceThreshold: 0.7
    });

    this.failureClassifier = new FailureClassifier(llmService);
    this.fixSuggester = new FixSuggester(llmService);
    this.intentTracker = new IntentTracker(llmService);
  }

  /**
   * 主要的自愈方法
   */
  async heal(
    failure: TestFailure,
    context: FixContext
  ): Promise<SelfHealingResult> {
    const startTime = Date.now();

    // 1. 分类失败
    const classification = await this.failureClassifier.classify(failure);

    // 2. 根据分类决定策略
    const strategy = this.determineStrategy(classification);

    let newLocator: LocatorResult | null = null;
    let suggestions: FixSuggestion[] = [];
    let intent: TestIntent | undefined;
    let healed = false;

    // 3. 执行自愈逻辑
    if (classification.failureType === 'test_fragility' && failure.selector) {
      // 尝试重新定位元素
      newLocator = await this.relocateElement(failure, context);
      
      if (newLocator && strategy === HealingStrategy.AUTO_FIX) {
        // 自动修复
        healed = true;
      }
    }

    // 4. 生成修复建议
    suggestions = await this.fixSuggester.suggestFixes(failure, {
      ...context,
      failureClassification: classification,
      alternativeSelectors: newLocator ? [this.convertLocatorToDescriptor(newLocator)] : []
    });

    // 5. 记录意图（用于未来自愈）
    if (this.config.enableIntentTracking && failure.selector) {
      intent = await this.recordIntent(failure, context);
    }

    const duration = Date.now() - startTime;

    // 6. 计算总体置信度
    const confidence = this.calculateOverallConfidence(
      classification,
      suggestions,
      newLocator
    );

    return {
      healed,
      strategy,
      suggestions,
      classification,
      newLocator: newLocator || undefined,
      intent,
      confidence,
      duration
    };
  }

  /**
   * 重新定位元素
   */
  private async relocateElement(
    failure: TestFailure,
    context: FixContext
  ): Promise<LocatorResult | null> {
    if (!failure.selector) {
      return null;
    }

    // 尝试1: 检查是否有记录的意图
    if (this.config.enableIntentTracking) {
      const intent = this.intentTracker.findIntent(
        failure.testName,
        failure.selector
      );

      if (intent) {
        // 使用意图重新定位
        const relocated = await this.intentTracker.relocateByIntent(
          intent,
          context // 这里应该传入页面上下文
        );

        if (relocated) {
          return {
            element: relocated.element,
            strategy: this.determineLocatorStrategy(relocated.newSelector),
            confidence: relocated.confidence
          };
        }
      }
    }

    // 尝试2: 使用LocatorEngine的多策略定位
    const descriptor: ElementDescriptor = {
      cssSelector: failure.selector,
      textContent: failure.expectedValue?.toString(),
      semanticIntent: `Element for ${failure.testName}`
    };

    return await this.locatorEngine.locateElement(descriptor, context);
  }

  /**
   * 记录测试意图
   */
  private async recordIntent(
    failure: TestFailure,
    context: FixContext
  ): Promise<TestIntent | undefined> {
    // 从测试代码推断动作类型
    const actionType = this.inferActionType(failure, context);

    // 这里需要实际的DOM元素，暂时返回undefined
    // 在真实实现中，会从页面上下文获取元素
    return undefined;

    /*
    // 真实实现示例：
    const element = await page.$(failure.selector);
    if (element) {
      return await this.intentTracker.recordIntent(
        failure.testName,
        failure.testFile,
        actionType,
        failure.selector,
        element,
        {
          autoGenerateDescription: this.config.enableLLM,
          includeVisualFeatures: false,
          includeNearbyElements: true
        }
      );
    }
    */
  }

  /**
   * 推断动作类型
   */
  private inferActionType(failure: TestFailure, context: FixContext): ActionType {
    const code = context.testCode.toLowerCase();

    if (code.includes('click')) return ActionType.CLICK;
    if (code.includes('fill') || code.includes('type')) return ActionType.FILL;
    if (code.includes('select')) return ActionType.SELECT;
    if (code.includes('check')) return ActionType.CHECK;
    if (code.includes('navigate') || code.includes('goto')) return ActionType.NAVIGATE;
    if (code.includes('wait')) return ActionType.WAIT;
    if (code.includes('expect') || code.includes('assert')) return ActionType.ASSERT;

    return ActionType.OTHER;
  }

  /**
   * 确定定位策略
   */
  private determineLocatorStrategy(selector: string): any {
    if (selector.startsWith('#')) return 'ID';
    if (selector.startsWith('[')) return 'CSS_SELECTOR';
    if (selector.startsWith('//')) return 'XPATH';
    return 'CSS_SELECTOR';
  }

  /**
   * 将LocatorResult转换为ElementDescriptor
   */
  private convertLocatorToDescriptor(locator: LocatorResult): ElementDescriptor {
    const descriptor: ElementDescriptor = {};

    if (locator.metadata?.selector) {
      descriptor.cssSelector = locator.metadata.selector;
    }
    if (locator.metadata?.xpath) {
      descriptor.xpath = locator.metadata.xpath;
    }

    return descriptor;
  }

  /**
   * 决定自愈策略
   */
  private determineStrategy(classification: ClassificationResult): HealingStrategy {
    // 如果是真实Bug，不应该自动修复
    if (classification.failureType === 'real_bug') {
      return HealingStrategy.CANNOT_FIX;
    }

    // 如果启用了自动修复，且置信度足够高
    if (this.config.enableAutoFix && 
        classification.confidence >= this.config.autoFixConfidenceThreshold) {
      return HealingStrategy.AUTO_FIX;
    }

    // 默认：建议修复（需要人工审查）
    return HealingStrategy.SUGGEST_FIX;
  }

  /**
   * 计算总体置信度
   */
  private calculateOverallConfidence(
    classification: ClassificationResult,
    suggestions: FixSuggestion[],
    newLocator: LocatorResult | null
  ): number {
    const weights = {
      classification: 0.3,
      suggestions: 0.4,
      locator: 0.3
    };

    let totalScore = classification.confidence * weights.classification;

    if (suggestions.length > 0) {
      const avgSuggestionConfidence = 
        suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
      totalScore += avgSuggestionConfidence * weights.suggestions;
    }

    if (newLocator) {
      totalScore += newLocator.confidence * weights.locator;
    }

    return Math.min(totalScore, 1.0);
  }

  /**
   * 批量自愈多个失败
   */
  async healBatch(
    failures: TestFailure[],
    contextMap: Map<string, FixContext>
  ): Promise<Map<string, SelfHealingResult>> {
    const results = new Map<string, SelfHealingResult>();

    for (const failure of failures) {
      const context = contextMap.get(failure.testName);
      if (!context) {
        continue;
      }

      try {
        const result = await this.heal(failure, context);
        results.set(failure.testName, result);
      } catch (error) {
        console.error(`Failed to heal ${failure.testName}:`, error);
      }
    }

    return results;
  }

  /**
   * 生成自愈报告
   */
  generateHealingReport(results: Map<string, SelfHealingResult>): string {
    const totalTests = results.size;
    const healedTests = Array.from(results.values()).filter(r => r.healed).length;
    const healingRate = totalTests > 0 ? (healedTests / totalTests * 100).toFixed(1) : '0.0';

    let report = `# Self-Healing Report\n\n`;
    report += `**Summary:**\n`;
    report += `- Total Failed Tests: ${totalTests}\n`;
    report += `- Successfully Healed: ${healedTests}\n`;
    report += `- Healing Success Rate: ${healingRate}%\n\n`;

    report += `**Details:**\n\n`;

    for (const [testName, result] of results) {
      report += `### ${testName}\n`;
      report += `- Status: ${result.healed ? '✅ Healed' : '⚠️ Needs Review'}\n`;
      report += `- Strategy: ${result.strategy}\n`;
      report += `- Confidence: ${(result.confidence * 100).toFixed(0)}%\n`;
      report += `- Classification: ${result.classification.failureType}\n`;
      report += `- Suggestions: ${result.suggestions.length}\n`;
      
      if (result.newLocator) {
        report += `- New Locator: ${result.newLocator.strategy}\n`;
      }
      
      report += `\n`;
    }

    return report;
  }

  /**
   * 获取意图跟踪器（用于高级用途）
   */
  getIntentTracker(): IntentTracker {
    return this.intentTracker;
  }

  /**
   * 获取定位引擎（用于高级用途）
   */
  getLocatorEngine(): LocatorEngine {
    return this.locatorEngine;
  }
}

/**
 * 便捷工厂函数
 */
export function createSelfHealingEngine(config?: SelfHealingConfig): SelfHealingEngine {
  return new SelfHealingEngine(config);
}

