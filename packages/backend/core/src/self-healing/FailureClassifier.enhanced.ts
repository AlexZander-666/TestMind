// @ts-nocheck
/**
 * Enhanced FailureClassifier - 增强的失败分类器
 * 
 * 混合分类策略：规则引擎 + LLM 深度分析
 * 
 * 分类类型：
 * 1. 环境问题（environment_issue）：网络错误、超时、端口占用
 * 2. 测试脆弱性（test_fragility）：选择器失效、元素不可见、时序问题
 * 3. 真实 Bug（real_bug）：断言失败、业务逻辑错误、数据不一致
 */

import type { LLMService } from '../llm/LLMService';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('FailureClassifier_enhanced');

export interface TestFailure {
  /** 测试名称 */
  testName: string;
  
  /** 测试文件路径 */
  testFile: string;
  
  /** 错误消息 */
  error: string;
  
  /** 堆栈跟踪 */
  stackTrace?: string;
  
  /** 失败的选择器 */
  selector?: string;
  
  /** 预期值 */
  expectedValue?: any;
  
  /** 实际值 */
  actualValue?: any;
  
  /** 测试执行时长（毫秒） */
  duration?: number;
  
  /** 附加上下文 */
  context?: Record<string, any>;
}

export type FailureType = 'environment_issue' | 'test_fragility' | 'real_bug';

export interface ClassificationResult {
  /** 失败类型 */
  failureType: FailureType;
  
  /** 置信度 (0-1) */
  confidence: number;
  
  /** 分类理由 */
  reason: string;
  
  /** 应用的规则 */
  appliedRules: string[];
  
  /** 是否使用了 LLM */
  usedLLM: boolean;
  
  /** 修复建议 */
  recommendations?: string[];
}

interface ClassificationRule {
  name: string;
  type: FailureType;
  confidence: number;
  test: (failure: TestFailure) => boolean;
  reason: string;
}

/**
 * 增强的失败分类器
 * 
 * 工作流程：
 * 1. 首先应用规则引擎（快速、无成本）
 * 2. 如果规则引擎置信度 >= 0.9，直接返回结果
 * 3. 否则调用 LLM 进行深度分析
 * 4. 融合规则和 LLM 结果
 */
export class EnhancedFailureClassifier {
  private readonly llmService?: LLMService;
  private readonly rules: ClassificationRule[];

  constructor(llmService?: LLMService) {
    this.llmService = llmService;
    this.rules = this.buildClassificationRules();
  }

  /**
   * 分类测试失败
   */
  async classify(failure: TestFailure): Promise<ClassificationResult> {
    // 1. 规则引擎快速分类
    const ruleResult = this.applyRules(failure);
    
    // 高置信度规则结果，直接返回
    if (ruleResult.confidence >= 0.9) {
      return {
        ...ruleResult,
        usedLLM: false,
      };
    }

    // 2. LLM 深度分析（如果可用且规则置信度不足）
    if (this.llmService && ruleResult.confidence < 0.85) {
      try {
        const llmResult = await this.llmClassify(failure);
        
        if (llmResult) {
          // 3. 融合规则和 LLM 结果
          return this.mergeResults(ruleResult, llmResult);
        }
      } catch (error) {
        logger.error('[FailureClassifier] LLM classification failed:', error);
        // 如果 LLM 失败，返回规则结果
      }
    }

    // 3. 返回规则结果（如果没有 LLM 或 LLM 失败）
    return {
      ...ruleResult,
      usedLLM: false,
    };
  }

  /**
   * 应用规则引擎进行分类
   */
  private applyRules(failure: TestFailure): Omit<ClassificationResult, 'usedLLM'> {
    const appliedRules: string[] = [];
    let bestMatch: ClassificationRule | null = null;
    let bestConfidence = 0;

    // 应用所有规则，找到最佳匹配
    for (const rule of this.rules) {
      if (rule.test(failure)) {
        appliedRules.push(rule.name);
        
        if (rule.confidence > bestConfidence) {
          bestConfidence = rule.confidence;
          bestMatch = rule;
        }
      }
    }

    // 如果没有规则匹配，返回默认分类
    if (!bestMatch) {
      return {
        failureType: 'test_fragility',
        confidence: 0.5,
        reason: 'No specific rule matched, defaulting to test fragility',
        appliedRules: [],
        recommendations: ['Review test implementation', 'Check for race conditions'],
      };
    }

    // 返回最佳匹配规则的结果
    return {
      failureType: bestMatch.type,
      confidence: bestMatch.confidence,
      reason: bestMatch.reason,
      appliedRules,
      recommendations: this.generateRuleBasedRecommendations(bestMatch.type),
    };
  }

