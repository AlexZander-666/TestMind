/**
 * TestMigrationTool - 跨框架测试迁移工具
 * 
 * 功能：
 * - Jest ↔ Vitest 迁移
 * - Cypress ↔ Playwright 迁移
 * - 自动转换 API 调用
 * - 调整 import 语句
 * - 保留测试逻辑
 */

import { createComponentLogger } from '../utils/logger';

export type TestFramework = 'jest' | 'vitest' | 'cypress' | 'playwright' | 'mocha';

export interface MigrationResult {
  original: string;
  migrated: string;
  changes: Array<{
    type: 'import' | 'api' | 'config' | 'assertion';
    from: string;
    to: string;
    line: number;
  }>;
  warnings: string[];
}

export class TestMigrationTool {
  private logger = createComponentLogger('TestMigrationTool');

  /**
   * 迁移测试代码
   */
  async migrate(
    testCode: string,
    from: TestFramework,
    to: TestFramework
  ): Promise<MigrationResult> {
    this.logger.info('Migrating test', { from, to });

    const changes: MigrationResult['changes'] = [];
    const warnings: string[] = [];
    let migrated = testCode;

    // 1. 转换 import 语句
    migrated = this.migrateImports(migrated, from, to, changes);

    // 2. 转换 API 调用
    migrated = this.transformAPIs(migrated, from, to, changes);

    // 3. 转换配置
    migrated = this.migrateConfig(migrated, from, to, changes);

    // 4. 转换断言
    migrated = this.migrateAssertions(migrated, from, to, changes);

    // 5. 添加警告
    this.detectIncompatibilities(testCode, from, to, warnings);

    this.logger.info('Migration complete', {
      changesCount: changes.length,
      warningsCount: warnings.length,
    });

    return {
      original: testCode,
      migrated,
      changes,
      warnings,
    };
  }

