/**
 * FixSuggester - 自动修复建议器
 * 
 * 生成测试修复建议，遵循 Diff-First 模型
 * - 生成修复 Diff
 * - 推荐更稳定的定位策略
 * - 提供人类可读的修复说明
 */

import type { LLMService } from '../llm/LLMService';
import type { TestFailure, FailureType, ClassificationResult } from './FailureClassifier';
import type { ElementDescriptor, LocatorStrategy } from './LocatorEngine';

export interface FixSuggestion {
  type: FixType;
  description: string;
  diff: string; // 修复的代码 diff
  confidence: number; // 0-1
  estimatedEffort: 'low' | 'medium' | 'high';
  reasoning: string;
  alternativeApproaches?: string[];
}

export enum FixType {
  /** 更新选择器 */
  UPDATE_SELECTOR = 'update_selector',
  
  /** 增加等待时间 */
  ADD_WAIT = 'add_wait',
  
  /** 修复断言 */
  FIX_ASSERTION = 'fix_assertion',
  
  /** 添加重试逻辑 */
  ADD_RETRY = 'add_retry',
  
  /** 更新测试数据 */
  UPDATE_TEST_DATA = 'update_test_data',
  
  /** 其他修复 */
  OTHER = 'other'
}

export interface FixContext {
  testCode: string;
  failedLine?: number;
  currentSelector?: string;
  alternativeSelectors?: ElementDescriptor[];
  failureClassification?: ClassificationResult;
}

/**
 * 修复建议器
 */
export class FixSuggester {
  private llmService?: LLMService;

  constructor(llmService?: LLMService) {
    this.llmService = llmService;
  }

  /**
   * 生成修复建议
   */
  async suggestFixes(
    failure: TestFailure,
    context: FixContext
  ): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = [];

    // 1. 基于分类结果的规则建议
    if (context.failureClassification) {
      const ruleBasedSuggestions = this.generateRuleBasedSuggestions(
        failure,
        context,
        context.failureClassification
      );
      suggestions.push(...ruleBasedSuggestions);
    }

    // 2. 如果有 LLM，生成 AI 增强建议
    if (this.llmService) {
      try {
        const llmSuggestion = await this.generateLLMSuggestion(failure, context);
        if (llmSuggestion) {
          suggestions.push(llmSuggestion);
        }
      } catch (error) {
        console.error('Failed to generate LLM suggestion:', error);
      }
    }

    // 3. 按置信度排序
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 生成基于规则的修复建议
   */
  private generateRuleBasedSuggestions(
    failure: TestFailure,
    context: FixContext,
    classification: ClassificationResult
  ): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    switch (classification.failureType) {
      case 'test_fragility':
        if (failure.errorMessage.includes('element not found')) {
          suggestions.push(...this.suggestSelectorUpdates(failure, context));
        }
        if (failure.errorMessage.includes('timeout')) {
          suggestions.push(this.suggestWaitIncrease(failure, context));
        }
        break;

      case 'environment':
        suggestions.push(this.suggestRetryLogic(failure, context));
        break;

      case 'real_bug':
        if (failure.errorMessage.includes('expected')) {
          suggestions.push(this.suggestAssertionFix(failure, context));
        }
        break;
    }

