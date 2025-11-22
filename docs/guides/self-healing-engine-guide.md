# TestMind 自愈引擎使用指南

**版本**: v0.6.0-alpha  
**更新日期**: 2025-10-21

---

## 🎯 什么是自愈引擎？

TestMind 自愈引擎是一个智能的测试修复系统，能够：
1. **自动检测**测试失败原因
2. **智能分类**失败类型（环境/Bug/脆弱性）
3. **生成修复建议**（Diff格式）
4. **自动修复**简单问题（可配置）

---

## 🏗️ 架构概览

```
测试失败
    ↓
FailureClassifier (失败分类)
├─ 38种失败模式匹配
├─ 智能Flaky检测（4策略）
└─ LLM增强分类（可选）
    ↓
LocatorEngine (元素重定位)
├─ Strategy 1: IdLocator
├─ Strategy 2: CssSelectorLocator
├─ Strategy 3: XPathLocator
├─ Strategy 4: VisualLocator
└─ Strategy 5: SemanticLocator
    ↓
FixSuggester (修复建议)
└─ Diff格式输出
    ↓
用户审查（Diff-First）
    ↓
应用修复 或 手动调整
```

---

## 🚀 快速开始

### 基本使用

```typescript
import { HealingEngine } from '@testmind/core/self-healing';
import { LLMService } from '@testmind/core/llm';

// 1. 创建自愈引擎
const llmService = new LLMService(/* config */);
const healingEngine = new HealingEngine({
  enableAutoHealing: false,  // 手动审查模式
  enableLLMEnhancement: true,
  llmService,
});

// 2. 处理测试失败
const result = await healingEngine.healTest({
  testFailure: {
    testName: 'should login successfully',
    testFile: 'test/login.spec.ts',
    errorMessage: 'Element not found: .submit-button',
    stackTrace: '...',
    selector: '.submit-button',
    timestamp: new Date(),
  },
  testCode: `cy.get('.submit-button').click();`,
});

// 3. 查看结果
console.log('Healed:', result.healed);
console.log('Classification:', result.classification.failureType);
console.log('Suggestions:', result.fixSuggestions);
```

---

## 🔧 五级定位器策略

### Strategy 1: IdLocator（最快最可靠）

**适用场景**: 元素有ID属性

**优先级**:
1. `data-testid` - 置信度 1.0（最佳）
2. `data-cy` - 置信度 0.95（Cypress惯例）
3. `data-pw` - 置信度 0.95（Playwright惯例）
4. `id` - 置信度 0.90
5. `name` - 置信度 0.85
6. `aria-label` - 置信度 0.80

**使用示例**:
```typescript
import { IdLocator } from '@testmind/core/self-healing/strategies';

const locator = new IdLocator();
const result = await locator.locate({
  attributes: {
    'data-testid': 'submit-btn'
  }
});

// result.confidence = 1.0
// result.element = <匹配的元素>
```

**建议**:
- ✅ 优先使用 `data-testid`
- ✅ Cypress项目使用 `data-cy`
- ✅ Playwright项目使用 `data-pw`
- ❌ 避免仅依赖 `name`（可能非唯一）

---

### Strategy 2: CssSelectorLocator（灵活性好）

**适用场景**: 需要组合多个属性定位

**降级策略**:
```
Level 1: button.primary[type="submit"]  → 0.95 (精确)
Level 2: .primary[type="submit"]        → 0.80 (部分)
Level 3: button[type="submit"]          → 0.75 (类型)
Level 4: .login-form button             → 0.75 (祖先)
Level 5: .primary                       → 0.65 (类名)
Level 6: button                         → 0.60 (标签)
```

**使用示例**:
```typescript
import { CssSelectorLocator } from '@testmind/core/self-healing/strategies';

const locator = new CssSelectorLocator();
const result = await locator.locate({
  cssSelector: 'button.primary[type="submit"]'
});
```

**建议**:
- ✅ 组合多个属性提高稳定性
- ✅ 优先使用data-属性
- ❌ 避免仅用class（容易变化）

---

### Strategy 3: XPathLocator（强大但脆弱）

**适用场景**: 需要基于文本内容或复杂结构定位

**推荐使用**:
```typescript
// ✅ 好的XPath (相对 + 文本)
//button[text()="Login"]                    → 0.85
//*[@data-testid="submit"]                  → 0.95

// ⚠️ 一般的XPath (相对 + 属性)
//button[@type="submit"]                    → 0.75

// ❌ 差的XPath (绝对路径)
/html/body/div[1]/form/button[2]           → 0.60
```

**使用示例**:
```typescript
import { XPathLocator } from '@testmind/core/self-healing/strategies';

const locator = new XPathLocator();
const result = await locator.locate({
  xpath: '//button[text()="Login"]'
});
```

