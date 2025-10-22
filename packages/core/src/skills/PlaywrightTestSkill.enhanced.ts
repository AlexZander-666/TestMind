/**
 * Enhanced PlaywrightTestSkill - 增强的 Playwright 测试技能
 * 
 * 新增功能：
 * 1. 多浏览器并行测试
 * 2. 自动重试机制
 * 3. 视频录制配置
 * 4. Network HAR 记录
 * 5. 追踪文件生成
 */

import { Skill } from './Skill';
import type { LLMService } from '../llm/LLMService';

/**
 * Playwright 测试上下文
 */
export interface PlaywrightTestContext {
  /** 测试名称 */
  testName: string;
  
  /** 目标 URL */
  url: string;
  
  /** 操作序列 */
  actions: PlaywrightAction[];
  
  /** 是否多浏览器测试 */
  multipleBrowser?: boolean;
  
  /** 浏览器列表 */
  browsers?: ('chromium' | 'firefox' | 'webkit')[];
  
  /** 是否录制视频 */
  recordVideo?: boolean;
  
  /** 是否记录网络请求 */
  recordNetwork?: boolean;
  
  /** 是否启用追踪 */
  enableTracing?: boolean;
}

export interface PlaywrightAction {
  type: 'navigate' | 'click' | 'fill' | 'select' | 'check' | 'assert' | 'wait';
  selector?: string;
  value?: string;
  role?: string; // ARIA role
  label?: string; // ARIA label
  assertion?: {
    type: 'visible' | 'text' | 'value' | 'enabled' | 'checked';
    expected?: any;
  };
}

/**
 * Playwright 最佳实践
 */
const PLAYWRIGHT_BEST_PRACTICES = {
  // 推荐的定位器
  RECOMMENDED_LOCATORS: [
    'page.getByRole()',
    'page.getByLabel()',
    'page.getByTestId()',
    'page.getByText()',
    'page.getByPlaceholder()',
  ],
  
  // 避免的定位器
  AVOID_LOCATORS: [
    'page.locator(".class")',     // CSS 类名
    'page.locator("div > div")',  // 深层选择器
    'page.locator("xpath=//div")', // XPath (除非必要)
  ],
  
  // 自动等待
  AUTO_WAITS: [
    'Playwright auto-waits for elements to be visible',
    'Playwright auto-waits for elements to be enabled',
    'No need for explicit sleep/wait in most cases',
  ],
};

/**
 * 增强的 Playwright 测试技能
 */
export class EnhancedPlaywrightTestSkill {
  readonly name = 'enhanced-playwright-e2e';
  readonly version = '2.0.0';
  readonly description = 'Generate enhanced Playwright E2E tests with best practices';
  
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * 生成测试代码
   */
  async execute(context: PlaywrightTestContext): Promise<{ code: string }> {
    console.log(`[PlaywrightTestSkill] Generating enhanced test: ${context.testName}`);

    // 1. 构建增强的 Prompt
    const prompt = this.buildEnhancedPrompt(context);

    // 2. 调用 LLM 生成基础代码
    const response = await this.llmService.generate({
      provider: 'openai',
      model: 'gpt-4',
      prompt,
      temperature: 0.2,
      maxTokens: 1500,
    });

    let code = this.extractCode(response.content);

    // 3. 应用增强逻辑
    code = this.enhancePlaywrightCode(code, context);

    // 4. 验证和格式化
    code = this.validateAndFormat(code, context);

    return { code };
  }

  /**
   * 构建增强的 Prompt
   */
  private buildEnhancedPrompt(context: PlaywrightTestContext): string {
    let prompt = `Generate a Playwright E2E test following these best practices:\n\n`;
    
    prompt += `**Test Name**: ${context.testName}\n`;
    prompt += `**URL**: ${context.url}\n\n`;

    // Playwright 最佳实践
    prompt += `**Best Practices**:\n`;
    prompt += `1. Use semantic locators: page.getByRole(), page.getByLabel(), page.getByTestId()\n`;
    prompt += `2. DO NOT use page.locator() with CSS classes unless necessary\n`;
    prompt += `3. Rely on auto-waiting (no explicit waits needed)\n`;
    prompt += `4. Use strict locators (must match exactly one element)\n`;
    prompt += `5. Add accessibility tests where applicable\n\n`;

    // 操作序列
    prompt += `**Actions**:\n`;
    for (const action of context.actions) {
      prompt += `- ${action.type}`;
      if (action.role) prompt += ` role="${action.role}"`;
      if (action.label) prompt += ` label="${action.label}"`;
      if (action.selector) prompt += ` selector="${action.selector}"`;
      if (action.value) prompt += ` value="${action.value}"`;
      prompt += `\n`;
    }
    prompt += `\n`;

    // 多浏览器
    if (context.multipleBrowser && context.browsers) {
      prompt += `**Browsers**: Test on ${context.browsers.join(', ')}\n\n`;
    }

    // Few-shot 示例
    prompt += `**Example**:\n`;
    prompt += `\`\`\`typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    
    // Use semantic locators
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    
    // Auto-wait for navigation
    await expect(page).toHaveURL(/dashboard/);
    
    // Assert welcome message
    await expect(page.getByTestId('welcome-message'))
      .toBeVisible();
    await expect(page.getByText('Welcome, Test User'))
      .toBeVisible();
  });
});
\`\`\`\n\n`;

    prompt += `Generate the test code:\n`;

    return prompt;
  }

