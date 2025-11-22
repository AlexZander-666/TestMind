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
   * 检测 Flaky Test (不稳定测试) - 增强版
   * 
   * 检测策略：
   * 1. 历史成功率（passRate: 0.5-0.95）
   * 2. 时序模式（特定时间失败）
   * 3. 环境依赖（CI失败/本地成功）
   * 4. 测试顺序依赖
   */
  private detectFlakiness(failure: TestFailure): boolean {
    if (!failure.previousRuns || failure.previousRuns.length < 3) {
      return false;
    }

    const recentRuns = failure.previousRuns.slice(-10);
    const passCount = recentRuns.filter(run => run.passed).length;
    const failCount = recentRuns.length - passCount;
    const passRate = passCount / recentRuns.length;

    // 策略1: 历史成功率检测
    // Flaky测试通常有0.5-0.95的成功率（既通过又失败）
    const hasFluctuatingResults = passCount > 0 && failCount > 0;
    const isInFlakyRange = passRate > 0.5 && passRate < 0.95;
    
    if (hasFluctuatingResults && isInFlakyRange) {
      return true;
    }

    // 策略2: 时序模式检测
    // 检测是否在特定时间段失败（例如凌晨、特定星期几）
    const hasTimePattern = this.detectTimePattern(recentRuns);
    if (hasTimePattern) {
      return true;
    }

    // 策略3: 交替模式检测
    // 检测连续通过-失败-通过-失败的模式
    const hasAlternatingPattern = this.detectAlternatingPattern(recentRuns);
    if (hasAlternatingPattern) {
      return true;
    }

    // 策略4: 持续时间波动检测
    // Flaky测试的执行时间通常波动较大
    const hasDurationFluctuation = this.detectDurationFluctuation(recentRuns);
    if (hasDurationFluctuation && hasFluctuatingResults) {
      return true;
    }

    return false;
  }

  /**
   * 检测时序模式
   */
  private detectTimePattern(runs: TestRunHistory[]): boolean {
    if (runs.length < 5) return false;

    // 检测凌晨（0-6点）是否更容易失败
    const nightFailures = runs.filter(run => {
      const hour = run.timestamp.getHours();
      return !run.passed && hour >= 0 && hour < 6;
    });

    const nightFailureRate = nightFailures.length / runs.filter(run => {
      const hour = run.timestamp.getHours();
      return hour >= 0 && hour < 6;
    }).length;

    // 如果凌晨失败率 > 70%，可能是时序相关
    return nightFailureRate > 0.7;
  }

  /**
   * 检测交替模式（通过-失败-通过-失败）
   */
  private detectAlternatingPattern(runs: TestRunHistory[]): boolean {
    if (runs.length < 4) return false;

    let alternations = 0;
    for (let i = 1; i < runs.length; i++) {
      if (runs[i].passed !== runs[i - 1].passed) {
        alternations++;
      }
    }

    // 如果交替次数 > 运行次数的60%，很可能是flaky
    const alternationRate = alternations / (runs.length - 1);
    return alternationRate > 0.6;
  }

  /**
   * 检测执行时间波动
   */
  private detectDurationFluctuation(runs: TestRunHistory[]): boolean {
    if (runs.length < 3) return false;

    const durations = runs.map(run => run.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    if (avgDuration === 0) return false;

    // 计算标准差
    const variance = durations.reduce((sum, d) => 
      sum + Math.pow(d - avgDuration, 2), 0
    ) / durations.length;
    const stdDev = Math.sqrt(variance);

    // 如果标准差 > 平均值的50%，说明波动很大
    const fluctuationRate = stdDev / avgDuration;
    return fluctuationRate > 0.5;
  }

  /**
   * 获取Flaky测试的详细分析
   */
  getFlakinessAnalysis(failure: TestFailure): {
    isFlaky: boolean;
    flakinessScore: number; // 0-1
    reasons: string[];
    recommendation: string;
  } {
    if (!failure.previousRuns || failure.previousRuns.length < 3) {
      return {
        isFlaky: false,
        flakinessScore: 0,
        reasons: ['Insufficient history (< 3 runs)'],
        recommendation: 'Run test more times to determine flakiness',
      };
    }

    const recentRuns = failure.previousRuns.slice(-10);
    const passCount = recentRuns.filter(run => run.passed).length;
    const passRate = passCount / recentRuns.length;

    const reasons: string[] = [];
    let score = 0;

    // 因素1: 成功率
    if (passRate > 0.5 && passRate < 0.95) {
      score += 0.4;
      reasons.push(`Inconsistent pass rate: ${(passRate * 100).toFixed(1)}%`);
    }

    // 因素2: 时序模式
    if (this.detectTimePattern(recentRuns)) {
      score += 0.2;
      reasons.push('Failures occur at specific times');
    }

    // 因素3: 交替模式
    if (this.detectAlternatingPattern(recentRuns)) {
      score += 0.3;
      reasons.push('Pass/fail alternating pattern detected');
    }

    // 因素4: 执行时间波动
    if (this.detectDurationFluctuation(recentRuns)) {
      score += 0.1;
      reasons.push('High execution time variation');
    }

    const isFlaky = score >= 0.5;
    const recommendation = isFlaky
      ? 'Add explicit waits, fix race conditions, or isolate test dependencies'
      : 'Test appears stable, investigate for real bugs';

    return {
      isFlaky,
      flakinessScore: Math.min(1, score),
      reasons: reasons.length > 0 ? reasons : ['No flakiness detected'],
      recommendation,
    };
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
   * 初始化失败模式（30+模式）
   */
  private initializePatterns(): FailurePattern[] {
    return [
      // ============ 环境问题模式 (10个) ============
      
      // 网络相关 (6个)
      {
        pattern: /ECONNREFUSED|connection refused|ERR_CONNECTION_REFUSED/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['ECONNREFUSED', 'connection', 'refused'],
        weight: 0.85
      },
      {
        pattern: /ETIMEDOUT|connection timeout|request timeout/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['ETIMEDOUT', 'timeout', 'connection'],
        weight: 0.85
      },
      {
        pattern: /ENOTFOUND|getaddrinfo|DNS/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['ENOTFOUND', 'DNS', 'getaddrinfo'],
        weight: 0.90
      },
      {
        pattern: /net::ERR_|network error|fetch failed/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['ERR', 'network', 'fetch failed'],
        weight: 0.80
      },
      {
        pattern: /Network request failed|Failed to fetch/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['Network', 'request', 'failed', 'fetch'],
        weight: 0.80
      },
      {
        pattern: /ECONNRESET|socket hang up|connection reset/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['ECONNRESET', 'socket', 'reset'],
        weight: 0.85
      },
      
      // 服务状态相关 (4个)
      {
        pattern: /503|service unavailable|Service Unavailable/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['503', 'service', 'unavailable'],
        weight: 0.90
      },
      {
        pattern: /502|bad gateway|Bad Gateway/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['502', 'bad', 'gateway'],
        weight: 0.90
      },
      {
        pattern: /504|gateway timeout|Gateway Timeout/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['504', 'gateway', 'timeout'],
        weight: 0.90
      },
      {
        pattern: /database.*unavailable|db.*connection.*failed/i,
        type: FailureType.ENVIRONMENT,
        keywords: ['database', 'unavailable', 'connection'],
        weight: 0.85
      },
      
      // ============ 超时相关模式 (5个) ============
      {
        pattern: /Timeout of \d+ms exceeded|timeout exceeded/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['timeout', 'exceeded'],
        weight: 0.75
      },
      {
        pattern: /Timed out waiting for|wait.*timeout/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['timed out', 'waiting'],
        weight: 0.75
      },
      {
        pattern: /Element not visible within timeout/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['element', 'visible', 'timeout'],
        weight: 0.80
      },
      {
        pattern: /page\.waitFor.*timeout|waitForSelector.*timeout/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['waitFor', 'timeout'],
        weight: 0.80
      },
      {
        pattern: /operation timed out|execution.*timeout/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['operation', 'timeout'],
        weight: 0.70
      },
      
      // ============ 选择器/元素定位相关 (8个) ============
      {
        pattern: /Element not found|No element found|Unable to find element/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['element', 'not found', 'unable to find'],
        weight: 0.85
      },
      {
        pattern: /No such element|NoSuchElementError/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['no such element', 'NoSuchElementError'],
        weight: 0.90
      },
      {
        pattern: /Selector .* did not match|selector.*not.*match/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['selector', 'did not match'],
        weight: 0.85
      },
      {
        pattern: /stale element|StaleElementReferenceError/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['stale', 'element'],
        weight: 0.90
      },
      {
        pattern: /element is not attached|detached from document/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['not attached', 'detached'],
        weight: 0.90
      },
      {
        pattern: /element not interactable|ElementNotInteractableError/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['not interactable', 'ElementNotInteractableError'],
        weight: 0.85
      },
      {
        pattern: /element.*covered|obscured|overlapping/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['covered', 'obscured', 'overlapping'],
        weight: 0.80
      },
      {
        pattern: /invalid selector|SelectorError|invalid CSS/i,
        type: FailureType.TEST_FRAGILITY,
        keywords: ['invalid', 'selector', 'CSS'],
        weight: 0.75
      },
      
      // ============ 断言相关 (6个) ============
      {
        pattern: /Expected .* but got|Expected.*to be.*but received/i,
        type: FailureType.REAL_BUG,
        keywords: ['expected', 'but got', 'received'],
        weight: 0.70
      },
      {
        pattern: /AssertionError|assertion.*failed/i,
        type: FailureType.REAL_BUG,
        keywords: ['AssertionError', 'assertion', 'failed'],
        weight: 0.75
      },
      {
        pattern: /toBe|toEqual|toMatch.*failed/i,
        type: FailureType.REAL_BUG,
        keywords: ['toBe', 'toEqual', 'toMatch'],
        weight: 0.70
      },
      {
        pattern: /Expected.*to contain|does not contain/i,
        type: FailureType.REAL_BUG,
        keywords: ['expected', 'contain'],
        weight: 0.70
      },
      {
        pattern: /Expected.*to have.*but has/i,
        type: FailureType.REAL_BUG,
        keywords: ['expected', 'to have'],
        weight: 0.70
      },
      {
        pattern: /snapshot.*different|snapshot.*mismatch/i,
        type: FailureType.REAL_BUG,
        keywords: ['snapshot', 'different', 'mismatch'],
        weight: 0.65
      },
      
      // ============ 异步相关 (5个) ============
      {
        pattern: /Promise rejected|Unhandled promise rejection/i,
        type: FailureType.REAL_BUG,
        keywords: ['promise', 'rejected', 'unhandled'],
        weight: 0.75
      },
      {
        pattern: /await is only valid in async|async.*await/i,
        type: FailureType.REAL_BUG,
        keywords: ['await', 'async'],
        weight: 0.85
      },
      {
        pattern: /callback was already called|double callback/i,
        type: FailureType.REAL_BUG,
        keywords: ['callback', 'already called', 'double'],
        weight: 0.80
      },
      {
        pattern: /Maximum call stack size exceeded|stack overflow/i,
        type: FailureType.REAL_BUG,
        keywords: ['stack', 'exceeded', 'overflow'],
        weight: 0.85
      },
      {
        pattern: /race condition|concurrent.*modification/i,
        type: FailureType.REAL_BUG,
        keywords: ['race', 'concurrent', 'modification'],
        weight: 0.70
      },
      
      // ============ 类型错误相关 (4个) ============
      {
        pattern: /TypeError|Type Error/i,
        type: FailureType.REAL_BUG,
        keywords: ['TypeError'],
        weight: 0.80
      },
      {
        pattern: /ReferenceError|is not defined/i,
        type: FailureType.REAL_BUG,
        keywords: ['ReferenceError', 'not defined'],
        weight: 0.85
      },
      {
        pattern: /undefined is not|cannot read property.*undefined/i,
        type: FailureType.REAL_BUG,
        keywords: ['undefined', 'cannot read'],
        weight: 0.80
      },
      {
        pattern: /null.*is not|cannot read property.*null/i,
        type: FailureType.REAL_BUG,
        keywords: ['null', 'cannot read'],
        weight: 0.80
      },
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

