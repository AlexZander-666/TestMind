# 🧠 TestMind (Lean Core)

TestMind 现在只保留核心能力：共享类型库 `@testmind/shared`、核心引擎 `@testmind/core`、以及 CLI `@testmind/cli`。非核心的仪表盘、示例、脚本、工具链与大体量文档已移除，仓库保持轻量、可直接安装与运行。

## 功能范围
- 上下文引擎：分析 TS/JS 代码并生成可供模型使用的上下文与依赖图。
- 单元测试生成（Vitest/Jest）：`testmind generate` 聚焦单函数单测草案。
- 自愈预览：`testmind heal` 接收测试报告，输出修复建议；自动应用仍在实验标记后面。

## 环境要求
- Node.js 20+，pnpm 8+
- OpenAI API Key（生成与自愈需要）

## 快速开始
```bash
pnpm install

# 生成构建产物
pnpm build

# 运行包内测试
pnpm test

# CLI 示例
pnpm --filter @testmind/cli testmind init
pnpm --filter @testmind/cli testmind generate src/utils/math.ts --function add
pnpm --filter @testmind/cli testmind heal --report vitest-report.json
```

## 质量检查
- `pnpm lint:types` 严格类型检查
- `pnpm lint` 代码规范
- `pnpm format:check` 保持格式一致
- LLM 调用现在带指数重试与缓存命中日志，生成失败会统一抛出 `LLMError`
- Diff 生成器使用 `diff` 库的 Myers 算法，报告更加稳定

## 目录结构
- `packages/backend/shared`：共享常量、类型、校验器
- `packages/backend/core`：上下文引擎与自愈能力
- `packages/frontend/cli`：CLI 入口

其余体积性内容（docs/examples/tools/scripts/CI 配置等）已删除，仅保留核心可运行代码。
