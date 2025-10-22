# Self-Healing Engine - 高级使用指南

## 概述

TestMind 的自愈引擎能够自动检测和修复失败的测试，使用5级定位策略和AI驱动的失败分类。

### 核心组件

1. **浏览器适配器** - 跨框架统一接口
2. **定位器引擎** - 5级定位策略瀑布
3. **失败分类器** - 智能区分Bug类型
4. **修复建议器** - 生成可操作的修复方案

---

## 快速开始

### 1. 基础使用

```bash
# 分析测试失败并生成修复建议
testmind heal --report test-results.json

# 自动应用高置信度修复
testmind heal --report test-results.json --auto --confidence-threshold 0.85

# CI 模式（自动提交）
testmind heal --report test-results.json --ci --auto-commit
```

### 2. 编程方式使用

```typescript
import { SelfHealingEngine, createBrowserAdapter } from '@testmind/core';
import { chromium } from 'playwright';

// 初始化引擎
const engine = new SelfHealingEngine({
  enableAutoFix: true,
  autoFixConfidenceThreshold: 0.85,
  enableLLM: true,
  llmService: myLLMService,
});

// 设置浏览器上下文
const browser = await chromium.launch();
const page = await browser.newPage();
const adapter = createBrowserAdapter('playwright', page);

const context = {
  adapter,
  page,
  url: page.url(),
};

// 执行自愈
const result = await engine.heal(testFailure, {
  testCode: 'cy.get("#old-selector").click();',
  pageContext: context,
});

// 检查结果
if (result.healed) {
  console.log('✅ Test auto-healed!');
  console.log(`New selector: ${result.newLocator?.metadata?.selector}`);
} else {
  console.log('⚠️  Manual review needed');
  result.suggestions.forEach(s => {
    console.log(`  - ${s.description}`);
  });
}
```

---

## 5级定位策略

### 策略瀑布流程

```
1. ID Locator (data-testid, data-cy, id)
   ├─ 找到？→ 返回 (置信度: 0.90-1.00)
   └─ 未找到 ↓

2. CSS Selector Locator
   ├─ 精确选择器 (tag + class + attrs)
   ├─ 部分匹配 (class + attrs)
   ├─ 类型匹配 (tag + attrs)
   ├─ 找到？→ 返回 (置信度: 0.70-0.95)
   └─ 未找到 ↓

3. XPath Locator
   ├─ 文本内容匹配
   ├─ 属性匹配
   ├─ 相对路径
   ├─ 找到？→ 返回 (置信度: 0.70-0.90)
   └─ 未找到 ↓

4. Visual Locator (图像相似度)
   ├─ 截图所有可见元素
   ├─ 计算视觉相似度
   ├─ 找到？→ 返回 (置信度: 0.70-0.85)
   └─ 未找到 ↓

5. Semantic Locator (AI理解意图)
   ├─ LLM 分析页面 DOM
   ├─ 生成最佳选择器
   ├─ 验证选择器
   └─ 返回 (置信度: 0.70-0.90)
```

### 定位器配置

```typescript
import { LocatorEngine } from '@testmind/core';

const locator = new LocatorEngine({
  // 启用视觉匹配
  enableVisualMatching: true,
  
  // 启用语义匹配（需要 LLM）
  enableSemanticMatching: true,
  
  // 最小置信度阈值
  minConfidenceThreshold: 0.7,
  
  // 自定义策略顺序
  fallbackStrategies: [
    'id',
    'css_selector',
    'xpath',
    'visual_similarity',
    'semantic_intent',
  ],
  
  // LLM 服务（语义定位需要）
  llmService: myLLMService,
});

// 使用定位器
const result = await locator.locateElement(
  {
    cssSelector: '.old-button',
    semanticIntent: 'submit button',
  },
  browserContext
);
```

---

## 失败分类

### 分类类型

#### 1. 环境问题 (Environment Issues)

**特征**:
- 网络错误 (ECONNREFUSED, timeout)
- 缺少依赖 (MODULE_NOT_FOUND)
- 权限问题 (EACCES)
- 端口占用 (EADDRINUSE)

**修复策略**: Cannot Fix（需要手动修复环境）

**建议**:
- 检查服务是否运行
- 验证网络连接
- 安装缺失的依赖
- 检查权限配置

#### 2. 测试脆弱性 (Test Fragility)

**特征**:
- 元素未找到 (Element not found)
- 元素不可见 (not visible)
- 等待超时 (wait timeout)
- 脆弱的选择器 (nth-child, deep nesting)

**修复策略**: Auto Fix 或 Suggest Fix

