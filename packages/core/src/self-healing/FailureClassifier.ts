/**
 * FailureClassifier - 测试失败分类器
 * 
 * 区分3类测试失败：
 * 1. 环境问题 (Environment Issues)
 * 2. 真实Bug (Real Bugs)
 * 3. 测试脆弱性 (Test Fragility)
 */

import type { LLMService } from '../llm/LLMService';

export enum FailureType {
  /** 环境问题：网络超时、依赖服务不可用等 */
  ENVIRONMENT = 'environment',
  
  /** 真实Bug：代码逻辑错误、功能缺陷 */
  REAL_BUG = 'real_bug',
  
  /** 测试脆弱性：选择器过时、时序问题、异步等待不足 */
  TEST_FRAGILITY = 'test_fragility',
  
  /** 未知：无法分类 */
  UNKNOWN = 'unknown'
}

export interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace: string;
  screenshot?: string;
  timestamp: Date;
  previousRuns?: TestRunHistory[];
  
  // 额外上下文
  selector?: string;
  expectedValue?: any;
  actualValue?: any;
  timeout?: number;
}

export interface TestRunHistory {
  timestamp: Date;
  passed: boolean;
  duration: number;
  errorMessage?: string;
}

export interface ClassificationResult {
  failureType: FailureType;
  confidence: number; // 0-1
  reasoning: string;
  suggestedActions: string[];
  isFlaky: boolean;
  metadata?: Record<string, any>;
}

export interface FailurePattern {
  pattern: RegExp;
  type: FailureType;
  keywords: string[];
  weight: number;
}

/**
 * 测试失败分类器
 */
export class FailureClassifier {
  private llmService?: LLMService;
  private patterns: FailurePattern[];

  constructor(llmService?: LLMService) {
    this.llmService = llmService;
    this.patterns = this.initializePatterns();
  }

  /**
   * 分类测试失败
   */
  async classify(failure: TestFailure): Promise<ClassificationResult> {
    // 1. 基于规则的快速分类
    const ruleBasedResult = this.classifyByRules(failure);
    
    // 2. 检查是否为 Flaky Test
    const isFlaky = this.detectFlakiness(failure);
    
    // 3. 如果有 LLM，使用 AI 增强分类
    if (this.llmService && ruleBasedResult.confidence < 0.8) {
      const llmEnhancedResult = await this.classifyByLLM(failure, ruleBasedResult);
      return {
        ...llmEnhancedResult,
        isFlaky
      };
    }
    
    return {
      ...ruleBasedResult,
      isFlaky
    };
  }

  /**
   * 基于规则的分类
   */
  private classifyByRules(failure: TestFailure): ClassificationResult {
    let bestMatch: ClassificationResult = {
      failureType: FailureType.UNKNOWN,
      confidence: 0,
      reasoning: 'No matching pattern found',
      suggestedActions: ['Investigate manually'],
      isFlaky: false
    };

    for (const pattern of this.patterns) {
      const match = this.matchPattern(failure, pattern);
      
      if (match.matched && match.confidence > bestMatch.confidence) {
        bestMatch = {
          failureType: pattern.type,
          confidence: match.confidence,
          reasoning: match.reasoning,
          suggestedActions: this.getSuggestedActions(pattern.type),
          isFlaky: false,
          metadata: {
            matchedPattern: pattern.pattern.source,
            matchedKeywords: match.matchedKeywords
          }
        };
      }
    }

    return bestMatch;
  }

  /**
   * 匹配失败模式
   */
  private matchPattern(
    failure: TestFailure,
    pattern: FailurePattern
  ): {
    matched: boolean;
    confidence: number;
    reasoning: string;
    matchedKeywords: string[];
  } {
    const text = `${failure.errorMessage} ${failure.stackTrace}`.toLowerCase();
    const matchedKeywords: string[] = [];
    
    // 检查正则表达式匹配
    const regexMatch = pattern.pattern.test(text);
    
    // 检查关键词匹配
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    
    const keywordMatchRate = matchedKeywords.length / pattern.keywords.length;
    const matched = regexMatch || keywordMatchRate > 0.5;
    
    if (!matched) {
      return {
        matched: false,
        confidence: 0,
        reasoning: '',
        matchedKeywords: []
      };
    }
    
    // 计算置信度
    let confidence = pattern.weight;
    
    if (regexMatch) {
      confidence += 0.2;
    }
    
    confidence += keywordMatchRate * 0.3;
    confidence = Math.min(confidence, 1.0);
    
    return {
      matched: true,
      confidence,
      reasoning: `Matched pattern: ${pattern.pattern.source} with keywords: ${matchedKeywords.join(', ')}`,
      matchedKeywords
    };
  }

