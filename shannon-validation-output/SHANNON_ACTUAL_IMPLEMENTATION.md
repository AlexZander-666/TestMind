# Shannon实际实现分析

**分析时间：** 2025-10-19  
**分析范围：** lib/format.ts, lib/debug.ts, lib/simClient.ts  
**目的：** 验证TestMind生成的测试假设是否正确

---

## 1. format.ts 分析

### 函数签名

```typescript
export function formatTokensAbbrev(
  n?: number | null, 
  opts?: FormatAbbrevOptions
): string
```

### 参数类型

```typescript
export type FormatAbbrevOptions = {
  tpsMode?: boolean;               // 显示小数（<1000时）
  extraDecimalUnder100?: boolean;  // <100时显示2位小数
};
```

### 实际行为

#### 1. Edge Cases处理

| 输入 | 实际输出 | TestMind假设 | 匹配度 |
|------|---------|-------------|--------|
| `null` | `"0"` | `"0"` | ✅ 正确 |
| `undefined` | `"0"` | `"0"` | ✅ 正确 |
| `0` | `"0"` | `"0"` | ✅ 正确 |
| `-12345` | `"-12.3k"` | `"0"` | ❌ 错误 |

**关键发现：** 负数会保留符号并格式化，不是返回"0"

```typescript
// 实际实现（第10-11行）
const sign = num < 0 ? '-' : '';
const v = Math.abs(num);
// 返回: sign + formatted(v)
// 例如：-12345 → "-" + "12.3k" = "-12.3k"
```

#### 2. 数值范围处理

| 输入 | 实际输出 | TestMind假设 | 匹配度 |
|------|---------|-------------|--------|
| `1` | `"1"` | `"1"` | ✅ 正确 |
| `123` | `"123"` | `"123"` | ✅ 正确 |
| `999` | `"999"` | `"999"` | ✅ 正确 |
| `123.4` | `"123"` | `"123"` | ✅ 正确 |
| `123.5` | `"124"` | `"124"` | ✅ 正确 |
| `999.9` | `"1,000"` | `"1000"` | ❌ 有逗号 |

**关键发现：** <1000使用Intl.NumberFormat，会添加千位分隔符

```typescript
// 第13行
const fmtInt = (x: number) => new Intl.NumberFormat('en-US', { 
  maximumFractionDigits: 0 
}).format(x);
// 结果：1000 → "1,000" （带逗号）
```

#### 3. 缩写处理

| 输入 | 实际输出 | TestMind假设 | 匹配度 |
|------|---------|-------------|--------|
| `1000` | `"1.0k"` | `"1K"` | ❌ **小写k** |
| `1500` | `"1.5k"` | `"1.5K"` | ❌ **小写k** |
| `1_000_000` | `"1.0M"` | `"1M"` | ⚠️ 多.0 |
| `1_500_000` | `"1.5M"` | `"1.5M"` | ✅ 正确 |
| `1_000_000_000` | `"1.0B"` | `"1B"` | ⚠️ 多.0 |
| `2_500_000_000` | `"2.5B"` | `"2.5B"` | ✅ 正确 |
| `1_000_000_000_000` | `"1.0T"` | `"1T"` | ⚠️ 多.0 |

**关键发现：**

1. **千位使用小写'k'，其他大写**
   ```typescript
   // 第23-28行
   const units: Array<[number, string]> = [
     [1_000_000_000_000, 'T'],  // 大写
     [1_000_000_000, 'B'],      // 大写
     [1_000_000, 'M'],          // 大写
     [1_000, 'k'],              // 小写！
   ];
   ```

2. **总是显示1位小数**
   ```typescript
   // 第32行
   const s = val.toFixed(1); // 例如：1.0k, 25.0k
   ```

#### 4. Options处理

**tpsMode测试：**

| 输入 | 实际输出 | TestMind假设 | 匹配度 |
|------|---------|-------------|--------|
| `123, { tpsMode: true }` | `"123.0"` | `"123.0"` | ✅ 正确 |
| `99.99, { tpsMode: true, extraDecimalUnder100: true }` | `"100.00"` | `"100.00"` | ✅ 正确（四舍五入）|

