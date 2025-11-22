# CI/CD 集成使用示例

## 示例 1: GitHub Actions 自动修复

### 1.1 基础配置

在你的仓库中创建 `.github/workflows/testmind.yml`:

```yaml
name: TestMind CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test-with-healing:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - run: pnpm install
      - run: pnpm build
      
      # 运行测试
      - name: Run tests
        id: test
        run: pnpm test --reporter=json --outputFile=test-results.json
        continue-on-error: true
      
      # 自动修复
      - name: Auto-heal
        if: steps.test.outcome == 'failure'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          pnpm testmind heal \
            --report test-results.json \
            --ci \
            --auto-commit \
            --confidence-threshold 0.85
```

### 1.2 添加必要的 Secrets

在 GitHub 仓库设置中添加：

1. 进入 `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`
3. 添加 `OPENAI_API_KEY`（你的 OpenAI API 密钥）

### 1.3 查看结果

- PR 中会自动添加评论，包含自愈结果
- 可以在 Actions 标签页查看详细日志
- artifacts 中包含完整的自愈报告

---

## 示例 2: GitLab CI 自动修复

### 2.1 配置 Pipeline

在 `.gitlab-ci.yml` 中包含 TestMind 配置：

```yaml
include:
  - local: '.gitlab-ci.testmind.yml'

variables:
  OPENAI_API_KEY: $CI_JOB_TOKEN  # 或使用 GitLab CI/CD Variables
```

### 2.2 添加 CI/CD Variables

1. 进入项目 `Settings` → `CI/CD` → `Variables`
2. 添加 `OPENAI_API_KEY`
3. 标记为 `Masked` 和 `Protected`

### 2.3 查看结果

- MR 中会自动添加评论
- Pipeline 视图显示各阶段状态
- Artifacts 包含报告

---

## 示例 3: 覆盖率缺口分析

### 3.1 生成覆盖率报告

```bash
# 运行测试并生成覆盖率
pnpm test --coverage --coverageReporters=json
```

### 3.2 分析缺口

```bash
# 分析覆盖率缺口
pnpm testmind coverage analyze \
  --report coverage/coverage-final.json \
  --output coverage-gaps.json \
  --output-md coverage-gaps.md
```

### 3.3 查看结果

```bash
# Markdown 报告
cat coverage-gaps.md

# JSON 数据
cat coverage-gaps.json | jq '.highPriority[] | .function.name'
```

### 3.4 示例输出

```markdown
# 📊 Coverage Analysis Report

**Overall Coverage**: 85.5%
**Uncovered Functions**: 42
**Files**: 100 total, 23 need improvement

## 🎯 High Priority (8)

### authenticateUser
**File**: `src/auth/login.ts`
**Priority**: 95/100
**Estimated Effort**: 25 minutes

**Test Cases**:
- Test successful authentication with valid credentials
- Test authentication failure with invalid password
- Test authentication with non-existent user
- Test token generation after successful auth
- Test session creation

**Edge Cases**:
- Test with empty credentials
- Test with SQL injection attempt
- Test with concurrent login attempts
```

---

## 示例 4: 性能回归检测

### 4.1 建立基线

```bash
# 首次运行建立基线
pnpm test --reporter=json --outputFile=test-results.json

pnpm testmind perf baseline \
  --from test-results.json \
  --to .testmind/baseline-perf.json
```

### 4.2 检测回归

```bash
# 后续运行检测回归
pnpm test --reporter=json --outputFile=test-results-new.json

pnpm testmind perf compare \
  --current test-results-new.json \
  --baseline .testmind/baseline-perf.json \
  --threshold 1.2 \
  --output perf-regression.json
```

### 4.3 示例输出