**建议**:
- ✅ 使用相对路径（//）
- ✅ 结合文本内容
- ❌ 避免数字索引 [1], [2]
- ❌ 避免深层绝对路径

---

### Strategy 4: VisualLocator（创新）

**适用场景**: 其他策略失败，元素位置稳定

**相似度计算**:
```
总相似度 = 
  位置相似度 * 0.3 +
  大小相似度 * 0.2 +
  颜色相似度 * 0.2 +
  文本相似度 * 0.3
```

**使用示例**:
```typescript
import { VisualLocator } from '@testmind/core/self-healing/strategies';

const locator = new VisualLocator();
const result = await locator.locate({
  visualSignature: JSON.stringify({
    position: { x: 100, y: 200 },
    size: { width: 150, height: 40 },
    backgroundColor: '#007bff',
    textContent: 'Submit'
  })
});
```

**注意**:
- ⚠️ 当前为模拟实现
- ⚠️ 真实环境需要浏览器API
- ⚠️ 置信度较低（0.50-0.80）

---

### Strategy 5: SemanticLocator（AI驱动）

**适用场景**: 基于自然语言意图定位

**意图示例**:
- "登录按钮" → `button[type="submit"]`
- "用户名输入框" → `input[name="username"]`
- "主导航菜单" → `nav[role="navigation"]`

**使用示例**:
```typescript
import { SemanticLocator } from '@testmind/core/self-healing/strategies';

const llmService = new LLMService(/* config */);
const locator = new SemanticLocator(llmService);

const result = await locator.locate({
  semanticIntent: 'login button'
});

// LLM分析生成多个候选选择器
// 自动尝试并返回最佳匹配
```

**建议**:
- ✅ 描述清晰具体
- ✅ 包含元素类型（button, input）
- ❌ 避免过于模糊的描述

---

## 📊 失败分类器

### 38种失败模式

#### 环境问题（10个）
```typescript
// 网络相关
ECONNREFUSED, ETIMEDOUT, ENOTFOUND, ERR_CONNECTION_REFUSED,
Network request failed, ECONNRESET

// 服务状态
503, 502, 504, database unavailable
```

#### 超时问题（5个）
```typescript
Timeout exceeded, Timed out waiting, Element not visible within timeout,
waitForSelector timeout, Operation timeout
```

#### 选择器问题（8个）
```typescript
Element not found, NoSuchElementError, Selector did not match,
StaleElementReferenceError, Element not attached,
ElementNotInteractableError, Element covered, Invalid selector
```

#### 断言问题（6个）
```typescript
Expected...but got, AssertionError, toBe/toEqual failed,
Expected to contain, Expected to have, Snapshot mismatch
```

#### 异步问题（5个）
```typescript
Promise rejected, await in non-async, Callback already called,
Stack overflow, Race condition
```

#### 类型错误（4个）
```typescript
TypeError, ReferenceError, undefined is not, null is not
```

---

### 使用失败分类器

```typescript
import { FailureClassifier } from '@testmind/core/self-healing';

const classifier = new FailureClassifier(llmService);

const result = await classifier.classify({
  testName: 'login test',
  testFile: 'test/login.spec.ts',
  errorMessage: 'Element not found: .submit-btn',
  stackTrace: '...',
  timestamp: new Date(),
});

console.log('Type:', result.failureType);
// → 'test_fragility'

console.log('Confidence:', result.confidence);
// → 0.85

console.log('Flaky:', result.isFlaky);
// → false

console.log('Actions:', result.suggestedActions);
// → ['Update selectors', 'Add waits', 'Use stable locators']
```

---

## 🧠 智能Flaky检测

### 4个检测策略

#### 1. 历史成功率分析（权重0.4）
```typescript
if (passRate > 0.5 && passRate < 0.95) {
  // 成功率在50-95%之间，很可能是Flaky
  score += 0.4;
}
```

#### 2. 时序模式检测（权重0.2）
```typescript
if (nightFailureRate > 0.7) {
  // 凌晨失败率>70%，可能是时间相关
  score += 0.2;
}
```

#### 3. 交替模式检测（权重0.3）
```typescript
if (alternationRate > 0.6) {
  // 通过-失败-通过-失败模式
  score += 0.3;
}
```

#### 4. 执行时间波动（权重0.1）
```typescript
if (stdDev / avgDuration > 0.5) {
  // 标准差>平均值50%
  score += 0.1;
}
```

### 使用Flaky分析