### TestMind测试准确度

| 类别 | 总测试数 | 正确 | 错误 | 准确率 |
|------|---------|------|------|--------|
| Edge cases | 4 | 3 | 1 | 75% |
| <1000处理 | 5 | 4 | 1 | 80% |
| 缩写(K/M/B/T) | 20+ | ~10 | ~10 | ~50% |
| **总计** | **~30** | **~17** | **~13** | **~57%** |

**主要错误：**
1. 小写'k'（影响所有K测试）
2. 总是有.0（整数缩写）
3. 负数处理
4. 千位分隔符

---

## 2. debug.ts 分析

### 函数签名

```typescript
export function debugLog(tag: string, ...args: unknown[]): void
```

### 依赖

```typescript
import { DEBUG_LOGS } from './config';
// 注意：不是config.debug，是DEBUG_LOGS常量
```

### 实际行为

```typescript
export function debugLog(tag: string, ...args: unknown[]) {
  if (!DEBUG_LOGS) return;           // 检查DEBUG_LOGS常量
  console.log(`[${tag}]`, ...args);  // 输出到console.log
}
```

### DEBUG_LOGS定义

**文件：** `lib/config.ts`（第15行）

```typescript
export const DEBUG_LOGS = (
  (process.env.NEXT_PUBLIC_DEBUG_LOGS as string) ?? 'true'
) === 'true';
```

**特点：**
- 从环境变量读取
- 默认值：`'true'`
- 是**常量**，不可在运行时修改

### TestMind测试问题

| 问题 | TestMind假设 | 实际实现 | 影响 |
|------|-------------|---------|------|
| **依赖名称** | `config.debug` | `DEBUG_LOGS` | ❌ Mock失败 |
| **依赖类型** | 对象属性 | 常量 | ❌ 无法动态修改 |
| **Import** | `import { config }` | `import { DEBUG_LOGS }` | ❌ 导入错误 |
| **修改方式** | `config.debug = true` | 无法修改（常量） | ❌ 测试失败 |

### 正确的测试策略

**方案A：Mock整个config模块**

```typescript
// ✅ 正确
vi.mock('./config', () => ({
  DEBUG_LOGS: true,
}));
```

**方案B：测试当DEBUG_LOGS=true时的行为**（更简单）

```typescript
// 假设生产环境DEBUG_LOGS默认=true
describe('debugLog', () => {
  it('should log with tag format', () => {
    const spy = vi.spyOn(console, 'log');
    debugLog('TEST', 'message');
    
    // 如果DEBUG_LOGS=true，会被调用
    expect(spy).toHaveBeenCalledWith('[TEST]', 'message');
  });
});
```

**方案C：文档说明限制**

```markdown
## Note on Testing debugLog

The `debugLog` function depends on the `DEBUG_LOGS` constant from `./config`.
This constant is set at module load time from environment variable `NEXT_PUBLIC_DEBUG_LOGS`.

Since it's a constant (not mutable), testing both true/false scenarios requires:
1. Mocking the entire `./config` module, OR
2. Setting environment variables before import

Our tests assume DEBUG_LOGS=true (default in Shannon).
```

### TestMind测试准确度

| 测试假设 | 正确性 | 问题 |
|---------|--------|------|
| 函数签名 | ✅ 正确 | 无 |
| 参数处理 | ✅ 正确 | 无 |
| console.log | ✅ 正确 | 无 |
| 依赖名称 | ❌ 错误 | config.debug vs DEBUG_LOGS |
| Mock策略 | ❌ 错误 | 无法动态修改常量 |

**准确率：** 60%（3/5项正确）

---

## 3. simClient.ts 分析

### 全局状态

```typescript
let _bridge: SimBridge | null = null;
let _worker: Worker | null = null;
let _link: { destroy: () => void } | null = null;
```

**重要：** 所有函数都操作这些全局变量

---

### 3.1 isConnected()

#### 函数签名

```typescript
export function isConnected(): boolean
```

#### 实际实现

```typescript
export function isConnected() {
  return !!_bridge;  // 转换为boolean
}
```