  /**
   * 使用 LLM 进行深度分类
   */
  private async llmClassify(failure: TestFailure): Promise<Omit<ClassificationResult, 'usedLLM'> | null> {
    if (!this.llmService) {
      return null;
    }

    try {
      const prompt = this.buildLLMPrompt(failure);
      
      const response = await this.llmService.generate({
        provider: 'openai',
        model: 'gpt-4',
        prompt,
        temperature: 0.2, // 低温度，更确定性
        maxTokens: 300,
      });

      return this.parseLLMResponse(response.content);
    } catch (error) {
      logger.error('[FailureClassifier] LLM classification error:', error);
      return null;
    }
  }

  /**
   * 构建 LLM 分类提示
   */
  private buildLLMPrompt(failure: TestFailure): string {
    return `Analyze this test failure and classify it into one of three categories:
1. environment_issue: Network errors, timeouts, port conflicts, missing dependencies
2. test_fragility: Selector failures, timing issues, flaky tests, test implementation problems
3. real_bug: Assertion failures, business logic errors, data inconsistencies

Test Information:
- Test: ${failure.testName}
- File: ${failure.testFile}
- Error: ${failure.error}
${failure.stackTrace ? `- Stack Trace:\n${failure.stackTrace.split('\n').slice(0, 5).join('\n')}` : ''}
${failure.selector ? `- Selector: ${failure.selector}` : ''}
${failure.expectedValue ? `- Expected: ${failure.expectedValue}` : ''}
${failure.actualValue ? `- Actual: ${failure.actualValue}` : ''}

Respond in JSON format:
{
  "failureType": "environment_issue" | "test_fragility" | "real_bug",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "recommendations": ["suggestion 1", "suggestion 2"]
}`;
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(content: string): Omit<ClassificationResult, 'usedLLM'> | null {
    try {
      // 提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        failureType: parsed.failureType,
        confidence: parsed.confidence || 0.75,
        reason: parsed.reason || 'LLM classification',
        appliedRules: ['LLM_ANALYSIS'],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      logger.error('[FailureClassifier] Failed to parse LLM response:', error);
      return null;
    }
  }

  /**
   * 融合规则和 LLM 结果
   */
  private mergeResults(
    ruleResult: Omit<ClassificationResult, 'usedLLM'>,
    llmResult: Omit<ClassificationResult, 'usedLLM'>,
  ): ClassificationResult {
    // 如果分类一致，提升置信度
    if (ruleResult.failureType === llmResult.failureType) {
      return {
        failureType: ruleResult.failureType,
        confidence: Math.min(0.98, (ruleResult.confidence + llmResult.confidence) / 2 + 0.1),
        reason: `${ruleResult.reason}. LLM agrees: ${llmResult.reason}`,
        appliedRules: [...ruleResult.appliedRules, 'LLM_CONFIRMATION'],
        recommendations: [
          ...(ruleResult.recommendations || []),
          ...(llmResult.recommendations || []),
        ],
        usedLLM: true,
      };
    }

    // 如果分类不一致，选择置信度更高的
    if (llmResult.confidence > ruleResult.confidence) {
      return {
        ...llmResult,
        appliedRules: [...ruleResult.appliedRules, 'LLM_OVERRIDE'],
        usedLLM: true,
      };
    }

    return {
      ...ruleResult,
      reason: `${ruleResult.reason}. LLM disagrees (suggested: ${llmResult.failureType})`,
      appliedRules: [...ruleResult.appliedRules, 'LLM_DISAGREEMENT'],
      usedLLM: true,
    };
  }

  /**
   * 构建分类规则集
   */
  private buildClassificationRules(): ClassificationRule[] {
    return [
      // ==================== 环境问题规则 ====================
      {
        name: 'NETWORK_CONNECTION_ERROR',
        type: 'environment_issue',
        confidence: 0.95,
        test: (f) => /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ERR_CONNECTION/.test(f.error),
        reason: 'Network connection error detected',
      },
      {
        name: 'HTTP_TIMEOUT',
        type: 'environment_issue',
        confidence: 0.93,
        test: (f) => /timeout|timed out/i.test(f.error) && !/wait.*timeout/i.test(f.error),
        reason: 'HTTP request timeout',
      },
      {
        name: 'PORT_IN_USE',
        type: 'environment_issue',
        confidence: 0.95,
        test: (f) => /EADDRINUSE|port.*already.*use/i.test(f.error),
        reason: 'Port already in use',
      },
      {
        name: 'MISSING_DEPENDENCY',
        type: 'environment_issue',
        confidence: 0.92,
        test: (f) => /cannot find module|MODULE_NOT_FOUND|import.*failed/i.test(f.error),
        reason: 'Missing dependency or import error',
      },
      {
        name: 'FILE_NOT_FOUND',
        type: 'environment_issue',
        confidence: 0.90,
        test: (f) => /ENOENT|file not found|no such file/i.test(f.error),
        reason: 'File or directory not found',
      },
      {
        name: 'PERMISSION_DENIED',
        type: 'environment_issue',
        confidence: 0.93,
        test: (f) => /EACCES|permission denied|access denied/i.test(f.error),
        reason: 'Permission denied',
      },
      {
        name: 'OUT_OF_MEMORY',
        type: 'environment_issue',
        confidence: 0.95,
        test: (f) => /out of memory|heap.*limit|OOM|ENOMEM/i.test(f.error),
        reason: 'Out of memory error',
      },

      // ==================== 测试脆弱性规则 ====================
      {
        name: 'ELEMENT_NOT_FOUND',
        type: 'test_fragility',
        confidence: 0.88,
        test: (f) => /element not found|no.*element|could not find element/i.test(f.error) && !!f.selector,
        reason: 'Element selector failed - possible DOM structure change',
      },
      {
        name: 'ELEMENT_NOT_VISIBLE',
        type: 'test_fragility',
        confidence: 0.85,
        test: (f) => /not visible|hidden|display.*none|opacity.*0/i.test(f.error),
        reason: 'Element not visible - timing or CSS issue',
      },
      {
        name: 'ELEMENT_DETACHED',
        type: 'test_fragility',
        confidence: 0.87,
        test: (f) => /detached|stale element|element.*no longer attached/i.test(f.error),
        reason: 'Element became detached from DOM - race condition',
      },
      {
        name: 'WAIT_TIMEOUT',
        type: 'test_fragility',
        confidence: 0.82,
        test: (f) => /wait.*timeout|waiting.*timed out|expect.*timeout/i.test(f.error),
        reason: 'Wait condition timeout - element may load slowly',
      },
      {
        name: 'FRAGILE_CSS_SELECTOR',
        type: 'test_fragility',
        confidence: 0.80,
        test: (f) => {
          if (!f.selector) return false;
          // 检测脆弱的选择器模式
          return /nth-child|:first-child|:last-child|>.*>.*>/i.test(f.selector) ||
                 (f.selector.match(/\./g) || []).length >= 3; // 3+ class selectors
        },
        reason: 'Using fragile CSS selector (nth-child, deep nesting)',
      },
      {
        name: 'FLAKY_TEST_PATTERN',
        type: 'test_fragility',
        confidence: 0.75,
        test: (f) => {
          // 检测随机性失败
          const hasFlakyPattern = /random|intermittent|flaky/i.test(f.context?.history || '');
          const isSlow = Boolean(f.duration && f.duration > 30000); // 超过30秒的测试更容易flaky
          return hasFlakyPattern || isSlow;
        },
        reason: 'Test shows flaky behavior patterns',
      },

      // ==================== 真实 Bug 规则 ====================
      {
        name: 'ASSERTION_FAILURE',
        type: 'real_bug',
        confidence: 0.85,
        test: (f) => {
          const hasExpectedActual = f.expectedValue !== undefined && f.actualValue !== undefined;
          const hasAssertionKeyword = /assert|expect|should|toBe|toEqual/i.test(f.error);
          return hasExpectedActual || hasAssertionKeyword;
        },
        reason: 'Assertion failed - expected value does not match actual',
      },
      {
        name: 'INCORRECT_CALCULATION',
        type: 'real_bug',
        confidence: 0.88,
        test: (f) => {
          if (!f.expectedValue || !f.actualValue) return false;
          const exp = String(f.expectedValue);
          const act = String(f.actualValue);
          // 数值不匹配
          return /^\d+$/.test(exp) && /^\d+$/.test(act) && exp !== act;
        },
        reason: 'Numerical calculation mismatch',
      },
      {
        name: 'NULL_REFERENCE',
        type: 'real_bug',
        confidence: 0.90,
        test: (f) => /cannot read property.*undefined|null.*not.*object|undefined.*not.*function/i.test(f.error),
        reason: 'Null or undefined reference error',
      },
      {
        name: 'TYPE_ERROR',
        type: 'real_bug',
        confidence: 0.87,
        test: (f) => /TypeError|type.*not.*match|wrong type|invalid type/i.test(f.error),
        reason: 'Type mismatch or type error',
      },
      {
        name: 'DATA_VALIDATION_ERROR',
        type: 'real_bug',
        confidence: 0.86,
        test: (f) => /validation.*failed|invalid.*format|schema.*error|constraint.*violation/i.test(f.error),
        reason: 'Data validation or schema error',
      },
      {
        name: 'BUSINESS_LOGIC_ERROR',
        type: 'real_bug',
        confidence: 0.83,
        test: (f) => {
          // 检测业务逻辑关键词
          const businessKeywords = /unauthorized|forbidden|insufficient.*balance|quota.*exceeded|invalid.*state/i;
          return businessKeywords.test(f.error);
        },
        reason: 'Business logic constraint violated',
      },
    ];
  }

  /**
   * 生成基于规则的修复建议
   */
  private generateRuleBasedRecommendations(type: FailureType): string[] {
    switch (type) {
      case 'environment_issue':
        return [
          'Check network connectivity and service availability',
          'Verify all required dependencies are installed',
          'Review environment configuration (ports, permissions, resources)',
          'Check logs for infrastructure issues',
        ];

      case 'test_fragility':
        return [
          'Use more stable selectors (data-testid, aria-label, role)',
          'Add explicit waits for dynamic content',
          'Review test timing and race conditions',
          'Consider using visual or semantic locators as fallback',
          'Check if UI structure has changed',
        ];

      case 'real_bug':
        return [
          'Review the failed assertion and business logic',
          'Check for null/undefined values',
          'Verify data validation and type correctness',
          'Investigate the root cause in application code',
          'Add debugging logs to understand the failure',
        ];

      default:
        return ['Review the test and application code'];
    }
  }

  /**
   * 批量分类多个失败
   */
  async classifyBatch(failures: TestFailure[]): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    for (const failure of failures) {
      try {
        const result = await this.classify(failure);
        results.set(failure.testName, result);
      } catch (error) {
        logger.error(`[FailureClassifier] Failed to classify ${failure.testName}:`, error);
      }
    }

    return results;
  }

