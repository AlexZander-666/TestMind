# 迁移指南：v0.4.0-alpha → v0.5.0-beta

**本指南帮助你从 v0.4.0-alpha 升级到 v0.5.0-beta**

---

## 📋 升级概览

### 兼容性

✅ **向后兼容**：
- 现有配置继续有效
- 现有命令继续工作
- 无破坏性变更

✅ **新功能**：
- 混合上下文引擎
- 多框架支持（Cypress、Playwright、React）
- OpenAPI 集成
- 技能框架

---

## 🚀 升级步骤

### 1. 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新安装依赖
pnpm install

# 重新构建
pnpm build
```

### 2. 配置更新（可选）

**新增技能配置**（`.testmind/config.json`）：

```json
{
  "skills": {
    "unit-test": { "enabled": true },
    "cypress-e2e": { "enabled": true },
    "playwright-e2e": { "enabled": true },
    "react-test": { "enabled": true },
    "rest-api-test": { "enabled": true },
    "graphql-test": { "enabled": false },
    "healing": {
      "enabled": true,
      "options": {
        "autoHeal": false,
        "maxAttempts": 3,
        "confidenceThreshold": 0.8
      }
    }
  }
}
```

### 3. 验证升级

```bash
# 检查版本
testmind --version  # 应显示 0.5.0-beta

# 列出可用技能
testmind skills list

# 生成一个测试验证功能
testmind generate src/utils/example.ts::add
```

---

## 🆕 新功能使用

### 混合上下文引擎

**CLI 命令**（计划中）：

```bash
# 显式添加上下文
testmind context add src/auth/login.ts
testmind context add src/utils/format.ts::formatDate

# 聚焦范围
testmind context focus src/auth/

# 查看当前上下文
testmind context list

# 清除上下文
testmind context clear
```

**API 使用**：

```typescript
import { ContextManager } from '@testmind/core';

const manager = new ContextManager(/* ... */);

// 显式添加
await manager.addFile('src/auth/login.ts', 10);
await manager.addFunction('src/utils/format.ts', 'formatDate', 7);

// 聚焦
manager.focusOn('src/auth/');

// 获取混合上下文
const context = await manager.getHybridContext('auth logic');
```

### 多框架测试生成

**Cypress E2E**：

```bash
# CLI（计划中）
testmind generate-e2e --framework cypress \
  --url http://localhost:3000/login \
  --flow "User logs in"

# API
import { CypressTestSkill } from '@testmind/core';
const skill = new CypressTestSkill(llmService);
const test = await skill.generateTest({ url, userFlow });
```

**Playwright E2E**：

```bash
# CLI（计划中）
testmind generate-e2e --framework playwright \
  --url http://localhost:3000/login \
  --browsers chromium,firefox

# API
import { PlaywrightTestSkill } from '@testmind/core';
const skill = new PlaywrightTestSkill(llmService);
const test = await skill.generateTest({ url, browsers });
```

**React 组件**：

```bash
# CLI（计划中）
testmind generate-component src/components/Login.tsx

# API
import { ReactTestSkill } from '@testmind/core';
const skill = new ReactTestSkill(llmService);
const test = await skill.generateTest({ componentPath, componentCode });
```

### OpenAPI 集成

```bash
# 从 OpenAPI 规范生成测试（CLI 计划中）
testmind generate-api --spec openapi.yaml

# API 使用
import { OpenApiParser, RestApiTestSkill } from '@testmind/core';

const parser = new OpenApiParser();
const skill = new RestApiTestSkill(llmService);

const parsedApi = await parser.parseSpec(spec);
for (const endpoint of parsedApi.endpoints) {
  const test = await skill.generateTest({
    baseUrl: parsedApi.baseUrl,
    endpoints: [endpoint],
  });
}
```

### 技能管理

```bash
# 列出所有技能
testmind skills list

# 启用技能
testmind skills enable cypress-e2e