#### 行为

- **无参数**
- **返回：** `boolean`
- **初始状态：** `false` （_bridge = null）
- **连接后：** `true` （_bridge !== null）

#### TestMind测试准确度

| 测试假设 | 实际行为 | 匹配度 |
|---------|---------|--------|
| 无参数 | ✅ 无参数 | ✅ 正确 |
| 返回boolean | ✅ boolean | ✅ 正确 |
| 默认true | ❌ 默认false | ❌ 错误 |

**准确率：** 67%（2/3正确）

**需要修正：**
```typescript
- expect(result).toBe(true);
+ expect(result).toBe(false);  // 初始状态未连接
```

---

### 3.2 ensureConnected()

#### 函数签名

```typescript
export function ensureConnected(): SimBridge | null
```

#### 实际实现

```typescript
export function ensureConnected() {
  // 1. 如果已连接，返回现有bridge
  if (_bridge) return _bridge;
  
  // 2. 检查环境（浏览器 + Worker支持）
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  
  // 3. 创建Worker和Bridge
  try {
    _worker = new Worker(new URL('../workers/engine.ts', import.meta.url), { 
      type: 'module' 
    });
    
    // 4. 设置监听器
    _worker.addEventListener('error', ...);
    _worker.addEventListener('message', ...);
    
    // 5. 创建bridge并关联
    _bridge = createSimBridge(_worker);
    _link = attachBridgeToStore(_bridge, appStore);
    
    // 6. 初始化握手
    _bridge.postIntent({ type: 'request_snapshot' });
    
    return _bridge;
  } catch (e) {
    debugLog('simClient', 'ensureConnected-failed', e);
    return null;  // ❌ 注意：返回null，不throw错误
  }
}
```

#### 关键特征

- **参数：** **0个** - 无参数！
- **返回：** `SimBridge | null` - 不是void
- **副作用：** 修改`_bridge`, `_worker`, `_link`全局变量
- **错误处理：** **返回null** - 不throw错误
- **环境依赖：** 需要浏览器环境（window, Worker）

#### TestMind测试问题对比

| 方面 | TestMind假设 | 实际实现 | 差异度 |
|------|-------------|---------|--------|
| **参数** | `MockClientState`对象 | **无参数** | 🔴 100%错误 |
| **错误处理** | throw多种错误消息 | **返回null** | 🔴 100%错误 |
| **状态检查** | 接受state参数 | **访问全局_bridge** | 🔴 100%错误 |
| **测试类型** | Unit test | **需要Integration** | 🔴 不适用 |

**TestMind测试准确度：** 0%（完全错误）

**Issue #3的根本原因：**
```
LLM看到函数名"ensureConnected"
  ↓
推测：应该确保某个client已连接
  ↓
假设：接受client state作为参数
  ↓
生成：基于假设的测试（与实际完全不符）
```

---

### 3.3 postIntent()

#### 函数签名

```typescript
export function postIntent(
  intent: Parameters<SimBridge['postIntent']>[0]
): void
```

**展开：**
```typescript
intent: {
  type: 'request_snapshot' | 'pause' | 'resume' | 'step' | ...;
  // 其他可能的字段
}
```

#### 实际实现

```typescript
export function postIntent(intent: Parameters<SimBridge['postIntent']>[0]) {
  if (!_bridge) ensureConnected();  // 自动连接
  _bridge?.postIntent(intent);      // 调用bridge方法
}
```

#### 行为

- **参数：** 1个（intent对象）
- **返回：** `void`
- **副作用：** 
  - 如果未连接，调用`ensureConnected()`
  - 调用`_bridge.postIntent()`
- **可选链：** 使用`?.`，如果bridge为null不会crash

#### TestMind为什么未生成

**日志显示：**
```
[TestGenerator] No test cases found for postIntent
```

**可能原因：**
1. LLM生成的测试太简单（<10行）
2. 或缺少test cases
3. 或缺少expect断言

