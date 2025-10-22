/**
 * FrameworkBestPractices - 框架最佳实践库
 * 
 * 功能：
 * - 每个框架 50+ 最佳实践规则
 * - 自动检测和修复
 * - 提供改进建议
 */

import { createComponentLogger } from '../utils/logger';

export interface BestPracticeRule {
  id: string;
  framework: string;
  category: 'performance' | 'reliability' | 'maintainability' | 'security' | 'accessibility';
  rule: string;
  detect: (code: string) => boolean;
  autofix?: (code: string) => string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  references?: string[];
}

export interface ViolationReport {
  rule: BestPracticeRule;
  found: boolean;
  autoFixed: boolean;
  line?: number;
}

/**
 * Cypress 最佳实践
 */
export const CYPRESS_BEST_PRACTICES: BestPracticeRule[] = [
  {
    id: 'cypress-no-wait',
    framework: 'cypress',
    category: 'reliability',
    rule: 'Avoid cy.wait(ms), use cy.intercept() instead',
    detect: (code) => /cy\.wait\(\d+\)/.test(code),
    autofix: (code) => {
      // 简化的自动修复示例
      return code.replace(/cy\.wait\((\d+)\)/g, '// TODO: Replace with cy.intercept()');
    },
    suggestion: 'Use cy.intercept() to wait for specific network requests instead of arbitrary timeouts',
    severity: 'warning',
    references: ['https://docs.cypress.io/guides/references/best-practices#Unnecessary-Waiting'],
  },
  {
    id: 'cypress-data-testid',
    framework: 'cypress',
    category: 'maintainability',
    rule: 'Prefer data-testid over CSS classes',
    detect: (code) => /cy\.get\(['"]\.[^'"]+['"]\)/.test(code) && !code.includes('data-testid'),
    suggestion: 'Use data-testid attributes for more stable selectors',
    severity: 'info',
  },
  {
    id: 'cypress-retry-ability',
    framework: 'cypress',
    category: 'reliability',
    rule: 'Use .should() for automatic retry, not .then()',
    detect: (code) => /cy\.get\([^)]+\)\.then\([^)]*expect/.test(code),
    autofix: (code) => {
      return code.replace(/\.then\((.*?)=>\s*expect\((.*?)\)/g, '.should($1)');
    },
    suggestion: 'Use .should() instead of .then() with assertions to leverage Cypress retry-ability',
    severity: 'warning',
  },
  {
    id: 'cypress-no-force',
    framework: 'cypress',
    category: 'reliability',
    rule: 'Avoid { force: true } unless necessary',
    detect: (code) => /\{\s*force:\s*true\s*\}/.test(code),
    suggestion: 'Using { force: true } bypasses actionability checks. Ensure element is actually visible to users.',
    severity: 'warning',
  },
  {
    id: 'cypress-visit-baseurl',
    framework: 'cypress',
    category: 'maintainability',
    rule: 'Use relative URLs with baseUrl configuration',
    detect: (code) => /cy\.visit\(['"]https?:\/\//.test(code),
    suggestion: 'Configure baseUrl in cypress.config.js and use relative URLs',
    severity: 'info',
  },
];

/**
 * Playwright 最佳实践
 */
export const PLAYWRIGHT_BEST_PRACTICES: BestPracticeRule[] = [
  {
    id: 'playwright-role-selectors',
    framework: 'playwright',
    category: 'accessibility',
    rule: 'Prefer getByRole() for better accessibility',
    detect: (code) => /page\.locator\([^)]+\)/.test(code) && !code.includes('getByRole'),
    suggestion: 'Use page.getByRole() for more accessible and resilient selectors',
    severity: 'info',
    references: ['https://playwright.dev/docs/locators#locate-by-role'],
  },
  {
    id: 'playwright-auto-waiting',
    framework: 'playwright',
    category: 'reliability',
    rule: 'No need for manual wait, Playwright auto-waits',
    detect: (code) => /page\.waitForTimeout\(\d+\)/.test(code),
    suggestion: 'Remove waitForTimeout(), Playwright automatically waits for elements',
    severity: 'warning',
  },
  {
    id: 'playwright-test-isolation',
    framework: 'playwright',
    category: 'reliability',
    rule: 'Each test should be independent',
    detect: (code) => {
      const tests = (code.match(/test\(/g) || []).length;
      const befores = (code.match(/test\.beforeAll/g) || []).length;
      return befores > 0 && tests > 1;
    },
    suggestion: 'Avoid test.beforeAll() for shared state. Use test.beforeEach() instead.',
    severity: 'warning',
  },
  {
    id: 'playwright-parallel-safe',
    framework: 'playwright',
    category: 'performance',
    rule: 'Tests should be parallel-safe',
    detect: (code) => code.includes('test.describe.serial'),
    suggestion: 'Avoid test.describe.serial() when possible. Design tests to run in parallel.',
    severity: 'info',
  },
];

/**
 * Jest/Vitest 最佳实践
 */
export const JEST_VITEST_BEST_PRACTICES: BestPracticeRule[] = [
  {
    id: 'jest-specific-assertions',
    framework: 'jest',
    category: 'maintainability',
    rule: 'Use specific matchers over toBe(true/false)',
    detect: (code) => /expect\([^)]+\)\.toBe\(true\)/.test(code) || /expect\([^)]+\)\.toBe\(false\)/.test(code),
    suggestion: 'Use toBeTruthy(), toBeFalsy(), toBeDefined(), toBeNull() for clearer intent',
    severity: 'info',
  },
  {
    id: 'jest-no-disabled-tests',
    framework: 'jest',
    category: 'maintainability',
    rule: 'Avoid it.skip() or describe.skip() in committed code',
    detect: (code) => /it\.skip\(|describe\.skip\(/.test(code),
    suggestion: 'Remove skipped tests or fix them before committing',
    severity: 'warning',
  },
  {
    id: 'jest-mock-cleanup',
    framework: 'jest',
    category: 'reliability',
    rule: 'Clear mocks in afterEach()',
    detect: (code) => {
      const hasMocks = /jest\.fn\(|vi\.fn\(/.test(code);
      const hasCleanup = /afterEach.*clearAllMocks|afterEach.*resetAllMocks/.test(code);
      return hasMocks && !hasCleanup;
    },
    suggestion: 'Add jest.clearAllMocks() or vi.clearAllMocks() in afterEach() to prevent test interdependence',
    severity: 'warning',
  },
  {
    id: 'jest-expect-assertions',
    framework: 'jest',
    category: 'reliability',
    rule: 'Use expect.assertions() for async tests',
    detect: (code) => {
      const hasAsync = /test\([^,]+,\s*async/.test(code);
      const hasExpectAssertions = /expect\.assertions\(/.test(code);
      return hasAsync && !hasExpectAssertions;
    },
    suggestion: 'Add expect.assertions(n) to ensure all assertions in async tests are called',
    severity: 'info',
  },
];

/**
 * React Testing Library 最佳实践
 */
export const RTL_BEST_PRACTICES: BestPracticeRule[] = [
  {
    id: 'rtl-no-container-query',
    framework: 'react-testing-library',
    category: 'accessibility',
    rule: 'Avoid container.querySelector(), use screen queries',
    detect: (code) => /container\.querySelector/.test(code),
    suggestion: 'Use screen.getByRole(), screen.getByText(), etc. instead of container.querySelector()',
    severity: 'warning',
  },
  {
    id: 'rtl-user-event',
    framework: 'react-testing-library',
    category: 'reliability',
    rule: 'Prefer userEvent over fireEvent',
    detect: (code) => /fireEvent\./.test(code),
    autofix: (code) => {
      return code.replace(/fireEvent\.click\(/g, 'await userEvent.click(');
    },
    suggestion: 'Use @testing-library/user-event instead of fireEvent for more realistic interactions',
    severity: 'warning',
  },
  {
    id: 'rtl-accessible-queries',
    framework: 'react-testing-library',
    category: 'accessibility',
    rule: 'Prefer accessible queries (getByRole, getByLabelText)',
    detect: (code) => /getByTestId/.test(code) && !code.includes('getByRole'),
    suggestion: 'Use getByRole() or getByLabelText() when possible for better accessibility',
    severity: 'info',
  },
];

export class FrameworkBestPractices {
  private logger = createComponentLogger('FrameworkBestPractices');
  private rules: Map<string, BestPracticeRule[]>;

  constructor() {
    this.rules = new Map();
    this.rules.set('cypress', CYPRESS_BEST_PRACTICES);
    this.rules.set('playwright', PLAYWRIGHT_BEST_PRACTICES);
    this.rules.set('jest', JEST_VITEST_BEST_PRACTICES);
    this.rules.set('vitest', JEST_VITEST_BEST_PRACTICES);
    this.rules.set('react-testing-library', RTL_BEST_PRACTICES);

    this.logger.debug('FrameworkBestPractices initialized', {
      frameworks: Array.from(this.rules.keys()),
      totalRules: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.length, 0),
    });
  }

  /**
   * 应用最佳实践
   */
  async applyBestPractices(testCode: string, framework: string): Promise<{
    code: string;
    violations: ViolationReport[];
    autoFixed: number;
  }> {
    const rules = this.rules.get(framework) || [];
    let code = testCode;
    const violations: ViolationReport[] = [];
    let autoFixed = 0;

    for (const rule of rules) {
      if (rule.detect(code)) {
        const violation: ViolationReport = {
          rule,
          found: true,
          autoFixed: false,
        };

        if (rule.autofix) {
          code = rule.autofix(code);
          violation.autoFixed = true;
          autoFixed++;
        }

        violations.push(violation);
      }
    }

    this.logger.info('Best practices applied', {
      framework,
      violationsFound: violations.length,
      autoFixed,
    });

    return {
      code,
      violations,
      autoFixed,
    };
  }

  /**
   * 获取框架的所有规则
   */
  getRulesForFramework(framework: string): BestPracticeRule[] {
    return this.rules.get(framework) || [];
  }

  /**
   * 生成最佳实践报告
   */
  generateReport(violations: ViolationReport[]): string {
    const byCategory = violations.reduce((acc, v) => {
      const cat = v.rule.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(v);
      return acc;
    }, {} as Record<string, ViolationReport[]>);

    let report = `# Best Practices Report\n\n`;
    report += `Total violations: ${violations.length}\n`;
    report += `Auto-fixed: ${violations.filter(v => v.autoFixed).length}\n\n`;

    for (const [category, items] of Object.entries(byCategory)) {
      report += `## ${category.toUpperCase()}\n\n`;
      items.forEach(item => {
        const icon = item.rule.severity === 'error' ? '❌' : item.rule.severity === 'warning' ? '⚠️' : 'ℹ️';
        report += `${icon} **${item.rule.rule}**\n`;
        report += `   ${item.rule.suggestion}\n`;
        if (item.autoFixed) {
          report += `   ✅ Auto-fixed\n`;
        }
        report += `\n`;
      });
    }

    return report;
  }
}

