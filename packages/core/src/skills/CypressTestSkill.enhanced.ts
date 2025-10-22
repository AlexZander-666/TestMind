/**
 * Enhanced CypressTestSkill - 增强的 Cypress 测试技能
 * 
 * 新增功能：
 * 1. 自动添加 API 拦截（cy.intercept）
 * 2. 使用 data-testid 而非脆弱选择器
 * 3. 添加可访问性检查
 * 4. 自定义命令推荐
 * 5. 最佳实践内置
 */

import { Skill } from './Skill';
import type { LLMService } from '../llm/LLMService';

/**
 * Cypress 测试上下文
 */
export interface CypressTestContext {
  /** 测试名称 */
  testName: string;
  
  /** 目标 URL */
  url: string;
  
  /** 操作序列 */
  actions: CypressAction[];
  
  /** 是否有 API 调用 */
  hasApiCalls: boolean;
  
  /** API 端点列表 */
  apiEndpoints?: APIEndpoint[];
  
  /** 是否检查可访问性 */
  checkAccessibility?: boolean;
  
  /** 选择器偏好 */
  selectorPreference?: 'data-testid' | 'aria' | 'css';
}

export interface CypressAction {
  type: 'visit' | 'click' | 'type' | 'select' | 'check' | 'assert';
  selector?: string;
  value?: string;
  assertion?: {
    type: 'visible' | 'contain' | 'equal' | 'exist';
    expected?: any;
  };
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  alias?: string;
  mockResponse?: any;
}

/**
 * Cypress 最佳实践规则
 */
const CYPRESS_BEST_PRACTICES = {
  // 推荐的选择器
  RECOMMENDED_SELECTORS: [
    'data-testid',
    'data-cy',
    'aria-label',
    'role',
    'id',
  ],
  
  // 避免的选择器
  AVOID_SELECTORS: [
    '.class-name',        // CSS 类名易变
    '#dynamic-id',        // 动态 ID
    'div > div > button', // 深层嵌套
    ':nth-child()',       // 位置依赖
  ],
  
  // 推荐的等待方式
  RECOMMENDED_WAITS: [
    'cy.wait(@alias)',    // 等待 API 请求
    '.should("be.visible")', // 等待可见性
    '.should("exist")',   // 等待存在
  ],
  
  // 避免的做法
  AVOID_PRACTICES: [
    'cy.wait(5000)',      // 硬编码等待
    '.invoke("prop")',    // 访问内部属性
    '.then(() => { /* async */ })', // 不必要的异步
  ],
};

/**
 * 增强的 Cypress 测试技能
 */
export class EnhancedCypressTestSkill {
  readonly name = 'enhanced-cypress-e2e';
  readonly version = '2.0.0';
  readonly description = 'Generate enhanced Cypress E2E tests with best practices';
  
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * 生成测试代码
   */
  async execute(context: CypressTestContext): Promise<{ code: string }> {
    console.log(`[CypressTestSkill] Generating enhanced test: ${context.testName}`);

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
    code = this.enhanceCypressCode(code, context);

    // 4. 验证和格式化
    code = this.validateAndFormat(code, context);

    return { code };
  }

  /**
   * 构建增强的 Prompt
   */
  private buildEnhancedPrompt(context: CypressTestContext): string {
    let prompt = `Generate a Cypress E2E test following these best practices:\n\n`;
    
    // 测试信息
    prompt += `**Test Name**: ${context.testName}\n`;
    prompt += `**URL**: ${context.url}\n\n`;

    // Cypress 最佳实践
    prompt += `**Best Practices**:\n`;
    prompt += `1. Use \`data-testid\` or \`data-cy\` attributes (NEVER use class names or complex CSS)\n`;
    prompt += `2. Use \`cy.intercept()\` for API mocking (DO NOT use cy.wait(number))\n`;
    prompt += `3. Chain commands naturally (cy.get().click().should())\n`;
    prompt += `4. Use descriptive aliases for API requests\n`;
    prompt += `5. Add accessibility checks where applicable\n\n`;

    // 操作序列
    prompt += `**Actions**:\n`;
    for (const action of context.actions) {
      prompt += `- ${action.type}`;
      if (action.selector) prompt += ` "${action.selector}"`;
      if (action.value) prompt += ` with value "${action.value}"`;
      if (action.assertion) prompt += ` (assert ${action.assertion.type})`;
      prompt += `\n`;
    }
    prompt += `\n`;

    // API 拦截
    if (context.hasApiCalls && context.apiEndpoints) {
      prompt += `**API Endpoints to Mock**:\n`;
      for (const endpoint of context.apiEndpoints) {
        prompt += `- ${endpoint.method} ${endpoint.url}`;
        if (endpoint.alias) prompt += ` (alias: @${endpoint.alias})`;
        prompt += `\n`;
      }
      prompt += `\n`;
    }

    // Few-shot 示例
    prompt += `**Example** (reference only):\n`;
    prompt += `\`\`\`typescript
describe('Login Flow', () => {
  beforeEach(() => {
    // Mock API
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: { token: 'mock-token', user: { id: 1, name: 'Test User' } }
    }).as('loginRequest');
  });

  it('should login successfully', () => {
    cy.visit('/login');
    
    // Use data-testid selectors
    cy.get('[data-testid="username"]').type('testuser');
    cy.get('[data-testid="password"]').type('password123');
    cy.get('[data-testid="login-button"]').click();
    
    // Wait for API
    cy.wait('@loginRequest');
    
    // Assert navigation
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="welcome-message"]')
      .should('be.visible')
      .and('contain', 'Test User');
  });
});
\`\`\`\n\n`;

    prompt += `Now generate the test code:\n`;

    return prompt;
  }

