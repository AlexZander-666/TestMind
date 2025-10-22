/**
 * FlakyTestPrevention - Flaky Test 预防系统
 * 
 * 功能：
 * - 检测时间依赖
 * - 检测随机数依赖
 * - 检测网络调用（未 mock）
 * - 检测异步竞态条件
 * - 检测全局状态污染
 * - 自动修复常见问题
 */

import { createComponentLogger } from '../utils/logger';

export interface FlakyIssue {
  type: 'time-dependency' | 'random-dependency' | 'network-dependency' | 
        'race-condition' | 'global-state' | 'timing-issue';
  line: number;
  code: string;
  description: string;
  fix: string;
  autoFixable: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface FixResult {
  issues: FlakyIssue[];
  fixedCode: string;
  autoFixedCount: number;
}

export class FlakyTestPrevention {
  private logger = createComponentLogger('FlakyTestPrevention');

  /**
   * 分析并修复 Flaky Test 问题
   */
  analyzeAndFix(testCode: string): FixResult {
    this.logger.debug('Analyzing test for flaky patterns');

    const issues: FlakyIssue[] = [];

    // 1. 检测时间依赖
    issues.push(...this.detectTimeDependency(testCode));

    // 2. 检测随机数
    issues.push(...this.detectRandomDependency(testCode));

    // 3. 检测网络调用
    issues.push(...this.detectNetworkDependency(testCode));

    // 4. 检测异步竞态条件
    issues.push(...this.detectRaceConditions(testCode));

    // 5. 检测全局状态污染
    issues.push(...this.detectGlobalState(testCode));

    // 6. 检测 timing 问题
    issues.push(...this.detectTimingIssues(testCode));

    // 自动修复
    const fixedCode = this.autoFix(testCode, issues);
    const autoFixedCount = issues.filter(i => i.autoFixable).length;

    this.logger.info('Flaky test analysis complete', {
      totalIssues: issues.length,
      autoFixed: autoFixedCount,
      critical: issues.filter(i => i.severity === 'critical').length,
    });

    return {
      issues,
      fixedCode,
      autoFixedCount,
    };
  }