**质量验证标准：**
```typescript
// packages/core/src/generation/TestGenerator.ts:176-200
private validateGeneratedTest(code: string, functionName: string): boolean {
  // Check 1: 必须有test case
  const hasTestCase = code.includes('it(') || code.includes('test(');
  
  // Check 2: 必须有断言
  const hasAssertions = code.includes('expect(');
  
  // Check 3: 至少10行
  const lines = code.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 10) return false;
  
  return hasTestCase && hasAssertions;
}
```

**推测：** LLM可能生成了类似：

```typescript
it('should post intent', () => {
  postIntent({ type: 'pause' });
  // 没有断言！
});
```

被质量检查拦截。

---

### 3.4 destroyConnection()

#### 函数签名

```typescript
export function destroyConnection(): void
```

#### 实际实现

```typescript
export function destroyConnection() {
  _link?.destroy();                    // 销毁链接
  try { _worker?.terminate(); } catch {}  // 终止worker（忽略错误）
  _link = null; _bridge = null; _worker = null;  // 清空状态
}
```

#### 行为

- **参数：** 0个
- **返回：** `void` (undefined)
- **副作用：** 清空所有全局状态
- **错误处理：** worker.terminate()错误被捕获和忽略

#### TestMind测试准确度

| 测试假设 | 实际行为 | 匹配度 |
|---------|---------|--------|
| 无参数 | ✅ 无参数 | ✅ 正确 |
| 返回undefined | ✅ void | ✅ 正确 |
| 不throw错误 | ✅ 不throw | ✅ 正确 |

**准确率：** 100%（3/3正确）

**但测试不够全面：**
- ❌ 未测试是否清空状态
- ❌ 未测试与isConnected()的关系
- ❌ 未测试幂等性

---

## 问题总结

### 按严重程度分类

#### 🔴 Critical（阻塞PR）

1. **format.test.ts - 小写'k'错误**
   - 影响：7/11测试失败（64%）
   - 修复难度：Low
   - 修复时间：10分钟

2. **debug.test.ts - 完全错误的Mock**
   - 影响：9/9测试全失败（100%）
   - 修复难度：Medium
   - 修复时间：30分钟

3. **ensureConnected.test.ts - 完全错误的假设**
   - 影响：测试无效（100%）
   - 修复难度：High
   - 修复时间：1小时

4. **所有import路径错误**
   - 影响：所有测试无法运行
   - 修复难度：Low
   - 修复时间：5分钟

#### 🟡 Major（影响质量）

5. **isConnected.test.ts - 错误期望值**
   - 影响：1/1测试失败
   - 修复难度：Low
   - 修复时间：2分钟

6. **destroyConnection.test.ts - 测试不足**
   - 影响：覆盖不全
   - 修复难度：Medium
   - 修复时间：20分钟

7. **postIntent缺失**
   - 影响：少1个测试
   - 修复难度：Low
   - 修复时间：15分钟

---

## 修复后预期质量

| 测试文件 | 修复前可用性 | 修复后预期 | 改进 |
|---------|------------|-----------|------|
| format.test.ts | 0% (import+大小写错误) | 95% | +95% |
| debug.test.ts | 0% (Mock错误) | 90% | +90% |
| simClient.test.ts | 0% (全部重写) | 95% | +95% |

**总体改进：** 0% → 93%平均可用性

---

## 对标1.md要求的缺口分析

### 1.md 4.1节MVP要求 vs 当前状态

| MVP要求 | 理想状态（1.md） | 当前实现 | Shannon验证状态 | 缺口 |
|---------|----------------|---------|----------------|------|
| **CLI界面** | 交互式终端聊天 | ✅ 已实现 | ❌ 未演示 | 缺少交互演示 |
| **项目初始化** | `archon init` | ✅ `testmind init` | ✅ 成功索引 | 无 |
| **上下文管理** | `/add /context命令` | ⏳ 待实现 | N/A | MVP缺失 |
| **重构提示** | 自然语言重构 | ⏳ 待实现 | N/A | MVP缺失 |
| **基于Diff的变更** | Diff审查+accept/reject | ✅ 已实现 | ❌ 未演示 | **关键缺失** |
| **Git集成** | 自动commit到新分支 | ✅ 已实现 | ❌ 未实际使用 | **关键缺失** |
| **撤销功能** | `/undo`命令 | ⏳ 待实现 | N/A | MVP缺失 |

