/**
 * VitestBrowserSkill - Vitest Browser Mode 测试技能
 * 
 * Vitest Browser Mode 是 Vitest 的浏览器测试模式，
 * 允许在真实浏览器中运行组件测试
 * 
 * 特点：
 * - 使用真实浏览器环境（通过 Playwright 或 WebdriverIO）
 * - 与 Vitest 生态无缝集成
 * - 支持热模块替换（HMR）
 * - 更快的测试启动速度
 */

import { Skill } from './Skill';
import type { LLMService } from '../llm/LLMService';

export interface VitestBrowserContext {
  /** 测试名称 */
  testName: string;
  
  /** 组件路径 */
  componentPath: string;
  
  /** 目标 URL */
  url?: string;
  
  /** 操作序列 */
  actions: BrowserAction[];
  
  /** 浏览器提供商 */
  provider?: 'playwright' | 'webdriverio';
  
  /** 是否使用用户事件 */
  useUserEvent?: boolean;
}

export interface BrowserAction {
  type: 'click' | 'type' | 'select' | 'check' | 'assert' | 'wait';
  selector: string;
  value?: string;
  expected?: any;
}

/**
 * Vitest Browser 测试技能
 */
export class VitestBrowserSkill {
  readonly name = 'vitest-browser';
  readonly version = '1.0.0';
  readonly description = 'Generate Vitest Browser Mode tests';
  
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * 执行技能
   */
  async execute(context: VitestBrowserContext): Promise<{ code: string }> {
    console.log(`[VitestBrowserSkill] Generating test: ${context.testName}`);

    const prompt = this.buildPrompt(context);

    const response = await this.llmService.generate({
      provider: 'openai',
      model: 'gpt-4',
      prompt,
      temperature: 0.2,
      maxTokens: 1000,
    });

    let code = this.extractCode(response.content);
    code = this.enhanceCode(code, context);

    return { code };
  }

  /**
   * 构建 Prompt
   */
  private buildPrompt(context: VitestBrowserContext): string {
    return `Generate a Vitest Browser Mode test for "${context.testName}".

Component: ${context.componentPath}
${context.url ? `URL: ${context.url}` : ''}
Provider: ${context.provider || 'playwright'}

Actions:
${context.actions.map(a => `- ${a.type} "${a.selector}"${a.value ? ` with "${a.value}"` : ''}`).join('\n')}

Example format:
\`\`\`typescript
import { test, expect } from 'vitest';
import { page } from '@vitest/browser/context';
import { userEvent } from '@vitest/browser/context';

test('${context.testName}', async () => {
  await page.goto('${context.url || '/'}');
  
  const element = page.getByRole('button', { name: 'Submit' });
  await expect.element(element).toBeVisible();
  
  await userEvent.click(element);
  
  await expect.element(page.getByText('Success')).toBeVisible();
});
\`\`\`

Generate the code:`;
  }

  /**
   * 增强代码
   */
  private enhanceCode(code: string, context: VitestBrowserContext): string {
    // 确保导入正确
    if (!code.includes('import')) {
      code = `import { test, expect } from 'vitest';
import { page${context.useUserEvent ? ', userEvent' : ''} } from '@vitest/browser/context';

${code}`;
    }

    // 使用 userEvent 替代直接操作（更真实）
    if (context.useUserEvent) {
      code = code.replace(/await\s+page\.(click|fill|type)\(/g, 'await userEvent.$1(');
    }

    return code;
  }

  /**
   * 提取代码
   */
  private extractCode(content: string): string {
    const match = content.match(/```(?:typescript|javascript)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : content.trim();
  }

  /**
   * 生成 Vitest Browser 配置
   */
  static generateConfig(): string {
    return `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 启用浏览器模式
    browser: {
      enabled: true,
      name: 'chromium', // or 'firefox', 'webkit'
      provider: 'playwright', // or 'webdriverio'
      
      // Playwright 配置
      providerOptions: {
        launch: {
          headless: true,
          args: ['--no-sandbox'],
        },
      },
    },
    
    // 全局配置
    globals: true,
    environment: 'node',
    
    // 覆盖率
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
`;
  }
}