  /**
   * 使用 LLM 增强分类
   */
  private async classifyByLLM(
    failure: TestFailure,
    ruleBasedResult: ClassificationResult
  ): Promise<ClassificationResult> {
    if (!this.llmService) {
      return ruleBasedResult;
    }

    const prompt = `
Analyze this test failure and classify it into one of these categories:
1. ENVIRONMENT - Environment issues (network timeout, service unavailable, etc.)
2. REAL_BUG - Real bugs (logic errors, functional defects)
3. TEST_FRAGILITY - Test fragility (outdated selectors, timing issues, async problems)

Test Failure Details:
- Test Name: ${failure.testName}
- Error Message: ${failure.errorMessage}
- Stack Trace: ${failure.stackTrace.substring(0, 500)}
${failure.selector ? `- Selector: ${failure.selector}` : ''}
${failure.expectedValue ? `- Expected: ${JSON.stringify(failure.expectedValue)}` : ''}
${failure.actualValue ? `- Actual: ${JSON.stringify(failure.actualValue)}` : ''}

Rule-based classification suggested: ${ruleBasedResult.failureType} (confidence: ${ruleBasedResult.confidence})

Provide:
1. The most likely failure type
2. Confidence score (0-1)
3. Brief reasoning (one sentence)
4. 2-3 suggested actions to fix this

Format your response as JSON:
{
  "failureType": "ENVIRONMENT|REAL_BUG|TEST_FRAGILITY",
  "confidence": 0.85,
  "reasoning": "brief explanation",
  "suggestedActions": ["action 1", "action 2"]
}
`;

    try {
      const response = await this.llmService.generate({
        provider: 'openai',
        model: 'gpt-4',
        prompt: prompt,
        temperature: 0.3,
        maxTokens: 300
      });

      const parsed = JSON.parse(response.content);
      
      return {
        failureType: parsed.failureType as FailureType,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        suggestedActions: parsed.suggestedActions,
        isFlaky: false,
        metadata: {
          llmEnhanced: true,
          ruleBasedType: ruleBasedResult.failureType
        }
      };
    } catch (error) {
      // LLM 失败，回退到规则分类
      return ruleBasedResult;
    }
  }

  /**
   * 检测 Flaky Test (不稳定测试)
   */
  private detectFlakiness(failure: TestFailure): boolean {
    if (!failure.previousRuns || failure.previousRuns.length < 3) {
      return false;
    }

    // 检查最近的运行历史
    const recentRuns = failure.previousRuns.slice(-10);
    const passCount = recentRuns.filter(run => run.passed).length;
    const failCount = recentRuns.length - passCount;
    
    // 如果通过和失败都有，很可能是 flaky test
    if (passCount > 0 && failCount > 0) {
      const flakyRatio = Math.min(passCount, failCount) / recentRuns.length;
      
      // 如果至少30%的时间在通过和失败之间切换
      return flakyRatio >= 0.3;
    }
    
    return false;
  }

  /**
   * 获取建议的修复操作
   */
  private getSuggestedActions(failureType: FailureType): string[] {
    switch (failureType) {
      case FailureType.ENVIRONMENT:
        return [
          'Check if external services are running',
          'Verify network connectivity',
          'Increase timeout values',
          'Add retry logic for transient failures'
        ];
      
      case FailureType.REAL_BUG:
        return [
          'Review the code logic in the failed assertion',
          'Check for recent code changes',
          'Add debug logging to understand the issue',
          'Create a bug ticket with reproduction steps'
        ];
      
      case FailureType.TEST_FRAGILITY:
        return [
          'Update element selectors to be more robust',
          'Add explicit waits for elements to be ready',
          'Use more stable locator strategies (ID > CSS > XPath)',
          'Consider using TestMind self-healing features'
        ];
      
      default:
        return [
          'Investigate the error message and stack trace',
          'Run the test locally to reproduce',
          'Check test logs for additional context'
        ];
    }
  }

  /**
   * 初始化失败模式
   */
  private initializePatterns(): FailurePattern[] {
    return [
      // 环境问题模式
      {
        pattern: /timeout|timed out|network|connection refused|econnrefused/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['timeout', 'network', 'connection', 'refused', 'unavailable'],
        weight: 0.7
      },
      {
        pattern: /service unavailable|503|502|504/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['service', 'unavailable', '503', '502', '504'],
        weight: 0.8
      },
      
      // 测试脆弱性模式
      {
        pattern: /element not found|no such element|cannot find element|selector/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['element', 'not found', 'selector', 'locator'],
        weight: 0.8
      },
      {
        pattern: /stale element|element is not attached|detached/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['stale', 'detached', 'not attached'],
        weight: 0.9
      },
      {
        pattern: /waiting for .* failed|wait .* timeout/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['waiting', 'wait', 'timeout'],
        weight: 0.7
      },
      
      // 真实 Bug 模式
      {
        pattern: /assertion failed|expected .* but got|received/i,
        type: FailureType.REAL_BUG,
        keywords: ['assertion', 'expected', 'actual', 'received'],
        weight: 0.6
      },
      {
        pattern: /undefined is not|cannot read property|null pointer/i,
        type: FailureType.REAL_BUG,
        keywords: ['undefined', 'null', 'property', 'pointer'],
        weight: 0.7
      },
      {
        pattern: /type error|reference error|syntax error/i,
        type: FailureType.REAL_BUG,
        keywords: ['TypeError', 'ReferenceError', 'SyntaxError'],
        weight: 0.8
      }
    ];
  }

  /**
   * 学习新的失败模式（用于持续改进）
   */
  async learnFromFailure(
    failure: TestFailure,
    actualType: FailureType
  ): Promise<void> {
    // TODO: 实现机器学习功能
    // 这可以用于：
    // 1. 调整现有模式的权重
    // 2. 发现新的失败模式
    // 3. 改进分类准确性
    
    // 暂时只记录到日志
    console.log(`Learning: ${failure.testName} -> ${actualType}`);
  }
}

/**
 * 便捷工厂函数
 */
export function createFailureClassifier(llmService?: LLMService): FailureClassifier {
  return new FailureClassifier(llmService);
}

