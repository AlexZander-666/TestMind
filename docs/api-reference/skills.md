# Skills Framework API 参考

## 概述

TestMind v0.6.0 的技能框架提供可扩展的测试生成能力，支持自定义技能开发。

## 核心接口

### TestSkill

所有测试技能必须实现的核心接口。

```typescript
interface TestSkill {
  // 元数据
  readonly metadata: SkillMetadata;
  
  // 能力检查
  canHandle(context: TestContext): boolean | Promise<boolean>;
  
  // 执行测试生成
  generateTest(context: TestContext): Promise<TestSuite>;
  
  // 验证生成的测试
  validateTest(testCode: string): Promise<ValidationResult>;
  
  // 可选：改进现有测试
  improveTest?(testSuite: TestSuite): Promise<TestSuite>;
  
  // 可选：修复失败的测试
  healTest?(failedTest: any): Promise<any>;
  
  // 可选：获取改进建议
  getSuggestions?(testCode: string): Promise<ImprovementSuggestion[]>;
}
```

### SkillMetadata

技能元数据，用于注册和发现。

```typescript
interface SkillMetadata {
  /** 唯一标识符 */
  name: string;
  
  /** 版本号 */
  version: string;
  
  /** 描述 */
  description: string;
  
  /** 作者 */
  author: string;
  
  /** 支持的测试框架 */
  supportedFrameworks: TestFramework[];
  
  /** 支持的编程语言 */
  supportedLanguages: string[];
  
  /** 标签 */
  tags?: string[];
  
  /** 仓库URL */
  repository?: string;
  
  /** 依赖的其他技能 */
  dependencies?: string[];
}
```

---

## 内置技能

### EnhancedCypressTestSkill

增强的 Cypress 端到端测试生成。

#### 特性

- ✅ 用户流程录制
- ✅ API调用拦截
- ✅ 自定义命令生成
- ✅ 视觉回归测试
- ✅ 网络存根

#### 基础用法

```typescript
import { EnhancedCypressTestSkill } from '@testmind/core';

const skill = new EnhancedCypressTestSkill();

const testSuite = await skill.generateTest({
  projectId: 'my-app',
  testType: 'e2e',
  framework: 'cypress',
  url: 'https://myapp.com/login',
  userFlow: 'login with valid credentials',
  browsers: ['chromium', 'firefox']
});

console.log(testSuite.code);
```

#### 示例生成

**输入:**
```typescript
{
  url: 'https://example.com/products',
  userFlow: 'search and filter products',
  pageElements: [
    { name: 'searchInput', role: 'textbox', label: 'Search' },
    { name: 'filterButton', role: 'button', label: 'Filter' },
    { name: 'productList', role: 'list' }
  ]
}
```

**输出:**
```typescript
describe('Products - search and filter', () => {
  beforeEach(() => {
    cy.visit('https://example.com/products');
  });
  
  it('should search and filter products successfully', () => {
    // 输入搜索关键词
    cy.findByRole('textbox', { name: /search/i })
      .type('laptop');
    
    // 点击过滤按钮
    cy.findByRole('button', { name: /filter/i })
      .click();
    
    // 验证产品列表更新
    cy.findByRole('list')
      .should('be.visible')
      .children()
      .should('have.length.gt', 0);
  });
  
  it('should handle empty search results', () => {
    cy.findByRole('textbox', { name: /search/i })
      .type('nonexistent');
    
    cy.findByRole('button', { name: /filter/i })
      .click();
    
    cy.contains('No products found').should('be.visible');
  });
});
```

---

### EnhancedPlaywrightTestSkill

增强的 Playwright 测试生成。

#### 特性

- ✅ 多浏览器并行测试
- ✅ API Mocking
- ✅ 视觉回归
- ✅ 性能追踪
- ✅ 网络拦截

#### 基础用法

```typescript
import { EnhancedPlaywrightTestSkill } from '@testmind/core';

const skill = new EnhancedPlaywrightTestSkill();

const testSuite = await skill.generateTest({
  projectId: 'my-app',
  testType: 'e2e',
  framework: 'playwright',
  url: 'https://myapp.com',
  userFlow: 'complete checkout process',
  browsers: ['chromium', 'webkit', 'firefox']
});
```

