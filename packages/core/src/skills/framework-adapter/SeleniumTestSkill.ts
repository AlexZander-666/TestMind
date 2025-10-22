/**
 * SeleniumTestSkill - Selenium WebDriver 测试技能
 * 
 * 参考 gpt.md，Selenium 是主流的 Web 自动化框架
 * 
 * 特点：
 * - 支持多语言（Java, Python, JavaScript, C#）
 * - 支持多浏览器（Chrome, Firefox, Safari, Edge）
 * - 成熟稳定，企业级应用广泛
 * - 灵活的定位策略
 * 
 * 本实现专注于 JavaScript/TypeScript
 */

import type { LLMService } from '../../llm/LLMService';
import {
  BaseTestFrameworkAdapter,
  type FrameworkTestContext,
  type TestCode,
  type ConfigOptions,
  type TestResult,
  type FrameworkCapabilities,
} from './TestFrameworkAdapter';

/**
 * Selenium 测试上下文
 */
export interface SeleniumTestContext extends FrameworkTestContext {
  /** 目标 URL */
  url?: string;
  
  /** 浏览器 */
  browser?: 'chrome' | 'firefox' | 'safari' | 'edge';
  
  /** 操作序列 */
  actions?: SeleniumAction[];
  
  /** 是否使用隐式等待 */
  useImplicitWait?: boolean;
  
  /** 超时设置（毫秒） */
  timeout?: number;
}

export interface SeleniumAction {
  type: 'navigate' | 'click' | 'sendKeys' | 'select' | 'wait' | 'assert';
  selector?: string;
  selectorType?: 'id' | 'css' | 'xpath' | 'name' | 'className';
  value?: string;
  expectedValue?: string;
}

/**
 * Selenium WebDriver 测试适配器
 */
export class SeleniumTestSkill extends BaseTestFrameworkAdapter {
  readonly name = 'selenium-webdriver';
  readonly version = '4.x';
  readonly description = 'Selenium WebDriver E2E testing framework';
  
  readonly capabilities: FrameworkCapabilities = {
    supportsE2E: true,
    supportsUnit: false,
    supportsAPI: false,
    supportsComponent: false,
    supportsVisualRegression: false,
    supportsMobile: false,
    browsers: ['chrome', 'firefox', 'safari', 'edge'],
    platforms: ['web'],
  };
  
  /**
   * 生成 Selenium 测试代码
   */
  async generateTest(context: FrameworkTestContext): Promise<TestCode> {
    const seleniumContext = context as SeleniumTestContext;
    
    // 如果有 LLM，使用 AI 生成
    if (this.llmService) {
      return this.generateTestWithAI(seleniumContext);
    }
    
    // 否则使用模板生成
    return this.generateTestFromTemplate(seleniumContext);
  }
  
  /**
   * 使用 AI 生成测试
   */
  private async generateTestWithAI(context: SeleniumTestContext): Promise<TestCode> {
    const prompt = this.buildPrompt(context);
    
    const response = await this.llmService!.generate({
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt,
      temperature: 0.3,
      maxTokens: 1500,
    });
    
    const code = this.extractCode(response.content);
    
    return {
      code,
      filePath: this.getTestFilePath(context.targetFile),
      imports: this.extractImports(code),
    };
  }
  
  /**
   * 构建 AI Prompt
   */
  private buildPrompt(context: SeleniumTestContext): string {
    return `Generate a Selenium WebDriver test in TypeScript.

Test Requirements:
- Test name: ${context.testName}
- Target URL: ${context.url || 'http://localhost:3000'}
- Browser: ${context.browser || 'chrome'}
- Test type: ${context.testType}

${context.description ? `Description: ${context.description}` : ''}

Generate a complete, runnable Selenium test using:
- selenium-webdriver package
- Mocha or Jest as test runner
- Proper setup and teardown
- Explicit waits (not implicit)
- Page Object pattern (if complex)
- Clear assertions

Code:`;
  }
  
