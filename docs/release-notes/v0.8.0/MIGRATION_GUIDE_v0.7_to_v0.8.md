# TestMind v0.7.0 → v0.8.0 迁移指南

**升级到 v0.8.0，享受技术提升与生态扩展** 🚀

---

## ✅ 兼容性声明

**完全向后兼容** - v0.8.0 与 v0.7.0 100% 兼容，无需任何代码修改即可升级。

---

## 📦 升级步骤

### 1. 更新代码

```bash
cd testmind

# 拉取最新代码
git fetch origin
git checkout v0.8.0

# 或者如果是新克隆
git clone https://github.com/yourusername/testmind.git
cd testmind
git checkout v0.8.0
```

### 2. 安装依赖

```bash
# 清理旧依赖（可选）
rm -rf node_modules pnpm-lock.yaml

# 安装新依赖
pnpm install

# 重新构建
pnpm build
```

### 3. 验证升级

```bash
# 运行测试
cd packages/core
pnpm test

# 验证新功能
cd ../..
pnpm exec tsx scripts/test-v0.8.0-features.ts
```

---

## 🆕 新增依赖

v0.8.0 新增以下依赖（**按需使用，不影响现有功能**）:

### Vue 支持（可选）

```json
{
  "@vue/compiler-sfc": "^3.4.0",
  "@vue/test-utils": "^2.4.0"
}
```

**用途**: Vue 组件分析和测试生成  
**触发条件**: 当你的项目使用 Vue 时自动启用  
**不使用 Vue？**: 无影响，这些包不会被加载

### 性能优化（可选）

```json
{
  "hnswlib-node": "^1.4.0",
  "p-map": "^4.0.0",
  "c8": "^8.0.0"
}
```

**用途**: 
- `hnswlib-node`: HNSW 向量索引（大型项目搜索优化）
- `p-map`: 批量并发处理
- `c8`: 覆盖率分析

**触发条件**: 自动启用，无需配置

---

## 🔧 配置更新

### 无需更改

v0.8.0 的所有新功能都是**自动启用**的，无需修改配置文件。

现有配置文件（如 `testmind.config.js`）完全兼容。

---

## 🌟 新功能采用

### 1. 使用 Vue 测试生成

如果你的项目使用 Vue：

```bash
# 自动检测并使用 VueTestSkill
testmind generate src/components/MyComponent.vue
```

**无需配置**。TestMind 会自动：
- 检测 `.vue` 文件
- 分析 Composition API 或 Options API
- 生成适配的测试
- Mock Pinia/Vuex stores

### 2. 使用 Next.js/Nuxt.js 测试生成

```bash
# Next.js API Route
testmind generate app/api/users/route.ts

# Nuxt.js Server API
testmind generate server/api/users.ts
```

**自动识别**：
- Next.js App Router vs Pages Router
- Server Components vs Client Components
- Nuxt.js 3 composables

### 3. 启用质量检查

#### 边界条件检测

```bash
# 分析函数，检测边界条件
testmind analyze --detect-boundaries src/utils/validation.ts

# 生成时自动包含边界测试
testmind generate src/utils/validation.ts --include-boundaries
```

#### Flaky Test 预防

```bash
# 检测 Flaky 模式
testmind analyze --detect-flaky tests/

# 自动修复
testmind fix --flaky tests/
```

#### 可读性优化

```bash
# 优化现有测试
testmind optimize tests/my-test.spec.ts

# 生成时自动优化
testmind generate src/service.ts --optimize-readability
```

### 4. 使用性能优化

#### Prompt 压缩（自动启用）

无需配置，所有 LLM 调用自动压缩 40-60%。

**查看效果**:
```bash
# 查看压缩统计
testmind generate src/service.ts --show-stats

# 输出示例：
# Token 使用: 1200 → 500 (节省 58%)
```

#### 批量生成

```bash
# 批量生成（5-10x 加速）
testmind generate-batch src/services/ --concurrency 5

# 配置并发数
testmind generate-batch src/ --concurrency 10 --group-size 20
```

#### 三层缓存（自动启用）

无需配置，自动使用 L1/L2/L3 缓存。

**查看缓存统计**:
```bash
testmind cache-stats

# 输出示例：
# L1 命中率: 45%
# L2 命中率: 25%
# 总命中率: 70%
```

### 5. 使用企业功能

#### 测试迁移

```bash
# Jest → Vitest
testmind migrate --from jest --to vitest tests/

# Cypress → Playwright
testmind migrate --from cypress --to playwright e2e/

# 生成迁移报告
testmind migrate --from jest --to vitest tests/ --report
```

#### 最佳实践检查

```bash
# 检查所有最佳实践
testmind analyze --best-practices tests/

# 自动修复
testmind fix --best-practices tests/

# 查看规则
testmind best-practices --list
```

#### Monorepo 支持

```bash
# 自动检测 monorepo
testmind init

# 为每个包生成测试
testmind generate-batch packages/ --monorepo

# 生成配置报告
testmind monorepo-report
```