#### 配置选项

```typescript
interface PlaywrightSkillConfig {
  // 浏览器设置
  browsers?: Array<'chromium' | 'firefox' | 'webkit'>;
  
  // 视口大小
  viewport?: { width: number; height: number };
  
  // 超时设置
  timeout?: number; // 默认: 30000
  
  // 截图选项
  screenshot?: 'on' | 'off' | 'only-on-failure';
  
  // 追踪选项
  trace?: boolean;
}
```

---

### VitestBrowserSkill

Vitest 浏览器模式测试生成。

#### 特性

- ✅ 快速 HMR
- ✅ 原生 ESM
- ✅ 组件测试
- ✅ 浏览器API支持

#### 基础用法

```typescript
import { VitestBrowserSkill } from '@testmind/core';

const skill = new VitestBrowserSkill();

const testSuite = await skill.generateTest({
  projectId: 'my-app',
  testType: 'component',
  framework: 'vitest',
  componentPath: 'src/components/Button.tsx',
  componentName: 'Button'
});
```

---

## 自定义技能开发

### 创建自定义技能

```typescript
import { TestSkill, SkillMetadata, TestContext, TestSuite } from '@testmind/shared';

export class CustomApiTestSkill implements TestSkill {
  readonly metadata: SkillMetadata = {
    name: 'custom-api-skill',
    version: '1.0.0',
    description: '自定义API测试生成器',
    author: 'Your Name',
    supportedFrameworks: ['jest', 'vitest'],
    supportedLanguages: ['typescript', 'javascript'],
    tags: ['api', 'rest', 'graphql']
  };
  
  canHandle(context: TestContext): boolean {
    return context.testType === 'api' && 
           context.apiEndpoints !== undefined;
  }
  
  async generateTest(context: TestContext): Promise<TestSuite> {
    // 1. 分析API端点
    const endpoints = context.apiEndpoints || [];
    
    // 2. 生成测试代码
    const testCode = this.buildTestCode(endpoints);
    
    // 3. 返回测试套件
    return {
      id: `custom-${Date.now()}`,
      projectId: context.projectId || '',
      targetEntityId: '',
      testType: 'api',
      framework: 'jest',
      code: testCode,
      filePath: `tests/api/${context.componentName || 'api'}.test.ts`,
      generatedAt: new Date(),
      generatedBy: 'ai',
      metadata: {
        skill: this.metadata.name,
        version: this.metadata.version,
        endpointsCount: endpoints.length
      }
    };
  }
  
  async validateTest(testCode: string): Promise<ValidationResult> {
    const issues: string[] = [];
    
    // 验证逻辑
    if (!testCode.includes('describe')) {
      issues.push('缺少测试套件');
    }
    
    if (!testCode.includes('it') && !testCode.includes('test')) {
      issues.push('缺少测试用例');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      score: issues.length === 0 ? 100 : 50
    };
  }
  
  private buildTestCode(endpoints: any[]): string {
    return `
import { describe, it, expect } from 'vitest';
import { api } from './api-client';

describe('API Tests', () => {
  ${endpoints.map(ep => this.generateEndpointTest(ep)).join('\n\n  ')}
});
    `.trim();
  }
  
  private generateEndpointTest(endpoint: any): string {
    return `
it('should ${endpoint.method} ${endpoint.path}', async () => {
  const response = await api.${endpoint.method.toLowerCase()}('${endpoint.path}');
  expect(response.status).toBe(200);
  expect(response.data).toBeDefined();
});
    `.trim();
  }
}
```

### 注册自定义技能

```typescript
import { SkillRegistry } from '@testmind/core';
import { CustomApiTestSkill } from './CustomApiTestSkill';

const registry = new SkillRegistry();

// 注册技能
registry.registerSkill(new CustomApiTestSkill());

// 使用技能
const skill = registry.getSkill('custom-api-skill');
const testSuite = await skill.generateTest(context);
```

---

## SkillOrchestrator

技能编排器，自动选择和执行最佳技能。

