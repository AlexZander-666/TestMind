/**
 * WebdriverIOSkill - WebdriverIO 测试技能
 * 
 * WebdriverIO 特点：
 * - 支持 Web 和移动端测试（Appium）
 * - 多种测试框架（Mocha, Jasmine, Cucumber）
 * - 丰富的插件生态
 * - 内置等待机制
 */

import { Skill } from './Skill';
import type { LLMService } from '../llm/LLMService';

export interface WebdriverIOContext {
  /** 测试名称 */
  testName: string;
  
  /** 测试类型 */
  testType: 'web' | 'mobile' | 'hybrid';
  
  /** 目标 URL（Web）或应用包名（Mobile） */
  target: string;
  
  /** 操作序列 */
  actions: WebDriverAction[];
  
  /** 平台（移动端）*/
  platform?: 'android' | 'ios';
  
  /** 设备名称 */
  deviceName?: string;
  
  /** 测试框架 */
  framework?: 'mocha' | 'jasmine';
}

export interface WebDriverAction {
  type: 'navigate' | 'click' | 'setValue' | 'getText' | 'assert';
  selector?: string;
  value?: string;
  expected?: any;
}

/**
 * WebdriverIO 测试技能
 */
export class WebdriverIOSkill {
  readonly name = 'webdriverio';
  readonly version = '1.0.0';
  readonly description = 'Generate WebdriverIO tests for web and mobile';
  
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * 执行技能
   */
  async execute(context: WebdriverIOContext): Promise<{ code: string }> {
    console.log(`[WebdriverIOSkill] Generating ${context.testType} test: ${context.testName}`);

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
  private buildPrompt(context: WebdriverIOContext): string {
    let prompt = `Generate a WebdriverIO test for "${context.testName}".\n\n`;
    
    prompt += `Type: ${context.testType}\n`;
    prompt += `Target: ${context.target}\n`;
    if (context.platform) {
      prompt += `Platform: ${context.platform}\n`;
    }
    prompt += `Framework: ${context.framework || 'mocha'}\n\n`;

    prompt += `Actions:\n`;
    for (const action of context.actions) {
      prompt += `- ${action.type}`;
      if (action.selector) prompt += ` "${action.selector}"`;
      if (action.value) prompt += ` = "${action.value}"`;
      prompt += `\n`;
    }

    if (context.testType === 'web') {
      prompt += `\nExample (Web):\n`;
      prompt += `\`\`\`typescript
describe('Login Test', () => {
  it('should login successfully', async () => {
    await browser.url('/login');
    
    await $('#username').setValue('testuser');
    await $('#password').setValue('password123');
    await $('button[type="submit"]').click();
    
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/dashboard'),
      { timeout: 5000, timeoutMsg: 'expected to navigate to dashboard' }
    );
    
    const welcome = await $('[data-testid="welcome"]');
    await expect(welcome).toBeDisplayed();
    await expect(welcome).toHaveText('Welcome, testuser');
  });
});
\`\`\`\n\n`;
    } else {
      prompt += `\nExample (Mobile):\n`;
      prompt += `\`\`\`typescript
describe('Mobile App Test', () => {
  it('should click button', async () => {
    const button = await $('~loginButton'); // accessibility id
    await button.click();
    
    const message = await $('android=new UiSelector().text("Success")');
    await expect(message).toBeDisplayed();
  });
});
\`\`\`\n\n`;
    }

    prompt += `Generate the test code:\n`;

    return prompt;
  }

  /**
   * 增强代码
   */
  private enhanceCode(code: string, context: WebdriverIOContext): string {
    // 添加超时和等待优化
    if (context.testType === 'mobile') {
      code = this.addMobileOptimizations(code);
    }

    return code;
  }

  /**
   * 添加移动端优化
   */
  private addMobileOptimizations(code: string): string {
    // 添加隐式等待配置
    return `// Mobile test optimizations
await browser.setImplicitTimeout(10000);

${code}`;
  }

  /**
   * 提取代码
   */
  private extractCode(content: string): string {
    const match = content.match(/```(?:typescript|javascript)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : content.trim();
  }

  /**
   * 生成 WebdriverIO 配置（Web）
   */
  static generateWebConfig(): string {
    return `export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./tests/**/*.spec.ts'],
  maxInstances: 10,
  
  capabilities: [{
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: ['--headless', '--disable-gpu', '--no-sandbox']
    }
  }],
  
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:3000',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  
  framework: 'mocha',
  reporters: ['spec', ['json', { outputDir: './reports' }]],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};
`;
  }

  /**
   * 生成 Appium 配置（Mobile）
   */
  static generateMobileConfig(platform: 'android' | 'ios'): string {
    if (platform === 'android') {
      return `export const config: WebdriverIO.Config = {
  port: 4723,
  capabilities: [{
    platformName: 'Android',
    'appium:deviceName': 'Android Emulator',
    'appium:platformVersion': '13.0',
    'appium:app': '/path/to/app.apk',
    'appium:automationName': 'UiAutomator2',
    'appium:newCommandTimeout': 240
  }],
  
  framework: 'mocha',
  mochaOpts: {
    timeout: 60000
  }
};
`;
    } else {
      return `export const config: WebdriverIO.Config = {
  port: 4723,
  capabilities: [{
    platformName: 'iOS',
    'appium:deviceName': 'iPhone 14',
    'appium:platformVersion': '16.0',
    'appium:app': '/path/to/app.app',
    'appium:automationName': 'XCUITest',
    'appium:newCommandTimeout': 240
  }],
  
  framework: 'mocha',
  mochaOpts: {
    timeout: 60000
  }
};
`;
    }
  }
}

