# TestMind 自愈测试引擎指南

## 概述

TestMind 的自愈引擎是一个智能的测试维护系统，能够自动检测、分类和修复失败的测试。这个引擎解决了测试自动化中最大的痛点：**Flaky Tests（不稳定测试）**。

### 核心能力

1. **多策略元素定位** - 5级定位策略瀑布，确保元素找到
2. **智能失败分类** - 区分环境问题、真实Bug和测试脆弱性
3. **AI修复建议** - 生成可审查的修复代码diff
4. **Diff-First模型** - 所有修改都需要人工审查

---

## 快速开始

### 安装

自愈引擎包含在 TestMind v0.4.0+ 中：

```bash
npm install -g testmind@latest
```

### 基本用法

```bash
# 分析并修复失败的测试
testmind heal test/login.test.ts

# 自动应用高置信度修复
testmind heal test/login.test.ts --auto

# 仅分析，不生成修复
testmind heal test/login.test.ts --analyze-only

# 启用LLM增强建议
testmind heal test/login.test.ts --use-llm
```

---

## 核心组件

### 1. 多策略元素定位器 (LocatorEngine)

自动尝试多种策略找到页面元素：

```typescript
import { LocatorEngine } from '@testmind/core';

const engine = new LocatorEngine();

// 定义元素描述
const descriptor = {
  id: 'submit-btn',
  cssSelector: '.btn-submit',
  xpath: '//button[@type="submit"]',
  textContent: 'Submit',
  semanticIntent: 'login button'
};

// 多策略定位
const result = await engine.locateElement(descriptor);
// 返回: { element, strategy, confidence, metadata }
```

#### 定位策略优先级

1. **ID定位** (置信度: 1.0) - 最快、最可靠
2. **CSS Selector** (置信度: 0.7-0.9) - 依赖选择器复杂度
3. **XPath** (置信度: 0.6) - 相对不稳定
4. **视觉相似度** (置信度: 0.5) - AI驱动（未完全实现）
5. **语义理解** (置信度: 0.5) - LLM驱动（未完全实现）

#### 配置选项

```typescript
const engine = new LocatorEngine({
  enableVisualMatching: true,  // 启用视觉匹配
  enableSemanticMatching: true, // 启用语义匹配
  minConfidenceThreshold: 0.7,  // 最低置信度阈值
  fallbackStrategies: [         // 自定义策略顺序
    'id',
    'css_selector',
    'xpath'
  ]
});
```

---

### 2. 失败分类器 (FailureClassifier)

智能分类测试失败原因：

```typescript
import { FailureClassifier, FailureType } from '@testmind/core';

const classifier = new FailureClassifier(llmService);

const failure = {
  testName: 'should load page',
  testFile: 'test/page.test.ts',
  errorMessage: 'Timeout exceeded waiting for page to load',
  stackTrace: 'at Page.load (page.ts:123)',
  timestamp: new Date()
};

const result = await classifier.classify(failure);
// 返回:
// {
//   failureType: 'environment',
//   confidence: 0.85,
//   reasoning: 'Network timeout pattern detected',
//   suggestedActions: ['Check network', 'Increase timeout'],
//   isFlaky: false
// }
```

#### 失败类型

- **ENVIRONMENT** - 环境问题（网络超时、服务不可用）
- **REAL_BUG** - 真实Bug（逻辑错误、功能缺陷）
- **TEST_FRAGILITY** - 测试脆弱性（选择器过时、时序问题）
- **UNKNOWN** - 未知（无法分类）

#### Flaky Test 检测

自动检测测试历史中的不稳定模式：

```typescript
const failure = {
  // ... 基本信息
  previousRuns: [
    { timestamp: new Date(), passed: true, duration: 100 },
    { timestamp: new Date(), passed: false, duration: 120 },
    { timestamp: new Date(), passed: true, duration: 110 },
    { timestamp: new Date(), passed: false, duration: 125 }
  ]
};

const result = await classifier.classify(failure);
// result.isFlaky === true (通过/失败交替出现)
```