  /**
   * 从模板生成测试
   */
  private generateTestFromTemplate(context: SeleniumTestContext): TestCode {
    const browser = context.browser || 'chrome';
    const url = context.url || 'http://localhost:3000';
    const testName = context.testName;
    
    const code = `import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import ${browser} from 'selenium-webdriver/${browser}';
import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';

describe('${testName}', () => {
  let driver: WebDriver;
  
  before(async function() {
    this.timeout(30000);
    
    // 初始化浏览器
    driver = await new Builder()
      .forBrowser('${browser}')
      ${browser === 'chrome' ? `.setChromeOptions(new chrome.Options().headless())` : ''}
      .build();
  });
  
  after(async () => {
    await driver.quit();
  });
  
  it('should ${context.description || 'perform the test'}', async function() {
    this.timeout(10000);
    
    // 导航到页面
    await driver.get('${url}');
    
    // 等待页面加载
    await driver.wait(until.titleIs('Expected Title'), 5000);
    
    // 查找元素并交互
    const element = await driver.findElement(By.css('selector'));
    await element.click();
    
    // 断言
    const text = await element.getText();
    expect(text).to.equal('Expected Text');
  });
});
`;
    
    return {
      code,
      filePath: this.getTestFilePath(context.targetFile),
      imports: [
        'selenium-webdriver',
        `selenium-webdriver/${browser}`,
        'mocha',
        'chai',
      ],
    };
  }
  
  /**
   * 生成配置文件
   */
  async generateConfig(options: ConfigOptions): Promise<string> {
    return `// Selenium WebDriver 配置
// 用于测试运行器（Mocha）

module.exports = {
  // Mocha 配置
  timeout: 30000,
  slow: 10000,
  
  // 测试文件
  spec: '${options.testDir || 'test'}/**/*.test.ts',
  
  // 浏览器选项
  browsers: ${JSON.stringify(options.browsers || ['chrome', 'firefox'])},
  
  // Selenium Grid（可选）
  seleniumHub: process.env.SELENIUM_HUB_URL,
  
  // 截图目录
  screenshotPath: './test-results/screenshots',
};
`;
  }
  
  /**
   * 运行测试
   */
  async runTests(testFiles: string[]): Promise<TestResult[]> {
    const { execSync } = await import('child_process');
    const results: TestResult[] = [];
    
    for (const testFile of testFiles) {
      try {
        const startTime = Date.now();
        execSync(`npx mocha ${testFile}`, { stdio: 'inherit' });
        const duration = Date.now() - startTime;
        
        results.push({
          name: testFile,
          passed: true,
          duration,
        });
      } catch (error) {
        results.push({
          name: testFile,
          passed: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return results;
  }
  
  /**
   * 推荐的依赖
   */
  getRecommendedDependencies(): string[] {
    return [
      'selenium-webdriver',
      '@types/selenium-webdriver',
      'mocha',
      '@types/mocha',
      'chai',
      '@types/chai',
      'chromedriver',
      'geckodriver',
    ];
  }
  
  /**
   * 安装命令
   */
  getInstallCommand(): string {
    return 'pnpm add -D selenium-webdriver @types/selenium-webdriver mocha @types/mocha chai @types/chai chromedriver';
  }
  
  /**
   * 运行命令
   */
  getRunCommand(testFile: string): string {
    return `npx mocha ${testFile}`;
  }
  
  // ============================================================================
  // 辅助方法
  // ============================================================================
  
  private getTestFilePath(targetFile: string): string {
    const baseName = targetFile.replace(/\.(ts|js)$/, '');
    return `${baseName}.selenium.test.ts`;
  }
  
  private extractCode(content: string): string {
    const match = content.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)\n```/);
    return match ? match[1].trim() : content.trim();
  }
  
  private extractImports(code: string): string[] {
    const imports: string[] = [];
    const importRegex = /^import .* from ['"]([^'"]+)['"]/gm;
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }
}

/**
 * 工厂函数
 */
export function createSeleniumTestSkill(llmService?: LLMService): SeleniumTestSkill {
  return new SeleniumTestSkill(llmService);
}

