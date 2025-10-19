# Shannon测试手动验证指南

**目的：** 在Shannon实际环境中验证TestMind生成的测试  
**时间：** 约30-45分钟  
**前置条件：** Shannon项目已clone到本地

---

## 验证步骤

### Step 1: 准备Shannon环境

```bash
cd D:\AllAboutCursor\Shannon\Shannon-main\observability\dashboard

# 确保依赖已安装
pnpm install

# 确认vitest配置正确
cat vitest.config.ts
```

---

### Step 2: 验证format.test.ts

#### 2.1 复制测试文件

```bash
# 从TestMind复制修复后的测试
cp D:\AllAboutCursor\TestMind\shannon-validation-output\verified-tests\format.test.ts \
   lib/format.test.ts
```

#### 2.2 运行测试

```bash
pnpm test lib/format.test.ts --run
```

#### 2.3 预期结果

```
✓ formatTokensAbbrev (15 tests)
  ✓ Edge Cases and Invalid Inputs (4)
  ✓ Numbers without Abbreviation (2)
  ✓ Standard Abbreviation (7)
  ✓ tpsMode option (2)

Tests: 15 passed (15 total)
Time: ~20ms
```

#### 2.4 如果失败

**可能的问题：**

1. **小写'k'相关断言失败**
   - 错误示例：`Expected: "1.0k", Received: "1.0K"`
   - 修复：更新断言为实际输出

2. **逗号分隔符问题**
   - 错误示例：`Expected: "1000", Received: "1,000"`
   - 修复：添加逗号到期望值

3. **小数位数问题**
   - 错误示例：`Expected: "1M", Received: "1.0M"`
   - 修复：添加.0到期望值

**记录所有失败的测试**到验证表格

---

### Step 3: 验证debug.test.ts

#### 3.1 复制测试文件

```bash
cp D:\AllAboutCursor\TestMind\shannon-validation-output\verified-tests\debug.test.ts \
   lib/debug.test.ts
```

#### 3.2 运行测试

```bash
pnpm test lib/debug.test.ts --run
```

#### 3.3 预期结果

```
✓ debugLog (5 tests)
  ✓ when DEBUG_LOGS is true (default mock) (5)

Tests: 5 passed (5 total)
Time: ~15ms
```

#### 3.4 如果失败

**可能的问题：**

1. **Mock未生效**
   - 错误：`console.log was not called`
   - 原因：DEBUG_LOGS实际是false
   - 修复：检查Shannon的默认DEBUG_LOGS值

2. **环境变量问题**
   - 测试前设置：`NEXT_PUBLIC_DEBUG_LOGS=true pnpm test`

**记录失败原因**

---

### Step 4: 验证simClient.test.ts

#### 4.1 复制测试文件

```bash
cp D:\AllAboutCursor\TestMind\shannon-validation-output\verified-tests\simClient.test.ts \
   lib/simClient.test.ts
```

#### 4.2 运行测试

```bash
pnpm test lib/simClient.test.ts --run
```

#### 4.3 预期结果

```
✓ simClient (10 tests)
  ✓ isConnected (3)
  ✓ ensureConnected (3)
  ✓ postIntent (2)
  ✓ destroyConnection (4)

Tests: 10 passed (10 total)
Time: ~25ms
```

#### 4.4 如果失败

**可能的问题：**

1. **Worker API不可用**
   - 错误：`Worker is not defined`
   - 这是**预期的**（Node.js环境）
   - 解决：测试已处理此情况（检查null）

2. **类型错误**
   - 错误：`Type 'X' is not assignable to type 'Y'`
   - 修复：更新类型定义或导入

**记录所有问题**

---

### Step 5: 记录验证结果

创建验证表格：

| 测试文件 | 总测试数 | 通过 | 失败 | 通过率 | 需要修改 |
|---------|---------|------|------|--------|---------|
| format.test.ts | 15 | ? | ? | ?% | 是/否 |
| debug.test.ts | 5 | ? | ? | ?% | 是/否 |
| simClient.test.ts | 10 | ? | ? | ?% | 是/否 |
| **总计** | **30** | **?** | **?** | **?%** | |