  /**
   * 增强 Cypress 代码
   */
  private enhanceCypressCode(code: string, context: CypressTestContext): string {
    let enhanced = code;

    // 1. 添加 API 拦截（如果检测到 API 调用但未添加）
    if (context.hasApiCalls && context.apiEndpoints && !code.includes('cy.intercept')) {
      enhanced = this.addApiInterception(enhanced, context.apiEndpoints);
    }

    // 2. 替换脆弱的选择器
    enhanced = this.replaceFragileSelectors(enhanced);

    // 3. 添加可访问性检查
    if (context.checkAccessibility) {
      enhanced = this.addAccessibilityChecks(enhanced);
    }

    // 4. 优化等待逻辑
    enhanced = this.optimizeWaits(enhanced);

    // 5. 添加最佳实践注释
    enhanced = this.addBestPracticeComments(enhanced);

    return enhanced;
  }

  /**
   * 添加 API 拦截
   */
  private addApiInterception(code: string, endpoints: APIEndpoint[]): string {
    // 查找 beforeEach 或在 it 之前插入
    const interceptions = endpoints.map(endpoint => {
      const alias = endpoint.alias || endpoint.url.split('/').pop() || 'api';
      const mockData = endpoint.mockResponse || { success: true };
      
      return `    cy.intercept('${endpoint.method}', '${endpoint.url}', {
      statusCode: 200,
      body: ${JSON.stringify(mockData, null, 6).replace(/\n/g, '\n      ')}
    }).as('${alias}');`;
    }).join('\n');

    // 如果已有 beforeEach
    if (code.includes('beforeEach(')) {
      return code.replace(
        /beforeEach\(\(\) => \{/,
        `beforeEach(() => {\n    // API Mocking\n${interceptions}\n`
      );
    } else {
      // 在第一个 it 之前插入
      return code.replace(
        /(\s+)(it\()/,
        `$1beforeEach(() => {\n    // API Mocking\n${interceptions}\n  });\n\n$1$2`
      );
    }
  }

  /**
   * 替换脆弱的选择器
   */
  private replaceFragileSelectors(code: string): string {
    let enhanced = code;

    // 替换类选择器为 data-testid
    const classSelectors = code.match(/cy\.get\(['"]\.[\w-]+['"]\)/g) || [];
    for (const selector of classSelectors) {
      const className = selector.match(/\.[\w-]+/)?.[0]?.slice(1);
      if (className) {
        const testId = className.replace(/-/g, '_');
        console.warn(`[CypressTestSkill] Fragile selector detected: ${selector}`);
        console.warn(`  Suggestion: Use data-testid="${testId}" instead`);
        // 注：实际替换需要更智能的逻辑，这里只是示例
      }
    }

    // 替换 nth-child
    enhanced = enhanced.replace(
      /:nth-child\(\d+\)/g,
      '[data-testid="replace-me"]'
    );

    // 添加警告注释
    if (enhanced !== code) {
      enhanced = `// ⚠️ Some selectors were optimized for stability\n` + enhanced;
    }

    return enhanced;
  }

  /**
   * 添加可访问性检查
   */
  private addAccessibilityChecks(code: string): string {
    // 在主要操作后添加 a11y 检查
    const a11yCheck = `
    // Accessibility check
    cy.injectAxe();
    cy.checkA11y();`;

    // 如果代码中没有 a11y 检查，添加
    if (!code.includes('checkA11y') && !code.includes('injectAxe')) {
      return code.replace(
        /(it\([^)]+\)\s*=>\s*\{[^}]*)(}\s*\);)/,
        `$1${a11yCheck}\n  $2`
      );
    }

    return code;
  }

  /**
   * 优化等待逻辑
   */
  private optimizeWaits(code: string): string {
    let enhanced = code;

    // 替换 cy.wait(number) 为更好的等待方式
    const hardcodedWaits = code.match(/cy\.wait\(\d+\)/g) || [];
    
    for (const wait of hardcodedWaits) {
      console.warn(`[CypressTestSkill] Hardcoded wait detected: ${wait}`);
      console.warn(`  Suggestion: Use cy.wait('@alias') or .should() instead`);
      
      // 添加注释标记
      enhanced = enhanced.replace(
        wait,
        `${wait} // ⚠️ Consider using cy.wait('@alias') instead`
      );
    }

    return enhanced;
  }

  /**
   * 添加最佳实践注释
   */
  private addBestPracticeComments(code: string): string {
    return `/**
 * Cypress E2E Test - Best Practices Applied
 * 
 * ✅ DO:
 * - Use data-testid, data-cy, or aria-label for selectors
 * - Use cy.intercept() for API mocking
 * - Chain commands naturally
 * - Use .should() for assertions
 * 
 * ❌ DON'T:
 * - Use class names or complex CSS selectors
 * - Use cy.wait(milliseconds)
 * - Access internal React state
 * - Overuse .then() callbacks
 */

${code}`;
  }

  /**
   * 验证和格式化
   */
  private validateAndFormat(code: string, context: CypressTestContext): string {
    // 1. 确保有 describe 和 it
    if (!code.includes('describe(')) {
      code = `describe('${context.testName}', () => {\n${code}\n});`;
    }

    if (!code.includes('it(')) {
      code = code.replace(
        /describe\([^)]+\)\s*=>\s*\{/,
        `$&\n  it('should ${context.testName.toLowerCase()}', () => {`
      );
      code += `\n  });`;
    }

    // 2. 确保有导入（如果需要）
    if (context.checkAccessibility && !code.includes('cypress-axe')) {
      code = `/// <reference types="cypress" />\n/// <reference types="cypress-axe" />\n\n` + code;
    }

    return code;
  }

  /**
   * 生成自定义命令建议
   */
  static generateCustomCommands(commonPatterns: string[]): string {
    return `// cypress/support/commands.ts
// Custom commands for common patterns

Cypress.Commands.add('login', (username: string, password: string) => {
  cy.get('[data-testid="username"]').type(username);
  cy.get('[data-testid="password"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.wait('@loginRequest');
});

Cypress.Commands.add('mockApi', (method: string, url: string, response: any) => {
  cy.intercept(method, url, response);
});

Cypress.Commands.add('checkA11y', (context?: string) => {
  cy.injectAxe();
  cy.checkA11y(context);
});

// Type definitions
declare global {
  namespace Cypress {
    interface Chainable {
      login(username: string, password: string): Chainable<void>
      mockApi(method: string, url: string, response: any): Chainable<void>
      checkA11y(context?: string): Chainable<void>
    }
  }
}
`;
  }

  /**
   * 提取代码块
   */
  private extractCode(content: string): string {
    // 提取 ``` 代码块
    const codeBlockMatch = content.match(/```(?:typescript|javascript)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // 如果没有代码块，返回整个内容
    return content.trim();
  }
}

/**
 * Cypress 配置生成器
 */
export class CypressConfigGenerator {
  /**
   * 生成推荐的 Cypress 配置
   */
  static generateConfig(): string {
    return `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // 基础 URL
    baseUrl: 'http://localhost:3000',
    
    // 视口大小
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // 超时设置
    defaultCommandTimeout: 5000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,
    
    // 重试策略
    retries: {
      runMode: 2,    // CI 环境重试 2 次
      openMode: 0,   // 开发环境不重试
    },
    
    // 视频和截图
    video: true,
    screenshotOnRunFailure: true,
    
    // 实验性功能
    experimentalStudio: true,
    experimentalWebKitSupport: true,
    
    setupNodeEvents(on, config) {
      // 可访问性测试
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });
      
      return config;
    },
  },
});
`;
  }

  /**
   * 生成推荐的插件配置
   */
  static generatePluginRecommendations(): string {
    return `# Recommended Cypress Plugins

## Essential Plugins

1. **cypress-axe** - Accessibility testing
   \`\`\`bash
   pnpm add -D cypress-axe axe-core
   \`\`\`

2. **@testing-library/cypress** - Better queries
   \`\`\`bash
   pnpm add -D @testing-library/cypress
   \`\`\`

3. **cypress-file-upload** - File upload testing
   \`\`\`bash
   pnpm add -D cypress-file-upload
   \`\`\`

4. **cypress-real-events** - Real user interactions
   \`\`\`bash
   pnpm add -D cypress-real-events
   \`\`\`

## Setup

\`\`\`typescript
// cypress/support/e2e.ts
import 'cypress-axe';
import '@testing-library/cypress/add-commands';
import 'cypress-file-upload';
import 'cypress-real-events';
\`\`\`
`;
  }
}