---

### 3. 修复建议器 (FixSuggester)

生成智能修复建议：

```typescript
import { FixSuggester, FixType } from '@testmind/core';

const suggester = new FixSuggester(llmService);

const context = {
  testCode: `
    await page.click('.old-selector');
    expect(page.url()).toBe('/dashboard');
  `,
  currentSelector: '.old-selector',
  alternativeSelectors: [
    { id: 'submit-btn' },
    { cssSelector: '.new-selector' }
  ],
  failureClassification: {
    failureType: 'test_fragility',
    confidence: 0.9,
    reasoning: 'Element selector is outdated',
    suggestedActions: [],
    isFlaky: false
  }
};

const suggestions = await suggester.suggestFixes(failure, context);
// 返回按置信度排序的修复建议数组
```

#### 修复类型

- **UPDATE_SELECTOR** - 更新元素选择器
- **ADD_WAIT** - 增加等待时间
- **FIX_ASSERTION** - 修复断言
- **ADD_RETRY** - 添加重试逻辑
- **UPDATE_TEST_DATA** - 更新测试数据
- **OTHER** - 其他修复

#### 修复建议结构

```typescript
{
  type: 'UPDATE_SELECTOR',
  description: 'Update selector to use ID (most stable)',
  diff: `
    --- Line 2
    - await page.click('.old-selector');
    + await page.click('#submit-btn');
  `,
  confidence: 0.95,
  estimatedEffort: 'low',
  reasoning: 'ID selectors are more stable than class selectors',
  alternativeApproaches: [
    'Use data-testid attribute',
    'Use text content for selection'
  ]
}
```

---

## CLI 使用指南

### heal 命令详解

```bash
testmind heal [test-file] [options]
```

#### 参数

- `[test-file]` - 要修复的测试文件（可选，默认分析所有失败测试）

#### 选项

- `--auto` - 自动应用高置信度（≥0.8）修复
- `--analyze-only` - 仅分析失败，不生成修复建议
- `--use-llm` - 启用LLM增强的修复建议

### 示例工作流

#### 1. 分析失败

```bash
$ testmind heal test/login.test.ts --analyze-only

🔧 TestMind - Self-Healing Test Engine

✓ Self-healing engines ready
✓ Found 2 test failure(s)

📋 Failure 1/2: should login successfully
   File: test/login.test.ts
   Error: Element not found: .submit-button
   Classification: Test Fragility
   Confidence: 90%
   Reason: Element selector is outdated
   ⚠️  Detected as FLAKY test (unstable history)

   Suggested actions:
   1. Update element selectors to be more robust
   2. Add explicit waits for elements to be ready
   3. Use more stable locator strategies (ID > CSS > XPath)
```

#### 2. 生成修复建议

```bash
$ testmind heal test/login.test.ts

💡 Suggestion 1: Update selector to use ID (most stable)
   Type: update_selector
   Confidence: 95%
   Effort: low
   Reason: ID selectors are more stable

📝 Proposed Changes:
--- Line 15
- await page.click('.submit-button')
+ await page.click('#submit-btn')

Commands: [a]ccept, [r]eject, [e]dit, [s]kip
> a

✅ Fix applied successfully
```

#### 3. 自动修复

```bash
$ testmind heal test/login.test.ts --auto --use-llm

✅ Auto-applied (high confidence): Update selector to use ID
⏭️  Skipped (confidence too low): Add retry logic

✨ Self-healing complete!
```

---

## 编程API

### 完整示例