  /**
   * 生成分类统计报告
   */
  generateReport(results: Map<string, ClassificationResult>): string {
    const stats = {
      total: results.size,
      environment: 0,
      fragility: 0,
      bug: 0,
      llmUsed: 0,
    };

    for (const result of results.values()) {
      if (result.failureType === 'environment_issue') stats.environment++;
      if (result.failureType === 'test_fragility') stats.fragility++;
      if (result.failureType === 'real_bug') stats.bug++;
      if (result.usedLLM) stats.llmUsed++;
    }

    let report = '# Failure Classification Report\n\n';
    report += `**Total Failures**: ${stats.total}\n\n`;
    report += '**Classification Breakdown**:\n';
    report += `- 🌐 Environment Issues: ${stats.environment} (${(stats.environment / stats.total * 100).toFixed(1)}%)\n`;
    report += `- 🧪 Test Fragility: ${stats.fragility} (${(stats.fragility / stats.total * 100).toFixed(1)}%)\n`;
    report += `- 🐛 Real Bugs: ${stats.bug} (${(stats.bug / stats.total * 100).toFixed(1)}%)\n\n`;
    report += `**LLM Analysis Used**: ${stats.llmUsed} / ${stats.total} (${(stats.llmUsed / stats.total * 100).toFixed(1)}%)\n\n`;

    return report;
  }
}

/**
 * 便捷工厂函数
 */
export function createFailureClassifier(llmService?: LLMService): EnhancedFailureClassifier {
  return new EnhancedFailureClassifier(llmService);
}