**建议**:
- 使用更稳定的选择器 (data-testid, role)
- 添加显式等待
- 检查 DOM 结构变化

#### 3. 真实 Bug (Real Bugs)

**特征**:
- 断言失败 (expected != actual)
- 类型错误 (TypeError)
- 空引用 (null/undefined)
- 业务逻辑错误

**修复策略**: Cannot Fix（需要修复应用代码）

**建议**:
- 检查业务逻辑
- 调试应用代码
- 验证数据完整性

### 分类示例

```typescript
import { FailureClassifier } from '@testmind/core';

const classifier = new FailureClassifier(llmService);

const result = await classifier.classify({
  testName: 'should login',
  testFile: 'login.spec.ts',
  errorMessage: 'Element not found: #submit-btn',
  stackTrace: '...',
  selector: '#submit-btn',
  timestamp: new Date(),
});

console.log(`Type: ${result.failureType}`);
console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
console.log(`Reason: ${result.reasoning}`);
console.log(`Suggestions: ${result.suggestedActions.join(', ')}`);
```

---

## 浏览器适配器

### 支持的框架

| 框架 | 状态 | 特性 |
|------|------|------|
| Playwright | ✅ 完整支持 | 多浏览器、截图、DOM提取 |
| Cypress | ✅ 完整支持 | 链式API、自动等待 |
| Puppeteer | 🚧 计划中 | Chrome DevTools Protocol |
| Selenium | 🚧 计划中 | 多浏览器、多语言 |

### 自定义适配器

```typescript
import { BrowserAdapter, BrowserAdapterFactory } from '@testmind/core';

class MyCustomAdapter implements BrowserAdapter {
  readonly name = 'my-framework';
  readonly version = '1.0';
  
  async findElement(selector: string) {
    // 实现元素查找逻辑
    return await myFramework.querySelector(selector);
  }
  
  // 实现其他方法...
}

// 注册适配器
import { BrowserAdapterRegistry } from '@testmind/core';

BrowserAdapterRegistry.register('my-framework', {
  create: (page) => new MyCustomAdapter(page),
  isSupported: () => typeof myFramework !== 'undefined',
});
```

---

## CI/CD 集成

### GitHub Actions

```yaml
- name: TestMind Auto-Heal
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    pnpm testmind heal \
      --report test-results.json \
      --ci \
      --auto-commit \
      --confidence-threshold 0.85
```

### GitLab CI

```yaml
heal:
  stage: test
  script:
    - pnpm testmind heal --report test-results.json --ci
  artifacts:
    paths:
      - testmind-healing-report.json
```

---

## 高级配置

### 完整配置示例

```typescript
import { SelfHealingEngine, LocatorEngine } from '@testmind/core';

const engine = new SelfHealingEngine({
  // 自动修复配置
  enableAutoFix: true,
  autoFixConfidenceThreshold: 0.9,
  
  // 意图跟踪
  enableIntentTracking: true,
  
  // LLM 增强
  enableLLM: true,
  llmService: customLLMService,
});

// 获取定位引擎（高级用途）
const locator = engine.getLocatorEngine();

// 自定义定位器配置
locator.config.minConfidenceThreshold = 0.75;
```

### 自定义定位策略

```typescript
import { LocatorEngine, LocatorStrategy } from '@testmind/core';

const locator = new LocatorEngine({
  // 只使用特定策略
  fallbackStrategies: [
    LocatorStrategy.ID,
    LocatorStrategy.CSS_SELECTOR,
    LocatorStrategy.SEMANTIC_INTENT,
  ],
  
  // 禁用视觉匹配（性能考虑）
  enableVisualMatching: false,
  
  // 更严格的阈值
  minConfidenceThreshold: 0.85,
});
```

---

## 性能优化

### 1. 限制扫描范围

```typescript
const visualLocator = new VisualLocator({
  maxElementsToScan: 30, // 默认 50
});
```

### 2. 缓存定位结果

```typescript
const cache = new Map();

async function locateWithCache(selector: string, context: BrowserContext) {
  if (cache.has(selector)) {
    return cache.get(selector);
  }
  
  const result = await locator.locateElement({ cssSelector: selector }, context);
  cache.set(selector, result);
  
  return result;
}
```

### 3. 并行处理

```typescript
// 批量自愈（并行）
const results = await engine.healBatch(failures, contextMap);
```

---

## 故障排查

### 常见问题

#### Q: 自愈成功率低？

A: 检查以下项：
1. 确保页面 DOM 已完全加载
2. 提供清晰的语义意图
3. 检查置信度阈值是否过高
4. 验证 LLM 服务是否可用

