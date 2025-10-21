/**
 * FailureAnalyzer - 测试失败分析器
 * 收集和分析测试失败的上下文信息
 */

import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('FailureAnalyzer');

export interface FailureContext {
  error: Error;
  testCode: string;
  testName: string;
  timestamp: Date;
  screenshot?: string; // Base64 编码的截图
  domSnapshot?: string; // HTML DOM 快照
  networkLogs?: NetworkLog[];
  consoleErrors?: string[];
  stackTrace?: string;
}

export interface NetworkLog {
  url: string;
  method: string;
  status: number;
  timestamp: Date;
  duration: number;
}

export interface AnalysisResult {
  errorMessage: string;
  errorType: string;
  stackTrace?: string;
  affectedElement?: string;
  possibleCauses: string[];
  contextData: Record<string, any>;
}

export class FailureAnalyzer {
  /**
   * 分析测试失败的上下文
   */
  async analyzeFailure(context: FailureContext): Promise<AnalysisResult> {
    logger.info('Analyzing test failure', {
      testName: context.testName,
      error: context.error.message,
    });

    const result: AnalysisResult = {
      errorMessage: context.error.message,
      errorType: context.error.name,
      possibleCauses: [],
      contextData: {},
      stackTrace: this.parseStackTrace(context.error),
      affectedElement: this.extractAffectedElement(context.error),
    };

    // 解析堆栈跟踪和受影响的元素（已完成）

    // 2. 分析网络日志
    if (context.networkLogs) {
      const networkIssues = this.analyzeNetworkLogs(context.networkLogs);
      if (networkIssues.length > 0) {
        result.possibleCauses.push(...networkIssues);
        result.contextData.networkIssues = networkIssues;
      }
    }

    // 3. 分析控制台错误
    if (context.consoleErrors && context.consoleErrors.length > 0) {
      result.possibleCauses.push('Console errors detected in the application');
      result.contextData.consoleErrors = context.consoleErrors;
    }

    // 4. 分析 DOM 状态
    if (context.domSnapshot) {
      const domIssues = this.analyzeDomSnapshot(context.domSnapshot, result.affectedElement);
      if (domIssues.length > 0) {
        result.possibleCauses.push(...domIssues);
      }
    }

    // 5. 分析测试代码
    const codeIssues = this.analyzeTestCode(context.testCode, context.error);
    if (codeIssues.length > 0) {
      result.possibleCauses.push(...codeIssues);
    }

    logger.debug('Analysis complete', {
      causes: result.possibleCauses.length,
      errorType: result.errorType,
    });

    return result;
  }

  /**
   * 解析堆栈跟踪
   */
  private parseStackTrace(error: Error): string {
    if (error.stack) {
      // 提取关键的堆栈帧（过滤框架内部代码）
      const frames = error.stack.split('\n')
        .filter(line => line.trim())
        .filter(line => !line.includes('node_modules'))
        .filter(line => !line.includes('internal/'))
        .slice(0, 5); // 只保留前5帧

      return frames.join('\n');
    }
    return '';
  }

