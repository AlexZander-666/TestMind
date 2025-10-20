# TestMind 项目结构

**版本**: v0.4.0-alpha  
**更新日期**: 2025-10-21

---

## 📂 根目录文件说明

### 核心用户文档

| 文件 | 用途 | 读者 |
|------|------|------|
| **README.md** | 项目介绍，快速开始 | 所有用户 |
| **ROADMAP.md** | 18个月产品规划 | 用户+贡献者 |
| **CHANGELOG.md** | 版本历史和变更 | 所有用户 |
| **CONTRIBUTING.md** | 贡献指南 | 贡献者 |
| **ARCHITECTURE.md** | 技术架构文档 | 开发者 |
| **TESTING_GUIDE.md** | 测试使用指南 | 用户 |
| **DOCS.md** | 中文文档索引 | 中文用户 |
| **LICENSE** | MIT开源协议 | 所有用户 |

### 配置文件

| 文件 | 用途 |
|------|------|
| **package.json** | 项目配置和脚本 |
| **pnpm-workspace.yaml** | Monorepo工作区配置 |
| **tsconfig.json** | TypeScript配置 |
| **env.example** | 环境变量示例 |

---

## 📁 目录结构

```
TestMind/
├── README.md                    ⭐ 从这里开始
├── ROADMAP.md                   📅 产品规划
├── CHANGELOG.md                 📝 版本历史
├── CONTRIBUTING.md              🤝 贡献指南
├── ARCHITECTURE.md              🏗️  技术架构
├── TESTING_GUIDE.md             📖 测试指南
├── DOCS.md                      🇨🇳 中文索引
├── LICENSE                      ⚖️  MIT协议
│
├── docs/                        📚 详细文档
│   ├── guides/                  (使用指南)
│   ├── adr/                     (架构决策)
│   ├── case-studies/            (案例研究)
│   ├── community/               (社区内容)
│   ├── blog/                    (博客文章)
│   └── business/                (商业文档)
│
├── packages/                    💻 核心代码
│   ├── core/                    (核心引擎)
│   ├── cli/                     (命令行工具)
│   └── shared/                  (共享类型)
│
├── scripts/                     🔧 工具脚本
│   ├── test-*.ts                (测试脚本)
│   ├── validate-*.ts            (验证脚本)
│   └── prepare-*.ts             (准备脚本)
│
├── examples/                    💡 示例配置
│   ├── github-actions/
│   └── gitlab-ci/
│
└── archive/                     📦 归档文件
    ├── v0.4.0-alpha-release/    (本次发布)
    ├── v0.3.0-development/      (开发文档)
    ├── shannon-validation/      (Shannon验证)
    └── ...                      (历史归档)
```

---

## 🎯 快速导航

### 我想使用TestMind

1. 阅读 `README.md` 了解项目
2. 查看 `ROADMAP.md` 了解发展方向
3. 参考 `TESTING_GUIDE.md` 开始使用
4. 遇到问题查看 `DOCS.md` 中文索引

### 我想贡献代码

1. 阅读 `CONTRIBUTING.md` 了解流程
2. 研究 `ARCHITECTURE.md` 理解架构
3. 查看 `ROADMAP.md` 选择任务
4. 参考 `docs/guides/` 中的开发指南

### 我想了解技术细节

1. 查看 `ARCHITECTURE.md` - 整体架构
2. 浏览 `docs/adr/` - 架构决策记录
3. 阅读 `docs/case-studies/` - 实际案例
4. 查看代码 `packages/core/src/` - 核心实现

### 我想了解发布历史

1. 查看 `CHANGELOG.md` - 所有版本变更
2. 浏览 `archive/v0.4.0-alpha-release/` - 本次发布详情
3. 查看 `archive/shannon-validation/` - 验证成果

---

## 📦 核心模块概览

### packages/core/src/

```
├── self-healing/      自愈引擎（5模块）
│   ├── LocatorEngine.ts
│   ├── FailureClassifier.ts
│   ├── FixSuggester.ts
│   ├── IntentTracker.ts
│   └── SelfHealingEngine.ts
│
├── diff/              Diff-First工作流（4模块）
│   ├── DiffGenerator.ts
│   ├── DiffApplier.ts
│   ├── DiffReviewer.ts
│   └── GitIntegration.ts
│
├── skills/            技能框架
│   ├── ApiTestSkill.ts
│   ├── TestGenerationSkill.ts
│   └── RefactorSkill.ts
│
├── ci-cd/             CI/CD集成（3模块）
│   ├── GitHubActionsIntegration.ts
│   ├── GitLabCIIntegration.ts
│   └── CICDManager.ts
│
├── context/           上下文引擎
├── generation/        测试生成
├── llm/               LLM集成
└── utils/             工具函数
```

---

## 🔍 查找特定内容

### 执行报告

**位置**: `archive/v0.4.0-alpha-release/`

**主要文件**:
- `EXECUTION_COMPLETE_V0.4.0.md` - 完整执行报告
- `PHASE1_COMPLETE_SUMMARY.md` - 阶段一总结

### Shannon验证

**位置**: `archive/shannon-validation/shannon-validation-output/`

**主要文件**:
- `pr-packages/` - 准备好的PR代码
- `verified-tests/` - 验证过的测试

### 开发文档

**位置**: `archive/v0.3.0-development/`

**内容**: 开发过程中的临时文档

---

## 📝 文档维护

### 保持根目录整洁

**规则**:
- 只保留核心用户文档
- 执行报告移至`archive/`
- 临时文档及时清理

### 归档策略

- **每个版本**: 创建`archive/vX.X.X-release/`
- **开发文档**: 移至`archive/vX.X.X-development/`
- **验证输出**: 移至`archive/project-name-validation/`

---

**查看完整架构**: `ARCHITECTURE.md`  
**查看中文导航**: `DOCS.md`  
**查看发布详情**: `archive/v0.4.0-alpha-release/`