  /**
   * 增强 Playwright 代码
   */
  private enhancePlaywrightCode(code: string, context: PlaywrightTestContext): string {
    let enhanced = code;

    // 1. 添加浏览器配置
    if (context.multipleBrowser && context.browsers) {
      enhanced = this.addBrowserConfiguration(enhanced, context.browsers);
    }

    // 2. 添加视频录制
    if (context.recordVideo) {
      enhanced = this.addVideoRecording(enhanced);
    }

    // 3. 添加网络监控
    if (context.recordNetwork) {
      enhanced = this.addNetworkMonitoring(enhanced);
    }

    // 4. 添加追踪
    if (context.enableTracing) {
      enhanced = this.addTracing(enhanced);
    }

    // 5. 优化定位器
    enhanced = this.optimizeLocators(enhanced);

    return enhanced;
  }

  /**
   * 添加浏览器配置
   */
  private addBrowserConfiguration(code: string, browsers: string[]): string {
    const browserTests = browsers.map(browser => {
      return `
test.describe('${browser}', () => {
  test.use({ browserName: '${browser}' });
  
  ${code.split('\n').filter(line => line.includes('it(')).join('\n  ')}
});`;
    }).join('\n\n');

    return browserTests;
  }

  /**
   * 添加视频录制配置
   */
  private addVideoRecording(code: string): string {
    return code.replace(
      /test\((['"][^'"]+['"])/,
      `test.use({ video: 'on' });\n\n  test($1`
    );
  }

  /**
   * 添加网络监控
   */
  private addNetworkMonitoring(code: string): string {
    const networkSetup = `
  // Network monitoring
  await page.routeFrom FromHAR('./hars/network.har', {
    url: '**/api/**',
    update: process.env.UPDATE_HAR === 'true'
  });`;

    return code.replace(
      /(async.*\{)\s*\n/,
      `$1\n${networkSetup}\n\n`
    );
  }

  /**
   * 添加追踪
   */
  private addTracing(code: string): string {
    const tracingSetup = `
  // Start tracing
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });`;

    const tracingTeardown = `
  // Stop tracing
  await page.context().tracing.stop({
    path: 'trace.zip'
  });`;

    code = code.replace(/(async.*\{)\s*\n/, `$1\n${tracingSetup}\n\n`);
    code = code.replace(/(\s*}\);)\s*$/, `${tracingTeardown}\n$1`);

    return code;
  }

  /**
   * 优化定位器（替换 CSS 为语义定位器）
   */
  private optimizeLocators(code: string): string {
    let enhanced = code;

    // 替换 page.locator('.class') 为建议
    const cssLocators = code.match(/page\.locator\(['"]\.[\w-]+['"]\)/g) || [];
    
    for (const locator of cssLocators) {
      console.warn(`[PlaywrightTestSkill] CSS class locator detected: ${locator}`);
      console.warn(`  Suggestion: Use page.getByRole(), page.getByTestId(), or page.getByLabel()`);
    }

    return enhanced;
  }

  /**
   * 验证和格式化
   */
  private validateAndFormat(code: string, context: PlaywrightTestContext): string {
    // 确保有正确的导入
    if (!code.includes('import')) {
      code = `import { test, expect } from '@playwright/test';\n\n${code}`;
    }

    // 确保有 describe
    if (!code.includes('test.describe(')) {
      code = `test.describe('${context.testName}', () => {\n${code}\n});`;
    }

    return code;
  }

  /**
   * 提取代码块
   */
  private extractCode(content: string): string {
    const codeBlockMatch = content.match(/```(?:typescript|javascript)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return content.trim();
  }
}

/**
 * Playwright 配置生成器
 */
export class PlaywrightConfigGenerator {
  static generateConfig(): string {
    return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 测试目录
  testDir: './tests',
  
  // 并行执行
  fullyParallel: true,
  
  // 禁止测试文件中的 test.only
  forbidOnly: !!process.env.CI,
  
  // CI 环境重试
  retries: process.env.CI ? 2 : 0,
  
  // 并发数
  workers: process.env.CI ? 1 : undefined,
  
  // 报告器
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }]
  ],
  
  // 全局配置
  use: {
    // 基础 URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // 追踪
    trace: 'on-first-retry',
    
    // 截图
    screenshot: 'only-on-failure',
    
    // 视频
    video: 'retain-on-failure',
    
    // 超时
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 项目配置（多浏览器）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 开发服务器
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
`;
  }
}