    return suggestions;
  }

  /**
   * 建议选择器更新
   */
  private suggestSelectorUpdates(
    failure: TestFailure,
    context: FixContext
  ): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    if (!context.alternativeSelectors || !context.currentSelector) {
      return suggestions;
    }

    // 为每个备选选择器生成建议
    for (const altSelector of context.alternativeSelectors) {
      const newSelector = this.formatSelector(altSelector);
      const diff = this.generateSelectorDiff(
        context.testCode,
        context.currentSelector,
        newSelector
      );

      suggestions.push({
        type: FixType.UPDATE_SELECTOR,
        description: `Update selector to use ${this.getLocatorStrategyName(altSelector)}`,
        diff,
        confidence: this.calculateSelectorConfidence(altSelector),
        estimatedEffort: 'low',
        reasoning: `More stable locator strategy: ${this.getLocatorStrategyName(altSelector)}`,
        alternativeApproaches: []
      });
    }

    return suggestions;
  }

  /**
   * 建议增加等待时间
   */
  private suggestWaitIncrease(
    failure: TestFailure,
    context: FixContext
  ): FixSuggestion {
    const currentTimeout = failure.timeout || 5000;
    const suggestedTimeout = currentTimeout * 2;

    const diff = this.generateWaitDiff(
      context.testCode,
      currentTimeout,
      suggestedTimeout
    );

    return {
      type: FixType.ADD_WAIT,
      description: `Increase wait timeout from ${currentTimeout}ms to ${suggestedTimeout}ms`,
      diff,
      confidence: 0.7,
      estimatedEffort: 'low',
      reasoning: 'Test timed out, element may need more time to appear',
      alternativeApproaches: [
        'Add explicit wait for element to be visible',
        'Use waitForSelector with retry logic'
      ]
    };
  }

  /**
   * 建议重试逻辑
   */
  private suggestRetryLogic(
    failure: TestFailure,
    context: FixContext
  ): FixSuggestion {
    const diff = this.generateRetryDiff(context.testCode, context.failedLine);

    return {
      type: FixType.ADD_RETRY,
      description: 'Add retry logic for flaky environment issues',
      diff,
      confidence: 0.8,
      estimatedEffort: 'medium',
      reasoning: 'Environment issues are often transient and benefit from retry',
      alternativeApproaches: [
        'Configure test runner to auto-retry failed tests',
        'Add retry at the action level instead of test level'
      ]
    };
  }

  /**
   * 建议断言修复
   */
  private suggestAssertionFix(
    failure: TestFailure,
    context: FixContext
  ): FixSuggestion {
    const diff = this.generateAssertionDiff(
      context.testCode,
      failure.expectedValue,
      failure.actualValue
    );

    return {
      type: FixType.FIX_ASSERTION,
      description: 'Update assertion to match actual behavior',
      diff,
      confidence: 0.5, // Lower confidence - might be a real bug
      estimatedEffort: 'low',
      reasoning: 'Actual value differs from expected. Verify if this is a bug or outdated test.',
      alternativeApproaches: [
        'Investigate if actual behavior is correct',
        'Update test data instead of assertion'
      ]
    };
  }

  /**
   * 使用 LLM 生成智能修复建议
   */
  private async generateLLMSuggestion(
    failure: TestFailure,
    context: FixContext
  ): Promise<FixSuggestion | null> {
    if (!this.llmService) {
      return null;
    }

    const prompt = `
You are an expert test automation engineer. Analyze this failing test and suggest a fix.

Test Code:
\`\`\`typescript
${context.testCode}
\`\`\`

Failure Details:
- Error: ${failure.errorMessage}
- Stack Trace: ${failure.stackTrace.substring(0, 300)}
${context.currentSelector ? `- Current Selector: ${context.currentSelector}` : ''}

Generate a fix following these guidelines:
1. Provide a clear description of the fix
2. Generate a code diff showing the changes
3. Explain why this fix should work
4. Suggest effort level (low/medium/high)

Format your response as JSON:
{
  "type": "UPDATE_SELECTOR|ADD_WAIT|FIX_ASSERTION|ADD_RETRY|UPDATE_TEST_DATA|OTHER",
  "description": "Brief description",
  "diff": "Code diff in unified diff format",
  "reasoning": "Why this fix works",
  "estimatedEffort": "low|medium|high",
  "alternativeApproaches": ["alternative 1", "alternative 2"]
}
`;

    try {
      const response = await this.llmService.generate({
        provider: 'openai',
        model: 'gpt-4',
        prompt: prompt,
        temperature: 0.4,
        maxTokens: 800
      });

      const parsed = JSON.parse(response.content);

      return {
        type: parsed.type as FixType,
        description: parsed.description,
        diff: parsed.diff,
        confidence: 0.85, // LLM suggestions are generally high quality
        estimatedEffort: parsed.estimatedEffort,
        reasoning: parsed.reasoning,
        alternativeApproaches: parsed.alternativeApproaches
      };
    } catch (error) {
      console.error('LLM suggestion failed:', error);
      return null;
    }
  }

  /**
   * 生成选择器更新的 diff
   */
  private generateSelectorDiff(
    testCode: string,
    oldSelector: string,
    newSelector: string
  ): string {
    const lines = testCode.split('\n');
    const diffLines: string[] = [];

    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes(oldSelector) && !found) {
        diffLines.push(`--- Line ${i + 1}`);
        diffLines.push(`-${line}`);
        diffLines.push(`+${line.replace(oldSelector, newSelector)}`);
        found = true;
      }
    }

    if (!found) {
      return `Could not generate diff: selector "${oldSelector}" not found in test code`;
    }

    return diffLines.join('\n');
  }

  /**
   * 生成等待时间增加的 diff
   */
  private generateWaitDiff(
    testCode: string,
    oldTimeout: number,
    newTimeout: number
  ): string {
    const lines = testCode.split('\n');
    const diffLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && (line.includes(`timeout:`) || line.includes(`${oldTimeout}`))) {
        diffLines.push(`--- Line ${i + 1}`);
        diffLines.push(`-${line}`);
        diffLines.push(`+${line.replace(String(oldTimeout), String(newTimeout))}`);
        break;
      }
    }

    if (diffLines.length === 0) {
      diffLines.push(`--- No timeout found, add:
+  { timeout: ${newTimeout} }`);
    }

    return diffLines.join('\n');
  }

  /**
   * 生成重试逻辑的 diff
   */
  private generateRetryDiff(
    testCode: string,
    failedLine?: number
  ): string {
    const retryWrapper = `
// Auto-generated retry wrapper
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Retry failed');
}

// Wrap flaky operation
await withRetry(async () => {
  // Original test code here
});`;

    return `--- Add retry wrapper
+${retryWrapper}`;
  }

  /**
   * 生成断言修复的 diff
   */
  private generateAssertionDiff(
    testCode: string,
    expectedValue: any,
    actualValue: any
  ): string {
    const lines = testCode.split('\n');
    const diffLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes('expect') && line.includes(String(expectedValue))) {
        diffLines.push(`--- Line ${i + 1}`);
        diffLines.push(`-${line}`);
        diffLines.push(`+${line.replace(String(expectedValue), String(actualValue))}`);
        break;
      }
    }

    if (diffLines.length === 0) {
      diffLines.push(`--- Update assertion
- expect(value).toBe(${JSON.stringify(expectedValue)})
+ expect(value).toBe(${JSON.stringify(actualValue)})`);
    }

    return diffLines.join('\n');
  }

  /**
   * 格式化选择器
   */
  private formatSelector(descriptor: ElementDescriptor): string {
    if (descriptor.id) {
      return `#${descriptor.id}`;
    }
    if (descriptor.cssSelector) {
      return descriptor.cssSelector;
    }
    if (descriptor.xpath) {
      return descriptor.xpath;
    }
    return 'unknown';
  }

  /**
   * 获取定位策略名称
   */
  private getLocatorStrategyName(descriptor: ElementDescriptor): string {
    if (descriptor.id) return 'ID (most stable)';
    if (descriptor.cssSelector) return 'CSS Selector';
    if (descriptor.xpath) return 'XPath';
    if (descriptor.semanticIntent) return 'Semantic Intent (AI)';
    return 'Unknown';
  }

  /**
   * 计算选择器置信度
   */
  private calculateSelectorConfidence(descriptor: ElementDescriptor): number {
    // ID 最稳定
    if (descriptor.id) return 0.95;
    
    // CSS Selector 次之
    if (descriptor.cssSelector) {
      // 检查选择器复杂度
      const selectorComplexity = descriptor.cssSelector.split(' ').length;
      return Math.max(0.7, 0.9 - (selectorComplexity * 0.05));
    }
    
    // XPath 相对不稳定
    if (descriptor.xpath) return 0.6;
    
    // AI 策略不确定性较高
    return 0.5;
  }

  /**
   * 生成人类可读的修复说明
   */
  generateHumanReadableGuide(suggestion: FixSuggestion): string {
    let guide = `## Fix Suggestion: ${suggestion.description}\n\n`;
    
    guide += `**Confidence:** ${(suggestion.confidence * 100).toFixed(0)}%\n`;
    guide += `**Effort:** ${suggestion.estimatedEffort}\n\n`;
    
    guide += `**Why this works:**\n${suggestion.reasoning}\n\n`;
    
    guide += `**Proposed Changes:**\n\`\`\`diff\n${suggestion.diff}\n\`\`\`\n\n`;
    
    if (suggestion.alternativeApproaches && suggestion.alternativeApproaches.length > 0) {
      guide += `**Alternative Approaches:**\n`;
      suggestion.alternativeApproaches.forEach((alt, i) => {
        guide += `${i + 1}. ${alt}\n`;
      });
    }
    
    return guide;
  }
}

/**
 * 便捷工厂函数
 */
export function createFixSuggester(llmService?: LLMService): FixSuggester {
  return new FixSuggester(llmService);
}