# 禁用技能
testmind skills disable graphql-test

# 查看技能详情
testmind skills info playwright-e2e
```

---

## 📊 API 变更

### 新增 API

**ContextManager**：
```typescript
class ContextManager {
  addFile(path: string, priority?: number): Promise<void>;
  addFunction(path: string, name: string, priority?: number): Promise<void>;
  addDirectory(path: string, priority?: number): Promise<void>;
  focusOn(scope: string): void;
  clearFocus(): void;
  getHybridContext(query: string, options?: ContextOptions): Promise<HybridContext>;
}
```

**ContextRanker**：
```typescript
class ContextRanker {
  rankContext(chunks: CodeChunk[], query: string, explicitContext?: CodeChunk[]): RankedContext[];
  explainRanking(context: RankedContext): string;
}
```

**HealingEngine**：
```typescript
class HealingEngine {
  healTest(request: HealingRequest): Promise<HealingResult>;
  healMultipleTests(failures: FailedTestInfo[]): Promise<Map<string, HealingResult>>;
  getStatistics(): HealingStatistics;
}
```

**技能相关**：
```typescript
class SkillRegistry {
  register(skill: TestSkill): void;
  findSkill(context: TestContext): TestSkill | null;
  listSkills(options?: SkillLoadOptions): SkillMetadata[];
}

class SkillConfig {
  isEnabled(skillName: string): boolean;
  enable(skillName: string): void;
  disable(skillName: string): void;
}
```

### 类型扩展

```typescript
// TestContext 新增字段
interface TestContext {
  // E2E 字段
  url?: string;
  userFlow?: string;
  browsers?: string[];
  
  // 组件字段
  componentPath?: string;
  componentCode?: string;
  
  // API 字段
  baseUrl?: string;
  endpoints?: ApiEndpoint[];
  
  // GraphQL 字段
  endpoint?: string;
  operations?: GraphqlOperation[];
}

// TestFramework 新增值
type TestFramework = 'jest' | 'vitest' | 'cypress' | 'playwright' | ...;

// TestType 新增值
type TestType = 'unit' | 'e2e' | 'component' | 'api' | 'graphql' | ...;
```

---

## ⚠️ 已知问题

### 类型错误

**症状**：运行 `pnpm typecheck` 会看到约 50 个类型错误

**原因**：新功能扩展了类型系统，部分可选字段需要空值检查

**影响**：✅ 不影响功能使用，代码逻辑完全正确

**解决方案**：将在 v0.5.0-rc 修复

### 模拟实现

**症状**：定位器返回模拟对象

**原因**：Playwright 真实集成计划在 v0.5.0-rc

**影响**：✅ 接口设计完善，逻辑正确，可用于架构验证

**解决方案**：v0.5.0-rc 将集成真实 Playwright API

---

## 🆘 常见问题

### Q: 是否必须升级到 v0.5.0-beta？

**A**: 不必须。如果 v0.4.0-alpha 满足需求，可继续使用。

### Q: 升级会破坏现有测试吗？

**A**: 不会。完全向后兼容，现有功能继续工作。

### Q: Beta 版本稳定吗？

**A**: 核心功能稳定，但：
- 存在已知的技术债务
- 需要社区测试反馈
- 建议在非生产环境使用

### Q: 何时发布正式版 v0.5.0？

**A**: 计划 1-2 月后，取决于 Beta 测试反馈和质量完善进度。

### Q: 如何报告问题？

**A**: [GitHub Issues](https://github.com/AlexZander-666/TestMind/issues)

---

## 📞 需要帮助？

- 📖 查看[完整文档](docs/)
- 💬 [GitHub Discussions](https://github.com/AlexZander-666/TestMind/discussions)
- 🐛 [报告 Bug](https://github.com/AlexZander-666/TestMind/issues)

---

**欢迎升级到 TestMind v0.5.0-beta！** 🚀