  /**
   * 从错误消息中提取受影响的元素
   */
  private extractAffectedElement(error: Error): string | undefined {
    const message = error.message;

    // 常见的元素定位模式
    const patterns = [
      /#[\w-]+/,                    // ID: #login-button
      /\[data-testid="[^"]+"\]/,    // data-testid
      /\[id="[^"]+"\]/,              // id attribute
      /\[class="[^"]+"\]/,           // class attribute
      /button:contains\("([^"]+)"\)/, // text content
      /\/\/[^\s]+/,                  // XPath
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * 分析网络日志
   */
  private analyzeNetworkLogs(logs: NetworkLog[]): string[] {
    const issues: string[] = [];

    // 检查失败的请求
    const failedRequests = logs.filter(log => log.status >= 400);
    if (failedRequests.length > 0) {
      issues.push(
        `${failedRequests.length} network request(s) failed: ${
          failedRequests.map(r => `${r.method} ${r.url} (${r.status})`).join(', ')
        }`
      );
    }

    // 检查慢请求
    const slowRequests = logs.filter(log => log.duration > 5000);
    if (slowRequests.length > 0) {
      issues.push(
        `${slowRequests.length} slow network request(s) detected (>5s)`
      );
    }

    // 检查超时
    const timeouts = logs.filter(log => log.status === 0);
    if (timeouts.length > 0) {
      issues.push(`${timeouts.length} request(s) timed out`);
    }

    return issues;
  }

  /**
   * 分析 DOM 快照
   */
  private analyzeDomSnapshot(snapshot: string, targetElement?: string): string[] {
    const issues: string[] = [];

    try {
      // 检查目标元素是否存在
      if (targetElement) {
        const exists = snapshot.includes(targetElement);
        if (!exists) {
          issues.push(`Target element "${targetElement}" not found in DOM`);
        }
      }

      // 检查常见的 DOM 问题
      if (snapshot.includes('display: none')) {
        issues.push('Some elements are hidden (display: none)');
      }

      if (snapshot.includes('visibility: hidden')) {
        issues.push('Some elements are not visible (visibility: hidden)');
      }

      // 检查是否有加载指示器
      if (snapshot.includes('loading') || snapshot.includes('spinner')) {
        issues.push('Loading indicator detected - page may still be loading');
      }

      // 检查是否有错误消息
      if (snapshot.includes('error') || snapshot.includes('Error')) {
        issues.push('Error message detected in the page content');
      }

    } catch (error) {
      logger.warn('Failed to analyze DOM snapshot', { error });
    }

    return issues;
  }

  /**
   * 分析测试代码
   */
  private analyzeTestCode(testCode: string, error: Error): string[] {
    const issues: string[] = [];
    const message = error.message.toLowerCase();

    // 检查超时相关问题
    if (message.includes('timeout') || message.includes('timed out')) {
      if (!testCode.includes('await') && testCode.includes('.click(')) {
        issues.push('Missing await before async action - this may cause timeout');
      }

      if (!testCode.includes('waitFor')) {
        issues.push('No explicit wait found - consider using waitFor* methods');
      }
    }

    // 检查元素定位问题
    if (message.includes('element not found') || message.includes('could not find')) {
      if (testCode.match(/\.\w+\s*\(/g)?.length > 5) {
        issues.push('Complex selector chain detected - may be fragile');
      }

      if (testCode.includes('[0]') || testCode.includes('first()')) {
        issues.push('Using array indexing or first() - element order may have changed');
      }
    }

    // 检查断言问题
    if (message.includes('expected') && message.includes('but got')) {
      if (!testCode.includes('toEqual') && !testCode.includes('toBe')) {
        issues.push('Assertion failure - expected value may have changed');
      }
    }

    return issues;
  }

  /**
   * 收集失败上下文（用于与 Playwright/Cypress 等框架集成）
   */
  async collectFailureContext(
    error: Error,
    testCode: string,
    testName: string,
    page?: any // Playwright Page or Cypress window
  ): Promise<FailureContext> {
    const context: FailureContext = {
      error,
      testCode,
      testName,
      timestamp: new Date(),
    };

    try {
      // 尝试收集截图（如果页面对象可用）
      if (page?.screenshot) {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        context.screenshot = screenshot as string;
      }

      // 尝试收集 DOM 快照
      if (page?.content) {
        const content = await page.content();
        context.domSnapshot = content;
      }

      // 尝试收集控制台日志（Playwright）
      if (page?.context) {
        const logs = await this.collectConsoleLogs(page);
        context.consoleErrors = logs;
      }

      // 尝试收集网络日志（Playwright）
      if (page?._networkRecorder) {
        const networkLogs = await this.collectNetworkLogs(page);
        context.networkLogs = networkLogs;
      }

    } catch (collectionError) {
      logger.warn('Failed to collect some failure context', { collectionError });
    }

    return context;
  }

  /**
   * 收集控制台日志
   */
  private async collectConsoleLogs(page: any): Promise<string[]> {
    // 在真实实现中，这会从页面对象收集控制台日志
    // 现在返回空数组
    return [];
  }

  /**
   * 收集网络日志
   */
  private async collectNetworkLogs(page: any): Promise<NetworkLog[]> {
    // 在真实实现中，这会从页面对象收集网络请求日志
    // 现在返回空数组
    return [];
  }
}