```typescript
import {
  LocatorEngine,
  FailureClassifier,
  FixSuggester,
  LLMService
} from '@testmind/core';

// 1. 初始化引擎
const llm = new LLMService();
const locator = new LocatorEngine();
const classifier = new FailureClassifier(llm);
const suggester = new FixSuggester(llm);

// 2. 分类失败
const failure = {
  testName: 'test name',
  testFile: 'test.ts',
  errorMessage: 'Element not found: .btn',
  stackTrace: 'stack...',
  timestamp: new Date(),
  selector: '.btn'
};

const classification = await classifier.classify(failure);
console.log('Failure type:', classification.failureType);
console.log('Is flaky:', classification.isFlaky);

// 3. 获取备选定位器
const alternatives = await locator.suggestAlternativeLocators({
  cssSelector: '.btn'
});

// 4. 生成修复建议
const context = {
  testCode: await readTestFile(failure.testFile),
  currentSelector: failure.selector,
  alternativeSelectors: alternatives,
  failureClassification: classification
};

const suggestions = await suggester.suggestFixes(failure, context);

// 5. 展示和应用修复
for (const suggestion of suggestions) {
  console.log(suggester.generateHumanReadableGuide(suggestion));
  
  // 如果用户接受...
  if (await getUserApproval()) {
    await applyFix(failure.testFile, suggestion.diff);
  }
}
```

---

## 最佳实践

### 1. 优先使用稳定的选择器

```typescript
// ❌ 不稳定
await page.click('.btn-primary');

// ✅ 稳定
await page.click('#submit-btn');

// ✅ 最佳（语义化）
await page.click('[data-testid="submit-button"]');
```

### 2. 启用失败历史追踪

```typescript
const failure = {
  // ... 基本信息
  previousRuns: recentTestRuns // 包含最近10次运行结果
};

// 这样可以检测 flaky tests
const result = await classifier.classify(failure);
if (result.isFlaky) {
  // 采取特殊处理
}
```

### 3. 人工审查所有修复

```bash
# ❌ 不推荐：完全自动化
testmind heal --auto

# ✅ 推荐：审查后再应用
testmind heal  # 交互式审查每个修复
```

### 4. 定期分析测试质量

```bash
# 分析所有测试的脆弱性
testmind analyze --all

# 找出最不稳定的测试
testmind analyze --flaky-rate
```

---

## 故障排查

### 问题：修复建议质量低

**原因**: LLM 未启用或 API key 缺失

**解决**:
```bash
export OPENAI_API_KEY=sk-your-key-here
testmind heal --use-llm
```

### 问题：无法找到元素

**原因**: 所有定位策略都失败

**解决**:
1. 检查元素是否实际存在
2. 添加更多定位策略（ID、data-testid）
3. 使用语义化的元素描述

### 问题：Flaky test 未被检测

**原因**: 测试历史不足（<3次运行）

**解决**:
```typescript
// 确保提供足够的历史数据
const failure = {
  // ...
  previousRuns: last10Runs // 至少3次
};
```

---

## 限制与路线图

### 当前限制（v0.4.0）

- ✅ 基于规则的分类（已完成）
- ✅ LLM增强分类（已完成）
- ⚠️ 视觉定位（原型阶段）
- ⚠️ 语义定位（原型阶段）
- ⚠️ 自动patch应用（手动阶段）

### 路线图

#### v0.5.0 (Month 3)
- 完整的视觉匹配实现
- 完整的语义匹配实现
- 自愈成功率 ≥80%

#### v0.8.0 (Month 6)
- 机器学习模型训练（从历史修复学习）
- 自动化patch应用
- CI/CD深度集成

#### v1.0 (Month 18)
- 生产级自愈引擎
- 跨框架支持（Cypress、Selenium）
- 企业级报告

---

## 参考

- [创建自定义失败模式](./custom-failure-patterns.md)
- [扩展定位策略](./custom-locator-strategies.md)
- [API完整文档](../api/self-healing.md)
- [案例研究](../case-studies/self-healing-success.md)

---

**反馈**: 如有问题或建议，请在 [GitHub Issues](https://github.com/yourusername/testmind/issues) 提出。










