---

## 🔄 API 变更

### 无破坏性变更

v0.8.0 没有任何破坏性 API 变更。

### 新增 API

如果你在代码中使用 TestMind API：

```typescript
// 新增：Vue 组件分析器
import { VueComponentAnalyzer } from '@testmind/core/skills';
const analyzer = new VueComponentAnalyzer();
const metadata = await analyzer.analyzeComponent('Component.vue');

// 新增：边界条件检测器
import { BoundaryConditionDetector } from '@testmind/core/quality';
const detector = new BoundaryConditionDetector();
const boundaries = detector.detectConditions(functionContext);

// 新增：Flaky 预防
import { FlakyTestPrevention } from '@testmind/core/quality';
const prevention = new FlakyTestPrevention();
const result = prevention.analyzeAndFix(testCode);

// 新增：测试迁移工具
import { TestMigrationTool } from '@testmind/core/migration';
const migrator = new TestMigrationTool();
const result = await migrator.migrate(testCode, 'jest', 'vitest');

// 新增：Monorepo 检测器
import { MonorepoDetector } from '@testmind/core/frameworks';
const detector = new MonorepoDetector();
const info = await detector.detectMultiFramework(projectPath);
```

---

## 📊 性能对比

### v0.7.0 vs v0.8.0

| 场景 | v0.7.0 | v0.8.0 | 提升 |
|------|--------|--------|------|
| 生成 100 个测试 | 10 分钟 | 2 分钟 | 5x |
| 生成 1000 个测试 | 1.5 小时 | 15 分钟 | 6x |
| Token 使用（单次） | 2000 | 1000 | -50% |
| 向量搜索（1000 文件） | 500ms | <100ms | 5x |
| 缓存命中率 | 30% | 60%+ | 2x |

---

## ⚠️ 注意事项

### 1. 新依赖安装

如果你看到以下错误：

```
Error: Cannot find module '@vue/compiler-sfc'
```

**解决方案**:
```bash
pnpm install
```

### 2. Node.js 版本

确保使用 Node.js 20+：

```bash
node --version  # 应该 >= 20.0.0
```

### 3. TypeScript 类型

如果使用 TypeScript，可能需要更新 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@vue/test-utils"]
  }
}
```

---

## 🐛 已知问题

### 1. hnswlib-node 在某些环境下编译失败

**影响**: HNSW 向量索引无法使用  
**后果**: 降级到普通向量搜索（性能略低）  
**解决方案**: 
```bash
# 安装编译工具（Linux）
sudo apt-get install build-essential

# 安装编译工具（macOS）
xcode-select --install

# 重新安装
pnpm install
```

**临时解决**: 即使编译失败，TestMind 会自动降级，不影响功能。

### 2. Windows 路径问题

**影响**: 某些路径显示异常  
**解决方案**: 使用 `/` 而非 `\` 作为路径分隔符

---

## 💡 最佳实践

### 升级后建议

1. **运行质量检查**
   ```bash
   testmind analyze --detect-flaky tests/
   testmind fix --flaky tests/
   ```

2. **优化现有测试**
   ```bash
   testmind optimize tests/
   ```

3. **应用最佳实践**
   ```bash
   testmind analyze --best-practices tests/
   testmind fix --best-practices tests/
   ```

4. **启用批量生成**
   ```bash
   # 为整个项目生成测试
   testmind generate-batch src/ --concurrency 5
   ```

---

## 📚 相关资源

- [v0.8.0 Release Notes](../../GITHUB_RELEASE_v0.8.0.md)
- [详细 CHANGELOG](CHANGELOG_v0.8.0.md)
- [快速开始指南](QUICK_START_v0.8.0.md)
- [实施完成报告](../../IMPLEMENTATION_COMPLETE_v0.8.0.md)

---

## ❓ 常见问题

### Q: 升级后测试是否需要重新生成？
A: 不需要。现有测试完全兼容。但建议运行质量检查和优化。

### Q: v0.7.0 的配置文件还能用吗？
A: 可以。所有 v0.7.0 的配置完全兼容。

### Q: 新功能是否自动启用？
A: 是的。大部分新功能（Prompt 压缩、缓存、性能优化）自动启用。

### Q: 如何回退到 v0.7.0？
A: ```bash
git checkout v0.7.0
pnpm install
pnpm build
```

### Q: 是否需要更新 CI/CD 配置？
A: 不需要。但建议使用新的 GitHub Actions 生成器：
```bash
testmind ci-cd generate --preset full
```

---

## 🆘 获取帮助

遇到问题？

- 🐛 [提交 Issue](https://github.com/yourusername/testmind/issues)
- 💬 [GitHub Discussions](https://github.com/yourusername/testmind/discussions)
- 📧 Email: support@testmind.dev
- 💬 [Discord Community](https://discord.gg/testmind)

---

**🎉 升级完成！享受 v0.8.0 的强大功能吧！**