  /**
   * 1. 迁移 import 语句
   */
  private migrateImports(
    code: string,
    from: TestFramework,
    to: TestFramework,
    changes: MigrationResult['changes']
  ): string {
    let migrated = code;

    // Jest → Vitest
    if (from === 'jest' && to === 'vitest') {
      migrated = migrated.replace(
        /from ['"]@jest\/globals['"]/g,
        `from 'vitest'`
      );
      changes.push({
        type: 'import',
        from: '@jest/globals',
        to: 'vitest',
        line: 0,
      });
    }

    // Vitest → Jest
    if (from === 'vitest' && to === 'jest') {
      migrated = migrated.replace(
        /from ['"]vitest['"]/g,
        `from '@jest/globals'`
      );
      changes.push({
        type: 'import',
        from: 'vitest',
        to: '@jest/globals',
        line: 0,
      });
    }

    // Cypress → Playwright
    if (from === 'cypress' && to === 'playwright') {
      migrated = migrated.replace(
        /\/\/\/ <reference types=['"]cypress['"] \/>/g,
        `import { test, expect } from '@playwright/test';`
      );
      changes.push({
        type: 'import',
        from: 'cypress reference',
        to: '@playwright/test',
        line: 0,
      });
    }

    // Playwright → Cypress
    if (from === 'playwright' && to === 'cypress') {
      migrated = migrated.replace(
        /import.*from ['"]@playwright\/test['"]/g,
        `/// <reference types="cypress" />`
      );
      changes.push({
        type: 'import',
        from: '@playwright/test',
        to: 'cypress',
        line: 0,
      });
    }

    return migrated;
  }

  /**
   * 2. 转换 API 调用
   */
  private transformAPIs(
    code: string,
    from: TestFramework,
    to: TestFramework,
    changes: MigrationResult['changes']
  ): string {
    let migrated = code;

    // Jest → Vitest
    if (from === 'jest' && to === 'vitest') {
      const replacements: Array<[RegExp, string, string, string]> = [
        [/jest\.fn\(\)/g, 'vi.fn()', 'jest.fn()', 'vi.fn()'],
        [/jest\.mock\(/g, 'vi.mock(', 'jest.mock', 'vi.mock'],
        [/jest\.spyOn\(/g, 'vi.spyOn(', 'jest.spyOn', 'vi.spyOn'],
        [/jest\.clearAllMocks\(\)/g, 'vi.clearAllMocks()', 'jest.clearAllMocks()', 'vi.clearAllMocks()'],
        [/jest\.resetAllMocks\(\)/g, 'vi.resetAllMocks()', 'jest.resetAllMocks()', 'vi.resetAllMocks()'],
        [/jest\.restoreAllMocks\(\)/g, 'vi.restoreAllMocks()', 'jest.restoreAllMocks()', 'vi.restoreAllMocks()'],
        [/jest\.useFakeTimers\(\)/g, 'vi.useFakeTimers()', 'jest.useFakeTimers()', 'vi.useFakeTimers()'],
        [/jest\.useRealTimers\(\)/g, 'vi.useRealTimers()', 'jest.useRealTimers()', 'vi.useRealTimers()'],
        [/jest\.advanceTimersByTime\(/g, 'vi.advanceTimersByTime(', 'jest.advanceTimersByTime', 'vi.advanceTimersByTime'],
        [/jest\.runAllTimers\(\)/g, 'vi.runAllTimers()', 'jest.runAllTimers()', 'vi.runAllTimers()'],
      ];

      for (const [pattern, replacement, fromStr, toStr] of replacements) {
        if (pattern.test(migrated)) {
          migrated = migrated.replace(pattern, replacement);
          changes.push({
            type: 'api',
            from: fromStr,
            to: toStr,
            line: 0,
          });
        }
      }
    }

    // Vitest → Jest (reverse)
    if (from === 'vitest' && to === 'jest') {
      const replacements: Array<[RegExp, string, string, string]> = [
        [/vi\.fn\(\)/g, 'jest.fn()', 'vi.fn()', 'jest.fn()'],
        [/vi\.mock\(/g, 'jest.mock(', 'vi.mock', 'jest.mock'],
        [/vi\.spyOn\(/g, 'jest.spyOn(', 'vi.spyOn', 'jest.spyOn'],
        [/vi\.clearAllMocks\(\)/g, 'jest.clearAllMocks()', 'vi.clearAllMocks()', 'jest.clearAllMocks()'],
        [/vi\.resetAllMocks\(\)/g, 'jest.resetAllMocks()', 'vi.resetAllMocks()', 'jest.resetAllMocks()'],
        [/vi\.restoreAllMocks\(\)/g, 'jest.restoreAllMocks()', 'vi.restoreAllMocks()', 'jest.restoreAllMocks()'],
        [/vi\.useFakeTimers\(\)/g, 'jest.useFakeTimers()', 'vi.useFakeTimers()', 'jest.useFakeTimers()'],
        [/vi\.useRealTimers\(\)/g, 'jest.useRealTimers()', 'vi.useRealTimers()', 'jest.useRealTimers()'],
      ];

      for (const [pattern, replacement, fromStr, toStr] of replacements) {
        if (pattern.test(migrated)) {
          migrated = migrated.replace(pattern, replacement);
          changes.push({
            type: 'api',
            from: fromStr,
            to: toStr,
            line: 0,
          });
        }
      }
    }

    // Cypress → Playwright
    if (from === 'cypress' && to === 'playwright') {
      // cy.get(...).click() → page.click(...)
      migrated = migrated.replace(
        /cy\.get\(['"]\[data-testid=([^\]]+)\]['"]\)\.click\(\)/g,
        `await page.click('[data-testid=$1]')`
      );

      // cy.visit(...) → page.goto(...)
      migrated = migrated.replace(
        /cy\.visit\(([^)]+)\)/g,
        `await page.goto($1)`
      );

      // cy.intercept(...) → page.route(...)
      migrated = migrated.replace(
        /cy\.intercept\(([^,]+),\s*([^)]+)\)/g,
        `await page.route($1, $2)`
      );

      changes.push({
        type: 'api',
        from: 'Cypress API',
        to: 'Playwright API',
        line: 0,
      });
    }

    // Playwright → Cypress (reverse)
    if (from === 'playwright' && to === 'cypress') {
      // page.click(...) → cy.get(...).click()
      migrated = migrated.replace(
        /await page\.click\(['"]\[data-testid=([^\]]+)\]['"]\)/g,
        `cy.get('[data-testid=$1]').click()`
      );

      // page.goto(...) → cy.visit(...)
      migrated = migrated.replace(
        /await page\.goto\(([^)]+)\)/g,
        `cy.visit($1)`
      );

      // page.route(...) → cy.intercept(...)
      migrated = migrated.replace(
        /await page\.route\(([^,]+),\s*([^)]+)\)/g,
        `cy.intercept($1, $2)`
      );

      changes.push({
        type: 'api',
        from: 'Playwright API',
        to: 'Cypress API',
        line: 0,
      });
    }

    return migrated;
  }

  /**
   * 3. 迁移配置
   */
  private migrateConfig(
    code: string,
    from: TestFramework,
    to: TestFramework,
    changes: MigrationResult['changes']
  ): string {
    // 配置文件迁移通常是单独的，这里主要处理测试文件内的配置
    return code;
  }

  /**
   * 4. 迁移断言
   */
  private migrateAssertions(
    code: string,
    from: TestFramework,
    to: TestFramework,
    changes: MigrationResult['changes']
  ): string {
    let migrated = code;

    // Cypress → Playwright 断言
    if (from === 'cypress' && to === 'playwright') {
      // cy.get(...).should('be.visible') → expect(page.locator(...)).toBeVisible()
      migrated = migrated.replace(
        /cy\.get\(([^)]+)\)\.should\(['"]be\.visible['"]\)/g,
        `await expect(page.locator($1)).toBeVisible()`
      );

      // cy.get(...).should('have.text', ...) → expect(page.locator(...)).toHaveText(...)
      migrated = migrated.replace(
        /cy\.get\(([^)]+)\)\.should\(['"]have\.text['"],\s*([^)]+)\)/g,
        `await expect(page.locator($1)).toHaveText($2)`
      );
    }

    return migrated;
  }

  /**
   * 5. 检测不兼容性
   */
  private detectIncompatibilities(
    code: string,
    from: TestFramework,
    to: TestFramework,
    warnings: string[]
  ): void {
    // Cypress 特有功能在 Playwright 中的警告
    if (from === 'cypress' && to === 'playwright') {
      if (code.includes('cy.screenshot')) {
        warnings.push('cy.screenshot() requires manual conversion to page.screenshot()');
      }
      if (code.includes('cy.task')) {
        warnings.push('cy.task() has no direct equivalent in Playwright');
      }
      if (code.includes('cy.fixture')) {
        warnings.push('cy.fixture() should be replaced with standard file reading in Playwright');
      }
    }

    // Jest 特有功能在 Vitest 中的警告
    if (from === 'jest' && to === 'vitest') {
      if (code.includes('jest.requireActual')) {
        warnings.push('jest.requireActual() should be replaced with vi.importActual() in Vitest');
      }
      if (code.includes('jest.doMock')) {
        warnings.push('jest.doMock() is not supported in Vitest');
      }
    }
  }

  /**
   * 生成迁移报告
   */
  generateReport(result: MigrationResult): string {
    const report = `
# Test Migration Report

## Summary
- Total changes: ${result.changes.length}
- Warnings: ${result.warnings.length}

## Changes

${result.changes.map((change, i) => `${i + 1}. [${change.type}] ${change.from} → ${change.to}`).join('\n')}

## Warnings

${result.warnings.length > 0 ? result.warnings.map((w, i) => `${i + 1}. ⚠️  ${w}`).join('\n') : 'No warnings'}

## Next Steps

1. Review the migrated code carefully
2. Run the tests to ensure they pass
3. Update any framework-specific configurations
4. Address any warnings listed above
`;

    return report;
  }
}