```typescript
const analysis = classifier.getFlakinessAnalysis(failure);

console.log('Is Flaky:', analysis.isFlaky);
// → true

console.log('Score:', analysis.flakinessScore);
// → 0.7

console.log('Reasons:', analysis.reasons);
// → ['Inconsistent pass rate: 65.0%', 'Pass/fail alternating pattern detected']

console.log('Recommendation:', analysis.recommendation);
// → 'Add explicit waits, fix race conditions, or isolate test dependencies'
```

---

## 💡 最佳实践

### 1. 选择正确的定位器

**优先级**:
1. IdLocator（data-testid） - 最稳定
2. CssSelectorLocator（属性组合） - 较稳定
3. XPathLocator（文本内容） - 语义化
4. VisualLocator - 降级选项
5. SemanticLocator（LLM） - 最后手段

### 2. 配置自愈引擎

```typescript
// 推荐配置
const config = {
  enableAutoHealing: false,  // 生产环境建议false
  enableLLMEnhancement: true,  // 提高分类准确率
  maxHealingAttempts: 3,
  confidenceThreshold: 0.8,  // 仅接受高置信度修复
};
```

### 3. 处理Flaky测试

**检测到Flaky后**:
1. 查看Flakiness分析原因
2. 根据建议添加等待或隔离依赖
3. 重新运行多次验证稳定性

---

## 🔍 故障排查

### 问题1: 定位器找不到元素

**可能原因**:
- 元素未加载
- 选择器错误
- 页面结构变化

**解决方案**:
```typescript
// 1. 检查置信度
if (result.confidence < 0.7) {
  // 置信度太低，尝试下一个策略
}

// 2. 使用多个策略
const strategies = [idLocator, cssLocator, xpathLocator];
for (const strategy of strategies) {
  const result = await strategy.locate(descriptor);
  if (result && result.confidence >= 0.8) {
    return result;
  }
}
```

### 问题2: 分类准确率低

**可能原因**:
- 失败信息不完整
- 模式库不匹配

**解决方案**:
1. 提供完整的错误信息和堆栈
2. 启用LLM增强分类
3. 添加自定义模式

### 问题3: Flaky检测不准确

**可能原因**:
- 历史运行记录不足

**解决方案**:
1. 至少运行3次以上
2. 提供完整的previousRuns数据

---

## 📊 性能建议

### 优化定位器性能

1. **ID定位器优先**:  
   最快（~1ms），准确性最高

2. **缓存定位结果**:  
   相同选择器重复定位时复用

3. **并行尝试**（谨慎）:  
   对于批量修复，可并行尝试多个策略

### 优化分类性能

1. **规则优先**:  
   仅在置信度<0.8时调用LLM

2. **缓存LLM结果**:  
   相似错误信息复用分类结果

---

## 🎯 高级用法

### 自定义失败模式

```typescript
// 添加项目特定的失败模式
const customPatterns: FailurePattern[] = [
  {
    pattern: /our-custom-error/i,
    type: FailureType.REAL_BUG,
    keywords: ['custom', 'error'],
    weight: 0.9
  }
];

// 注入到分类器
classifier.addPatterns(customPatterns);
```

### 批量自愈

```typescript
const failures = [failure1, failure2, failure3];

const results = await Promise.all(
  failures.map(f => healingEngine.healTest({ testFailure: f, testCode: '...' }))
);

const healedCount = results.filter(r => r.healed).length;
console.log(`Healed ${healedCount}/${failures.length} tests`);
```

---

## 📈 监控与指标

### 关键指标

1. **自愈成功率**:  
   `healed / total failures * 100%`  
   目标: ≥80%

2. **分类准确率**:  
   `correct classifications / total * 100%`  
   目标: ≥85%

3. **Flaky检测准确率**:  
   `correct flaky detections / total * 100%`  
   目标: ≥80%

4. **平均置信度**:  
   `avg(locator.confidence)`  
   目标: ≥0.80

---

## 🚨 注意事项

### 当前版本限制

1. **VisualLocator**: 模拟实现，需浏览器环境
2. **SemanticLocator**: 需要LLM API密钥和成本
3. **自动修复**: 默认关闭，需手动启用

### 安全建议

1. **永远审查修复**: Diff-First原则
2. **设置置信度阈值**: ≥0.8
3. **限制自动修复范围**: 仅简单选择器更新

---

## 📚 参考文档

- [Architecture: Self-Healing Engine](../architecture/self-healing-engine.md)
- [Locator Strategies API](../api/locator-strategies.md)
- [Failure Classification](../api/failure-classification.md)

---

## 🤝 贡献

欢迎贡献：
- 新的失败模式
- 新的定位器策略
- Flaky检测算法改进

参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

**版本**: v0.6.0-alpha  
**状态**: ✅ 核心功能完成  
**文档更新**: 2025-10-21

Made with ❤️ by TestMind Team

