#### Q: 定位器返回错误元素？

A: 尝试：
1. 提供更多上下文（文本内容、属性）
2. 使用多个描述符
3. 调整置信度阈值
4. 检查元素唯一性

#### Q: 性能较慢？

A: 优化方案：
1. 禁用视觉匹配（如果不需要）
2. 减少扫描元素数量
3. 使用更快的定位策略
4. 缓存定位结果

---

## 最佳实践

### DO ✅

- 使用 `data-testid` 等测试专用属性
- 提供清晰的语义意图描述
- 定期更新意图记录
- 在 CI 中启用自动修复
- 审查修复建议后再应用

### DON'T ❌

- 依赖脆弱的 CSS 类名
- 使用深层嵌套选择器
- 跳过失败分类步骤
- 盲目接受所有自动修复
- 忽略环境问题

---

## 示例场景

### 场景 1: 按钮 ID 变更

**变更前**:
```html
<button id="submit-btn">Submit</button>
```

**变更后**:
```html
<button id="submit-button" data-testid="submit">Submit</button>
```

**测试代码**:
```typescript
// 原测试（失败）
cy.get('#submit-btn').click();

// 自愈后
cy.get('[data-testid="submit"]').click();
```

**自愈流程**:
1. IdLocator 尝试 `#submit-btn` → 失败
2. IdLocator 尝试 `data-testid="submit"` → ✅ 成功
3. 置信度: 0.95（data-testid 最稳定）
4. 自动应用修复

---

### 场景 2: 表单重构

**变更前**:
```html
<div class="login-form">
  <input class="username-input" />
</div>
```

**变更后**:
```html
<form class="auth-form">
  <input aria-label="Username" name="username" />
</form>
```

**自愈流程**:
1. CssSelectorLocator 尝试 `.username-input` → 失败
2. XPathLocator 尝试 `//input[@name="username"]` → ✅ 成功
3. 置信度: 0.85
4. 建议修复（需人工审查）

---

## 监控和调试

### 启用详细日志

```typescript
const engine = new SelfHealingEngine({ ... });

// 监听自愈事件
engine.on('healing-start', (failure) => {
  console.log(`Starting to heal: ${failure.testName}`);
});

engine.on('locator-tried', (strategy, result) => {
  console.log(`Tried ${strategy}: ${result ? 'success' : 'failed'}`);
});

engine.on('healing-complete', (result) => {
  console.log(`Healing ${result.healed ? 'succeeded' : 'failed'}`);
});
```

### 生成报告

```typescript
const results = await engine.healBatch(failures, contextMap);

// Markdown 报告
const markdownReport = engine.generateHealingReport(results);
await fs.writeFile('healing-report.md', markdownReport);

// JSON 报告
const jsonReport = JSON.stringify({
  summary: {
    total: results.size,
    healed: Array.from(results.values()).filter(r => r.healed).length,
  },
  details: Array.from(results.entries()),
}, null, 2);
```

---

## 配置参考

### SelfHealingEngine 配置

```typescript
interface SelfHealingConfig {
  // 是否启用自动修复（无需审查）
  enableAutoFix?: boolean; // 默认: false
  
  // 自动修复的最小置信度
  autoFixConfidenceThreshold?: number; // 默认: 0.9
  
  // 是否启用意图跟踪
  enableIntentTracking?: boolean; // 默认: true
  
  // 是否启用 LLM
  enableLLM?: boolean; // 默认: true
  
  // LLM 服务实例
  llmService?: LLMService;
}
```

### LocatorEngine 配置

```typescript
interface LocatorEngineConfig {
  // 启用视觉匹配
  enableVisualMatching?: boolean; // 默认: true
  
  // 启用语义匹配
  enableSemanticMatching?: boolean; // 默认: true
  
  // 最小置信度
  minConfidenceThreshold?: number; // 默认: 0.7
  
  // 策略顺序
  fallbackStrategies?: LocatorStrategy[];
  
  // LLM 服务
  llmService?: LLMService;
}
```

---

## API 参考

完整 API 文档请参考：
- [BrowserAdapter API](../api/browser-adapter.md)
- [LocatorEngine API](../api/locator-engine.md)
- [FailureClassifier API](../api/failure-classifier.md)
- [SelfHealingEngine API](../api/self-healing-engine.md)

---

## 更多资源

- [架构设计](../../ARCHITECTURE.md)
- [贡献指南](../../CONTRIBUTING.md)
- [示例项目](../../examples/self-healing/)
- [常见问题](./faq.md)


