```markdown
# ⚡ Performance Regression Report

## Overall Performance
**Baseline Total**: 5,234ms
**Current Total**: 6,512ms
**Change**: +24.4% ⚠️

## 🔴 Critical Regressions (2)

### should process large dataset
- **Baseline**: 1,200ms
- **Current**: 2,800ms
- **Slowdown**: 133% (2.33x)
- **Diff**: +1,600ms

### should render complex component
- **Baseline**: 450ms
- **Current**: 920ms
- **Slowdown**: 104% (2.04x)
- **Diff**: +470ms

## ⚠️  Warning Regressions (5)

- **should validate form**: 120ms → 180ms (50%)
- **should fetch user data**: 230ms → 310ms (35%)
...
```

---

## 示例 5: 本地验证脚本

在本地测试 CI/CD 功能：

```bash
#!/bin/bash
# scripts/local-ci-test.sh

echo "🧪 Local CI/CD Simulation"

# 1. 运行测试
echo "Step 1: Running tests..."
pnpm test --reporter=json --outputFile=test-results.json || true

# 2. 自动修复
echo "Step 2: Auto-healing..."
pnpm testmind heal \
  --report test-results.json \
  --auto \
  --confidence-threshold 0.85 \
  --output healing-report.json

# 3. 覆盖率分析
echo "Step 3: Coverage analysis..."
pnpm test --coverage --coverageReporters=json
pnpm testmind coverage analyze \
  --report coverage/coverage-final.json \
  --output coverage-gaps.json

# 4. 性能检测
echo "Step 4: Performance check..."
if [ -f .testmind/baseline-perf.json ]; then
  pnpm testmind perf compare \
    --current test-results.json \
    --baseline .testmind/baseline-perf.json \
    --threshold 1.2
fi

# 5. 生成总结
echo ""
echo "📊 Results Summary:"
echo "Healing Report: healing-report.json"
echo "Coverage Gaps: coverage-gaps.json"

# 显示自愈结果
jq '.summary' healing-report.json
```

---

## 示例 6: 配置文件

### .testmindrc.json

```json
{
  "selfHealing": {
    "enableAutoFix": false,
    "confidenceThreshold": 0.85,
    "enableLLM": true,
    "strategies": ["id", "css", "xpath", "semantic"]
  },
  
  "vectorStore": {
    "path": ".testmind/vectors",
    "model": "text-embedding-3-small",
    "batchSize": 100
  },
  
  "costOptimization": {
    "enableAutoSelection": true,
    "simpleModelThreshold": 3,
    "complexModelThreshold": 10
  },
  
  "cicd": {
    "autoCommit": false,
    "maxFixes": 10,
    "failOnCriticalRegression": true
  }
}
```

---

## 示例 7: 集成到现有工作流

如果你已有 CI 工作流，可以添加 TestMind 步骤：

```yaml
# 现有的测试步骤
- name: Test
  run: npm test

# 添加 TestMind 自愈
- name: TestMind Heal
  if: failure()  # 只在测试失败时运行
  run: npx testmind heal --report test-results.json --auto
```

---

## 常见问题

### Q: 自愈会不会掩盖真实 Bug？

A: 不会。失败分类器会区分：
- 真实 Bug → Cannot Fix，不会自动修复
- 测试脆弱性 → 可以修复
- 环境问题 → 标记为环境问题

### Q: API 成本会不会很高？

A: 成本很低：
- 失败分类: 70% 使用规则引擎（$0），30% 使用 LLM（$0.001/次）
- 语义定位: 仅在其他策略失败时使用
- 覆盖率建议: 每个函数 $0.001-0.002
- 典型 PR: $0.01-0.05

### Q: 需要配置什么？

A: 最小配置：
1. OPENAI_API_KEY（环境变量或 Secrets）
2. 测试报告格式（JSON）
3. 就这些！

---

## 更多资源

- [Self-Healing Advanced Guide](../../docs/guides/self-healing-advanced.md)
- [Vector Database Setup](../../docs/guides/vector-database-setup.md)
- [GitHub Actions 示例](../../.github/workflows/testmind-auto-heal.yml)
- [GitLab CI 示例](../../.gitlab-ci.testmind.yml)














