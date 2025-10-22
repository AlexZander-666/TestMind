# Self-Healing API 参考

## 概述

TestMind v0.6.0 的自愈引擎提供企业级的测试稳定性保障，支持多种浏览器框架和定位策略。

## 核心组件

### BrowserAdapter

浏览器适配器接口，提供统一的元素查找和交互API。

#### 支持的适配器

- **PlaywrightAdapter** - Playwright 支持
- **CypressAdapter** - Cypress 支持

#### 基础用法

```typescript
import { createBrowserAdapter } from '@testmind/core';

// 自动检测浏览器类型
const adapter = await autoDetectAdapter(page);

// 或手动创建
const adapter = new PlaywrightAdapter(page);

// 查找元素
const element = await adapter.findElement('#submit-button');
```

#### API 方法

##### findElement(selector: string): Promise<ElementHandle | null>

查找单个元素。

**参数:**
- `selector` - CSS选择器或其他定位器

**返回:**
- `ElementHandle | null` - 元素句柄或null

**示例:**
```typescript
const button = await adapter.findElement('#login-btn');
if (button) {
  await adapter.click(button);
}
```

##### findElements(selector: string): Promise<ElementHandle[]>

查找多个元素。

**参数:**
- `selector` - CSS选择器

**返回:**
- `ElementHandle[]` - 元素句柄数组

---

### LocatorEngine

定位器引擎，实现5级定位策略。

#### 定位策略优先级

1. **ID Locator** - 基于元素ID（最稳定）
2. **CSS Selector** - 智能CSS选择器
3. **XPath** - XPath表达式
4. **Visual Locator** - 视觉特征定位
5. **Semantic Locator** - 语义定位

#### 基础用法

```typescript
import { LocatorEngine } from '@testmind/core';

const engine = new LocatorEngine(adapter);

// 自动选择最佳策略
const locator = await engine.findBestLocator(element);

// 使用特定策略
const cssLocator = await engine.strategies.css.locate(element);
```

#### API 方法

##### findBestLocator(element: ElementHandle): Promise<LocatorResult>

自动选择最稳定的定位策略。

**参数:**
- `element` - 目标元素

**返回:**
```typescript
interface LocatorResult {
  strategy: 'id' | 'css' | 'xpath' | 'visual' | 'semantic';
  selector: string;
  confidence: number; // 0-1
  metadata?: Record<string, any>;
}
```

---

### FailureClassifier

测试失败分类器，智能识别失败原因。

#### 失败类型

- `element-not-found` - 元素未找到
- `selector-outdated` - 选择器过时
- `timing-issue` - 时序问题
- `state-mismatch` - 状态不匹配
- `network-error` - 网络错误
- `assertion-failure` - 断言失败
- `unknown` - 未知错误

#### 基础用法

```typescript
import { EnhancedFailureClassifier } from '@testmind/core';

const classifier = new EnhancedFailureClassifier();

// 分类失败
const result = await classifier.classify(failure);

if (result.type === 'element-not-found') {
  // 触发自愈
  await selfHealingEngine.heal(failure);
}
```

#### API 方法

##### classify(failure: TestFailure): Promise<ClassificationResult>

分类测试失败。

**参数:**
```typescript
interface TestFailure {
  error: Error;
  stackTrace?: string;
  screenshot?: Buffer;
  context?: Record<string, any>;
}
```

**返回:**
```typescript
interface ClassificationResult {
  type: FailureType;
  confidence: number; // 0-1
  root cause?: string;
  suggestions: string[];
  healable: boolean;
}
```

---

## 完整示例

### 自愈测试流程

```typescript
import {
  createBrowserAdapter,
  LocatorEngine,
  EnhancedFailureClassifier,
  SelfHealingEngine
} from '@testmind/core';

// 1. 设置适配器
const adapter = createBrowserAdapter(page);
const engine = new LocatorEngine(adapter);
const classifier = new EnhancedFailureClassifier();

// 2. 运行测试
try {
  const button = await adapter.findElement('#old-selector');
  await adapter.click(button);
} catch (error) {
  // 3. 分类失败
  const result = await classifier.classify({
    error,
    screenshot: await page.screenshot()
  });
  
  // 4. 尝试自愈
  if (result.healable) {
    console.log(`尝试自愈: ${result.type}`);
    const healed = await engine.healSelector('#old-selector');
    
    if (healed.success) {
      console.log(`✅ 自愈成功: ${healed.newSelector}`);
      // 重试测试
      const button = await adapter.findElement(healed.newSelector);
      await adapter.click(button);
    }
  }
}
```

---

## 配置选项

### LocatorEngine 配置

```typescript
interface LocatorEngineConfig {
  // 策略超时（毫秒）
  timeout?: number; // 默认: 5000
  
  // 启用的策略
  enabledStrategies?: Array<'id' | 'css' | 'xpath' | 'visual' | 'semantic'>;
  
  // 重试次数
  maxRetries?: number; // 默认: 3
  
  // 可信度阈值
  confidenceThreshold?: number; // 默认: 0.7
}
```

### 自愈配置

```typescript
interface SelfHealingConfig {
  // 自动保存新选择器
  autoSave?: boolean; // 默认: true
  
  // 通知回调
  onHeal?: (result: HealResult) => void;
  
  // 选择器映射存储路径
  selectorMapPath?: string; // 默认: '.testmind/selector-map.json'
}
```

---

## 最佳实践

### 1. 选择器优先级

优先使用稳定的选择器：
- ✅ data-testid 属性
- ✅ 唯一的ID
- ✅ 语义化的 aria-label
- ⚠️ 类名（可能变化）
- ❌ 深层次的CSS路径

### 2. 自愈策略

```typescript
// 推荐：结合多种策略
const locator = await engine.findBestLocator(element, {
  strategies: ['id', 'css', 'semantic'],
  fallback: true
});
```

### 3. 监控和日志

```typescript
const engine = new LocatorEngine(adapter, {
  onHeal: (result) => {
    console.log(`🔧 自愈: ${result.oldSelector} → ${result.newSelector}`);
    // 发送到监控系统
    metrics.recordHeal(result);
  }
});
```

---

## 性能指标

- **自愈成功率**: 70%+
- **平均自愈时间**: < 2秒
- **误报率**: < 5%

---

## 故障排查

### 常见问题

**Q: 自愈失败，如何调试？**

A: 启用详细日志：
```typescript
const engine = new LocatorEngine(adapter, {
  debug: true,
  logLevel: 'verbose'
});
```

**Q: 如何禁用某个策略？**

A: 配置enabledStrategies：
```typescript
const engine = new LocatorEngine(adapter, {
  enabledStrategies: ['id', 'css'] // 只使用ID和CSS
});
```

---

## 相关文档

- [Self-Healing 指南](../guides/self-healing-guide.md)
- [高级用法](../guides/self-healing-advanced.md)
- [架构设计](../architecture/self-healing-engine.md)