---

## 验证后行动

### 如果100%通过 ✅

1. **标记为production-ready**
   ```bash
   cp lib/*.test.ts \
      D:\AllAboutCursor\TestMind\shannon-validation-output\production-ready\
   ```

2. **准备PR提交**
   - 使用pr-packages中的PR描述
   - 添加测试截图
   - 创建feature分支

3. **更新TestMind文档**
   - 在case study中记录100%通过率
   - 作为核心showcase

---

### 如果有失败 ❌

#### 分类失败类型

**Type A: 期望值错误**（最常见）
- 原因：TestMind假设与实际不符
- 修复：更新expect()语句
- 时间：5-10分钟/测试

**Type B: 逻辑错误**
- 原因：测试逻辑有问题
- 修复：重写测试case
- 时间：15-30分钟/测试

**Type C: 环境问题**
- 原因：依赖浏览器API等
- 修复：标记为integration test或skip
- 时间：10分钟/测试

#### 迭代修复流程

```
运行测试 
  ↓
记录失败
  ↓
分析原因
  ↓
修复测试
  ↓
再次运行
  ↓
重复直到100%通过
```

---

## 输出文档

### 验证报告

创建：`shannon-validation-output/TEST_EXECUTION_REPORT.md`

**包含：**

1. **执行摘要**
   - 总体通过率
   - 每个测试的状态
   - 主要发现

2. **详细结果**
   - 每个测试文件的输出
   - 失败的测试及原因
   - 修复建议

3. **修复日志**
   - 修复前测试数量
   - 修复后测试数量
   - 具体修改内容

4. **质量评估**
   - TestMind生成准确度
   - 需要人工修改的比例
   - 改进建议

---

## 成功标准

### 最低标准（PR提交）

- [ ] ≥2个测试文件100%通过
- [ ] 总通过率 ≥70%
- [ ] 所有import路径正确
- [ ] 所有语法错误修复

### 理想标准（showcase）

- [ ] 所有测试100%通过
- [ ] 覆盖率提升证据
- [ ] 截图展示测试通过
- [ ] 详细的验证报告

---

## 时间估算

| 步骤 | 预计时间 |
|------|---------|
| Step 1: 准备环境 | 5分钟 |
| Step 2: 验证format.test.ts | 10分钟 |
| Step 3: 验证debug.test.ts | 10分钟 |
| Step 4: 验证simClient.test.ts | 15分钟 |
| Step 5: 记录结果 | 10分钟 |
| **总计** | **50分钟** |

加上修复时间（如有失败）：1-2小时

---

## 验证清单

### 准备工作

- [ ] Shannon项目已clone
- [ ] 依赖已安装（pnpm install）
- [ ] vitest正常运行
- [ ] TestMind测试文件已就绪

### 验证过程

- [ ] format.test.ts复制到Shannon
- [ ] format.test.ts运行测试
- [ ] 记录format.test.ts结果
- [ ] debug.test.ts复制到Shannon
- [ ] debug.test.ts运行测试
- [ ] 记录debug.test.ts结果
- [ ] simClient.test.ts复制到Shannon
- [ ] simClient.test.ts运行测试
- [ ] 记录simClient.test.ts结果

### 后续工作

- [ ] 修复所有失败的测试
- [ ] 重新验证修复
- [ ] 创建验证报告
- [ ] 更新production-ready/目录
- [ ] 准备PR提交

---

## 故障排除

### 问题：pnpm命令不存在

```bash
# 安装pnpm
npm install -g pnpm
```

### 问题：测试运行无输出

```bash
# 使用verbose模式
pnpm test lib/format.test.ts --run --reporter=verbose
```

### 问题：类型错误

```bash
# 运行typecheck
pnpm typecheck

# 查看具体错误
tsc --noEmit
```

### 问题：Module not found

**检查：**
1. import路径是否正确
2. 文件扩展名（.ts vs .js）
3. Shannon的tsconfig.json配置

---

**准备好后开始验证！** 🚀