### 基础用法

```typescript
import { SkillOrchestrator } from '@testmind/core';

const orchestrator = new SkillOrchestrator(registry);

// 自动选择技能并生成测试
const result = await orchestrator.executeSkill({
  projectId: 'my-app',
  testType: 'api',
  apiEndpoints: [
    { method: 'GET', path: '/users' },
    { method: 'POST', path: '/users' }
  ]
});

console.log(`使用技能: ${result.skillUsed}`);
console.log(`生成测试: ${result.testSuite.filePath}`);
```

### API 方法

##### selectSkill(context: TestContext): TestSkill | null

根据上下文选择最合适的技能。

```typescript
const skill = orchestrator.selectSkill({
  testType: 'e2e',
  framework: 'playwright'
});

console.log(`选中: ${skill.metadata.name}`);
```

##### executeSkill(context: TestContext): Promise<SkillExecutionResult>

执行技能并返回结果。

```typescript
interface SkillExecutionResult {
  skillUsed: string;
  testSuite: TestSuite;
  validation: ValidationResult;
  duration: number;
  success: boolean;
}
```

---

## 完整示例

### 端到端技能使用流程

```typescript
import {
  SkillRegistry,
  SkillOrchestrator,
  EnhancedCypressTestSkill,
  EnhancedPlaywrightTestSkill,
  VitestBrowserSkill
} from '@testmind/core';
import { CustomApiTestSkill } from './skills/CustomApiTestSkill';

async function generateTests() {
  // 1. 创建注册表
  const registry = new SkillRegistry();
  
  // 2. 注册技能
  registry.registerSkill(new EnhancedCypressTestSkill());
  registry.registerSkill(new EnhancedPlaywrightTestSkill());
  registry.registerSkill(new VitestBrowserSkill());
  registry.registerSkill(new CustomApiTestSkill());
  
  // 3. 创建编排器
  const orchestrator = new SkillOrchestrator(registry);
  
  // 4. 生成不同类型的测试
  const contexts = [
    // E2E 测试
    {
      testType: 'e2e' as const,
      framework: 'playwright' as const,
      url: 'https://myapp.com/login',
      userFlow: 'user login'
    },
    
    // API 测试
    {
      testType: 'api' as const,
      framework: 'jest' as const,
      apiEndpoints: [
        { method: 'GET', path: '/api/users' },
        { method: 'POST', path: '/api/users' }
      ]
    },
    
    // 组件测试
    {
      testType: 'component' as const,
      framework: 'vitest' as const,
      componentPath: 'src/components/Button.tsx',
      componentName: 'Button'
    }
  ];
  
  for (const context of contexts) {
    const result = await orchestrator.executeSkill(context);
    
    console.log(`\n✅ ${result.skillUsed}:`);
    console.log(`   文件: ${result.testSuite.filePath}`);
    console.log(`   耗时: ${result.duration}ms`);
    console.log(`   验证: ${result.validation.valid ? '通过' : '失败'}`);
    
    // 保存测试文件
    await fs.writeFile(
      result.testSuite.filePath,
      result.testSuite.code
    );
  }
}

generateTests().catch(console.error);
```

---

## 最佳实践

### 1. 技能版本控制

```typescript
export class MySkill implements TestSkill {
  readonly metadata = {
    name: 'my-skill',
    version: '2.1.0', // 遵循 semver
    // ...
  };
}
```

### 2. 依赖管理

```typescript
readonly metadata = {
  // ...
  dependencies: ['base-skill@^1.0.0'],
  requiredPackages: ['@playwright/test@^1.40.0']
};
```

### 3. 错误处理

```typescript
async generateTest(context: TestContext): Promise<TestSuite> {
  try {
    // 生成逻辑
  } catch (error) {
    throw new SkillExecutionError(
      `Failed to generate test: ${error.message}`,
      { context, originalError: error }
    );
  }
}
```

---

## 相关文档

- [创建自定义技能指南](../guides/creating-custom-skills.md)
- [技能框架架构](../architecture/skill-framework.md)
- [技能市场](../community/skill-marketplace.md)