  /**
   * 1. 检测时间依赖
   */
  private detectTimeDependency(code: string): FlakyIssue[] {
    const issues: FlakyIssue[] = [];

    // new Date()
    const newDateMatches = code.matchAll(/new Date\(\)/g);
    for (const match of newDateMatches) {
      issues.push({
        type: 'time-dependency',
        line: 0,
        code: match[0],
        description: 'Using new Date() creates time-dependent test',
        fix: 'Use jest.useFakeTimers() or vi.useFakeTimers() and mock the date',
        autoFixable: true,
        severity: 'high',
      });
    }

    // Date.now()
    const dateNowMatches = code.matchAll(/Date\.now\(\)/g);
    for (const match of dateNowMatches) {
      issues.push({
        type: 'time-dependency',
        line: 0,
        code: match[0],
        description: 'Using Date.now() creates time-dependent test',
        fix: 'Mock Date.now() with jest.spyOn(Date, "now") or vi.spyOn(Date, "now")',
        autoFixable: true,
        severity: 'high',
      });
    }

    // setTimeout/setInterval without proper cleanup
    const timeoutMatches = code.matchAll(/setTimeout\(/g);
    for (const match of timeoutMatches) {
      if (!code.includes('clearTimeout') && !code.includes('useFakeTimers')) {
        issues.push({
          type: 'timing-issue',
          line: 0,
          code: match[0],
          description: 'setTimeout without fake timers or cleanup',
          fix: 'Use jest.useFakeTimers() and jest.runAllTimers() or ensure clearTimeout is called',
          autoFixable: false,
          severity: 'medium',
        });
      }
    }

    return issues;
  }

  /**
   * 2. 检测随机数依赖
   */
  private detectRandomDependency(code: string): FlakyIssue[] {
    const issues: FlakyIssue[] = [];

    // Math.random()
    const randomMatches = code.matchAll(/Math\.random\(\)/g);
    for (const match of randomMatches) {
      issues.push({
        type: 'random-dependency',
        line: 0,
        code: match[0],
        description: 'Using Math.random() creates non-deterministic test',
        fix: 'Mock Math.random() with jest.spyOn(Math, "random").mockReturnValue(0.5) or use a seeded random generator',
        autoFixable: true,
        severity: 'critical',
      });
    }

    // UUID generation
    const uuidMatches = code.matchAll(/uuid\(\)|uuidv4\(\)/g);
    for (const match of uuidMatches) {
      if (!code.includes('mock')) {
        issues.push({
          type: 'random-dependency',
          line: 0,
          code: match[0],
          description: 'UUID generation creates non-deterministic test',
          fix: 'Mock UUID generator to return deterministic values',
          autoFixable: false,
          severity: 'high',
        });
      }
    }

    return issues;
  }

  /**
   * 3. 检测网络调用
   */
  private detectNetworkDependency(code: string): FlakyIssue[] {
    const issues: FlakyIssue[] = [];

    const hasMock = code.includes('vi.mock') || 
                    code.includes('jest.mock') || 
                    code.includes('nock') ||
                    code.includes('msw');

    // fetch()
    if (code.includes('fetch(') && !hasMock) {
      issues.push({
        type: 'network-dependency',
        line: 0,
        code: 'fetch()',
        description: 'Unmocked fetch() call can cause flaky tests',
        fix: 'Mock fetch() using vi.mock(), jest.mock(), or MSW (Mock Service Worker)',
        autoFixable: true,
        severity: 'critical',
      });
    }

    // axios
    if (code.includes('axios.') && !hasMock) {
      issues.push({
        type: 'network-dependency',
        line: 0,
        code: 'axios',
        description: 'Unmocked axios call can cause flaky tests',
        fix: 'Mock axios using jest.mock("axios") or axios-mock-adapter',
        autoFixable: true,
        severity: 'critical',
      });
    }

    // http.request
    if (code.includes('http.request') || code.includes('https.request')) {
      if (!hasMock) {
        issues.push({
          type: 'network-dependency',
          line: 0,
          code: 'http.request',
          description: 'Unmocked HTTP request can cause flaky tests',
          fix: 'Mock HTTP requests using nock or msw',
          autoFixable: false,
          severity: 'critical',
        });
      }
    }

    return issues;
  }

  /**
   * 4. 检测异步竞态条件
   */
  private detectRaceConditions(code: string): FlakyIssue[] {
    const issues: FlakyIssue[] = [];

    // Promise.all 没有正确 await
    const promiseAllMatches = code.matchAll(/Promise\.all\(/g);
    for (const match of promiseAllMatches) {
      // 检查前面是否有 await
      const index = code.indexOf(match[0]);
      const before = code.substring(Math.max(0, index - 20), index);
      if (!before.includes('await')) {
        issues.push({
          type: 'race-condition',
          line: 0,
          code: match[0],
          description: 'Promise.all without await can cause race conditions',
          fix: 'Add await before Promise.all()',
          autoFixable: true,
          severity: 'high',
        });
      }
    }

    // 多个异步操作没有正确同步
    const awaitCount = (code.match(/await /g) || []).length;
    const asyncCallCount = (code.match(/\.\w+\(/g) || []).length;
    
    if (asyncCallCount > awaitCount + 5) {
      issues.push({
        type: 'race-condition',
        line: 0,
        code: '',
        description: `Potential race condition: ${asyncCallCount} async calls but only ${awaitCount} awaits`,
        fix: 'Ensure all async operations are properly awaited',
        autoFixable: false,
        severity: 'medium',
      });
    }

    return issues;
  }

  /**
   * 5. 检测全局状态污染
   */
  private detectGlobalState(code: string): FlakyIssue[] {
    const issues: FlakyIssue[] = [];

    // window/global 修改
    if (code.includes('window.') && !code.includes('beforeEach') && !code.includes('afterEach')) {
      issues.push({
        type: 'global-state',
        line: 0,
        code: 'window modification',
        description: 'Modifying window object can leak state between tests',
        fix: 'Reset window state in afterEach() or use beforeEach() to set up clean state',
        autoFixable: false,
        severity: 'medium',
      });
    }

    // process.env 修改
    if (code.includes('process.env.') && !code.includes('afterEach')) {
      issues.push({
        type: 'global-state',
        line: 0,
        code: 'process.env modification',
        description: 'Modifying process.env can leak state between tests',
        fix: 'Save original env in beforeEach() and restore in afterEach()',
        autoFixable: false,
        severity: 'medium',
      });
    }

    return issues;
  }

  /**
   * 6. 检测 timing 问题
   */
  private detectTimingIssues(code: string): FlakyIssue[] {
    const issues: FlakyIssue[] = [];

    // 硬编码的 setTimeout
    const hardcodedTimeouts = code.matchAll(/setTimeout\([^,]+,\s*(\d+)\)/g);
    for (const match of hardcodedTimeouts) {
      const delay = parseInt(match[1]);
      if (delay > 100) {
        issues.push({
          type: 'timing-issue',
          line: 0,
          code: match[0],
          description: `Hardcoded setTimeout with ${delay}ms delay can cause slow and flaky tests`,
          fix: 'Use fake timers: vi.useFakeTimers() and vi.runAllTimers()',
          autoFixable: false,
          severity: 'medium',
        });
      }
    }

    return issues;
  }

  /**
   * 自动修复问题
   */
  private autoFix(code: string, issues: FlakyIssue[]): string {
    let fixed = code;

    const autoFixableIssues = issues.filter(i => i.autoFixable);

    for (const issue of autoFixableIssues) {
      switch (issue.type) {
        case 'time-dependency':
          if (issue.code === 'new Date()') {
            // 添加 fake timers setup
            if (!fixed.includes('useFakeTimers')) {
              fixed = this.addFakeTimersSetup(fixed);
            }
          } else if (issue.code === 'Date.now()') {
            // Mock Date.now()
            if (!fixed.includes('spyOn(Date, "now")')) {
              fixed = this.addDateNowMock(fixed);
            }
          }
          break;

        case 'random-dependency':
          if (issue.code === 'Math.random()') {
            // Mock Math.random()
            if (!fixed.includes('spyOn(Math, "random")')) {
              fixed = this.addMathRandomMock(fixed);
            }
          }
          break;

        case 'network-dependency':
          if (issue.code === 'fetch()') {
            // 添加 fetch mock
            if (!fixed.includes('vi.mock') && !fixed.includes('jest.mock')) {
              fixed = this.addFetchMock(fixed);
            }
          } else if (issue.code === 'axios') {
            // 添加 axios mock
            if (!fixed.includes('mock("axios")')) {
              fixed = this.addAxiosMock(fixed);
            }
          }
          break;

        case 'race-condition':
          if (issue.code === 'Promise.all(') {
            // 添加 await
            fixed = fixed.replace(/Promise\.all\(/g, 'await Promise.all(');
          }
          break;
      }
    }

    return fixed;
  }

  private addFakeTimersSetup(code: string): string {
    const setup = `
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
`;
    // 在第一个 describe 后插入
    return code.replace(/describe\([^,]+,\s*\(\)\s*=>\s*{/, match => match + setup);
  }

  private addDateNowMock(code: string): string {
    const mock = `
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1609459200000); // 2021-01-01
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
`;
    return code.replace(/describe\([^,]+,\s*\(\)\s*=>\s*{/, match => match + mock);
  }

  private addMathRandomMock(code: string): string {
    const mock = `
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
`;
    return code.replace(/describe\([^,]+,\s*\(\)\s*=>\s*{/, match => match + mock);
  }

  private addFetchMock(code: string): string {
    // 在顶部添加 fetch mock
    const mock = `
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200,
  } as Response)
);
`;
    return mock + '\n' + code;
  }

  private addAxiosMock(code: string): string {
    // 在顶部添加 axios mock
    const mock = `
vi.mock('axios');
`;
    return mock + '\n' + code;
  }
}