**核心问题：** 
- Diff-First和Git自动化虽然实现了，但**未在Shannon验证中展示**
- Shannon验证使用脚本化生成，**跳过了核心差异化功能**
- 无法证明"Diff-First模型建立信任"的价值主张

---

### 1.md 3.2节核心差异化 vs 验证结果

| 差异化声称（1.md） | 实现状态 | Shannon验证 | 证明程度 |
|-------------------|---------|------------|---------|
| **深度上下文 + 用户控制** | 自动上下文✅ 用户控制⏳ | 自动上下文✅ | 50% |
| **可验证与可审计** | Diff-First✅ | 未演示❌ | 0% |
| **可扩展技能框架** | 设计中⏳ | N/A | 0% |

**核心问题：** 无法证明与Copilot/Aider的差异化

**1.md表2对比表无法填写：**
```markdown
| 信任模型 | "Diff-First"可验证变更 | ??? |
```

目前**没有任何证据**证明Diff-First在Shannon中起作用。

---

## 关键洞察

### 1. 测试质量实际评估

**之前的评估（基于语法）：**
- V2成功率：67% (4/6)
- vitest语法：100%

**实际评估（基于可运行性）：**
- 可直接运行：0% (0/5)
- 修复后可运行：60% (3/5)
- 需要重写：40% (2/5)

**真实成功率：** 0% → 需要大量修复

### 2. 脚本化生成 vs Diff-First的价值

**当前Shannon验证：**
```
脚本运行 → 自动生成 → 自动保存 → 完全未审查
```

**结果：**
- ❌ ensureConnected完全错误（假设了不存在的API）
- ❌ debug mock错误（config.debug vs DEBUG_LOGS）
- ❌ format大小写错误（'K' vs 'k'）
- ❌ 所有import路径错误

**如果使用了Diff-First：**
```
生成测试 → 展示Diff → 用户看到错误 → Reject → 提供反馈 → 重新生成
```

**用户会发现：**
- "ensureConnected(mockState) - 等等，我看源码没有参数啊"
- "import from '../../lib' - 路径不对，应该是'./'"
- "expect 'K' - 我记得Shannon用小写'k'"

**结论：** Diff-First不是可选的，是**必须的质量把关**

### 3. Issue #3的根本原因

**不是Prompt的问题，是流程的问题：**

```
当前流程：
LLM生成（基于不完整信息） → 直接保存 → 结束

正确流程（1.md）：
LLM生成 → Diff审查 → 用户发现问题 → 提供反馈 → LLM重新生成
```

**Prompt约束的局限：**
- ✅ 可以约束语法（vitest vs jest）
- ✅ 可以约束格式（AAA模式）
- ❌ 无法阻止基于函数名的"合理猜测"
- ❌ 无法替代人类对源码的理解

**Solution：** 必须有人工审查环节

---

## 修复优先级（更新）

### P0 - 阻塞发布（已部分完成）

- [x] 创建诊断报告
- [x] 分析Shannon源码
- [x] 创建修复后的format.test.ts
- [x] 创建修复后的debug.test.ts
- [x] 创建修复后的simClient.test.ts（合并所有simClient测试）
- [ ] 在Shannon中实际运行测试
- [ ] 创建测试执行报告
- [ ] 修正任何运行时错误

### P1 - Diff-First演示（关键）

- [ ] 使用CLI交互模式生成1个测试
- [ ] 录制Diff审查过程（截图）
- [ ] 展示用户发现问题 → Reject → 重新生成
- [ ] 创建DIFF_FIRST_DEMO.md

### P2 - Shannon PR

- [ ] 提交format.test.ts PR
- [ ] 提交debug.test.ts PR（或simClient.test.ts）
- [ ] 收集反馈

---

## 下一步立即执行

1. **在Shannon中验证测试**（30分钟）
2. **创建测试执行报告**（15分钟）
3. **修正任何失败**（30分钟）
4. **创建Diff-First演示**（1小时）

**今日目标：** 完成测试验证和Diff-First演示





