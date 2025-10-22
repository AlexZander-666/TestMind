# CI/CD Integration API 参考

## 概述

TestMind v0.6.0 提供深度CI/CD集成，自动化测试生成、修复和质量监控。

## 核心组件

### CoverageAnalyzer

覆盖率分析器，识别未覆盖代码并生成测试建议。

#### 基础用法

```typescript
import { createCoverageAnalyzer } from '@testmind/core';

const analyzer = createCoverageAnalyzer({
  threshold: 80, // 目标覆盖率
  projectPath: './src'
});

// 分析覆盖率
const analysis = await analyzer.analyze('./coverage/coverage-final.json');

console.log(`当前覆盖率: ${analysis.summary.overall}%`);
console.log(`缺口数: ${analysis.gaps.length}`);
```

#### API 方法

##### analyze(coverageFile: string): Promise<CoverageAnalysisResult>

分析覆盖率报告。

**参数:**
- `coverageFile` - 覆盖率JSON文件路径（Istanbul/NYC格式）

**返回:**
```typescript
interface CoverageAnalysisResult {
  summary: {
    overall: number; // 总体覆盖率 %
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  
  gaps: CoverageGap[]; // 未覆盖区域
  suggestions: TestSuggestion[]; // 测试建议
  
  fileAnalysis: Map<string, FileCoverage>;
}

interface CoverageGap {
  file: string;
  type: 'function' | 'branch' | 'statement';
  location: { start: number; end: number };
  complexity: number;
  priority: 'high' | 'medium' | 'low';
}

interface TestSuggestion {
  targetFile: string;
  targetFunction: string;
  reason: string;
  priority: number; // 1-10
  estimatedEffort: 'low' | 'medium' | 'high';
}
```

**示例:**
```typescript
const result = await analyzer.analyze('./coverage/coverage-final.json');

// 按优先级处理缺口
const highPriority = result.gaps
  .filter(g => g.priority === 'high')
  .sort((a, b) => b.complexity - a.complexity);

for (const gap of highPriority) {
  console.log(`⚠️ ${gap.file}:${gap.location.start} - ${gap.type}`);
}

// 生成测试
for (const suggestion of result.suggestions.slice(0, 5)) {
  await generateTest(suggestion.targetFile, suggestion.targetFunction);
}
```

##### generateSuggest

ions(gaps: CoverageGap[]): TestSuggestion[]

基于覆盖率缺口生成测试建议。

---

### PerformanceMonitor

性能监控器，检测性能回归和优化机会。

#### 基础用法

```typescript
import { createPerformanceMonitor } from '@testmind/core';

const monitor = createPerformanceMonitor({
  baselinePath: './performance/baseline.json',
  threshold: 0.2 // 20% 性能变化触发告警
});

// 记录测试运行
const run = await monitor.recordRun({
  testSuite: 'api-tests',
  tests: testResults,
  metadata: { branch: 'feature/new-api', commit: 'abc123' }
});

// 检测回归
const comparison = await monitor.compareWithBaseline(run);

if (comparison.regressions.length > 0) {
  console.error('❌ 性能回归检测:');
  for (const reg of comparison.regressions) {
    console.error(`  ${reg.testName}: ${reg.oldDuration}ms → ${reg.newDuration}ms (+${reg.percentChange}%)`);
  }
}
```

#### API 方法

##### recordRun(testRun: TestRun): Promise<TestRunRecord>

记录测试运行性能数据。

**参数:**
```typescript
interface TestRun {
  testSuite: string;
  tests: TestPerformance[];
  metadata?: {
    branch?: string;
    commit?: string;
    pr?: number;
    timestamp?: Date;
  };
}

interface TestPerformance {
  name: string;
  duration: number; // 毫秒
  status: 'passed' | 'failed' | 'skipped';
  memory?: number; // MB
  cpu?: number; // %
}
```

**返回:**
```typescript
interface TestRunRecord {
  id: string;
  testSuite: string;
  totalTests: number;
  totalDuration: number;
  avgDuration: number;
  timestamp: Date;
  metadata: Record<string, any>;
}
```

##### compareWithBaseline(currentRun: TestRunRecord): Promise<PerformanceComparisonResult>

与基线比较，检测回归和改进。

**返回:**
```typescript
interface PerformanceComparisonResult {
  regressions: PerformanceRegression[]; // 性能下降
  improvements: PerformanceImprovement[]; // 性能提升
  stable: TestPerformance[]; // 稳定的测试
  
  summary: {
    totalRegression: number; // %
    totalImprovement: number; // %
    avgChange: number; // %
  };
}

interface PerformanceRegression {
  testName: string;
  oldDuration: number;
  newDuration: number;
  percentChange: number; // >0 表示变慢
  severity: 'critical' | 'warning' | 'minor';
}
```

**示例:**
```typescript
const comparison = await monitor.compareWithBaseline(currentRun);

// 严重回归 → 失败CI
if (comparison.regressions.some(r => r.severity === 'critical')) {
  console.error('❌ 检测到严重性能回归！');
  process.exit(1);
}

// 改进 → 更新基线
if (comparison.summary.totalImprovement > 10) {
  console.log('✅ 性能提升10%+，更新基线');
  await monitor.updateBaseline(currentRun);
}
```

---

## CI/CD 工作流集成

### GitHub Actions

```yaml
name: TestMind CI

on: [push, pull_request]

jobs:
  test-with-healing:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests with self-healing
        run: pnpm testmind test --heal --ci
        env:
          TESTMIND_API_KEY: ${{ secrets.TESTMIND_API_KEY }}
      
      - name: Analyze coverage
        run: pnpm testmind analyze-coverage
      
      - name: Check performance
        run: pnpm testmind check-performance
      
      - name: Generate missing tests
        if: ${{ failure() }}
        run: pnpm testmind generate --coverage-gaps
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            coverage/
            .testmind/reports/
```

### GitLab CI

```yaml
testmind:
  stage: test
  image: node:18
  
  before_script:
    - pnpm install
  
  script:
    - pnpm testmind test --heal --ci
    - pnpm testmind analyze-coverage --threshold 80
    - pnpm testmind check-performance --baseline
  
  after_script:
    # 自动修复失败的测试
    - pnpm testmind heal --failures ./test-results.json
  
  artifacts:
    when: always
    paths:
      - coverage/
      - .testmind/
    reports:
      junit: .testmind/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
```

---

## 完整示例

### 自动化测试修复流程

```typescript
import {
  createCoverageAnalyzer,
  createPerformanceMonitor,
  TestRunner,
  SelfHealingEngine
} from '@testmind/core';

async function ciPipeline() {
  // 1. 运行测试
  const runner = new TestRunner();
  const results = await runner.run('./tests/**/*.test.ts');
  
  // 2. 自愈失败的测试
  const healingEngine = new SelfHealingEngine();
  const failures = results.filter(r => r.status === 'failed');
  
  for (const failure of failures) {
    const healed = await healingEngine.heal(failure);
    if (healed.success) {
      console.log(`✅ 自愈成功: ${failure.testName}`);
      // 重新运行测试
      await runner.runSingle(failure.testName);
    }
  }
  
  // 3. 分析覆盖率
  const analyzer = createCoverageAnalyzer({ threshold: 80 });
  const coverage = await analyzer.analyze('./coverage/coverage-final.json');
  
  if (coverage.summary.overall < 80) {
    console.warn(`⚠️ 覆盖率不足: ${coverage.summary.overall}%`);
    
    // 生成建议测试
    for (const suggestion of coverage.suggestions.slice(0, 10)) {
      console.log(`生成测试: ${suggestion.targetFunction}`);
      // await generateTest(suggestion);
    }
  }
  
  // 4. 性能监控
  const monitor = createPerformanceMonitor({
    baselinePath: './performance/baseline.json'
  });
  
  const perfRun = await monitor.recordRun({
    testSuite: 'all-tests',
    tests: results.map(r => ({
      name: r.testName,
      duration: r.duration,
      status: r.status
    }))
  });
  
  const comparison = await monitor.compareWithBaseline(perfRun);
  
  // 检查严重回归
  const criticalRegressions = comparison.regressions.filter(
    r => r.severity === 'critical'
  );
  
  if (criticalRegressions.length > 0) {
    console.error('❌ 严重性能回归！');
    throw new Error('Performance regression detected');
  }
  
  // 5. 生成报告
  const report = {
    coverage: coverage.summary,
    performance: comparison.summary,
    healed: failures.filter(f => f.healed).length,
    timestamp: new Date()
  };
  
  await fs.writeFile('.testmind/ci-report.json', JSON.stringify(report, null, 2));
  
  console.log('✅ CI流程完成');
}

// 在CI环境运行
if (process.env.CI) {
  ciPipeline().catch(error => {
    console.error('CI流程失败:', error);
    process.exit(1);
  });
}
```

---

## 配置选项

### CI模式配置

```typescript
interface CIConfig {
  // 自动修复失败的测试
  autoHeal?: boolean; // 默认: true
  
  // 覆盖率阈值
  coverageThreshold?: number; // 默认: 80
  
  // 性能回归阈值
  performanceThreshold?: number; // 默认: 0.2 (20%)
  
  // 测试生成模式
  generateMode?: 'coverage-gaps' | 'failed-tests' | 'both';
  
  // 报告格式
  reportFormat?: 'json' | 'junit' | 'markdown';
  
  // 通知
  notifications?: {
    slack?: { webhook: string };
    email?: { to: string[] };
  };
}
```

---

## 最佳实践

### 1. 渐进式自愈

```typescript
// 推荐：先记录，再修复
const healingEngine = new SelfHealingEngine({
  mode: 'record', // 第一周：只记录
  autoApply: false
});

// 一周后，审查效果良好，启用自动修复
healingEngine.setMode('auto');
```

### 2. 性能基线管理

```typescript
// 主分支更新基线
if (process.env.BRANCH === 'main') {
  await monitor.updateBaseline(currentRun);
}

// 功能分支只比较
else {
  const comparison = await monitor.compareWithBaseline(currentRun);
  // 上报但不失败CI（除非严重回归）
}
```

### 3. 智能测试生成

```typescript
// 优先级排序
const priorities = coverage.suggestions
  .sort((a, b) => b.priority - a.priority)
  .slice(0, 20); // 每次只生成前20个

for (const suggestion of priorities) {
  if (suggestion.estimatedEffort === 'low') {
    await generateTest(suggestion);
  }
}
```

---

## 性能指标

- **自愈成功率**: 70%+
- **覆盖率分析**: < 5秒
- **性能对比**: < 1秒
- **CI时间增加**: < 10%

---

## 相关文档

- [CI/CD设置指南](../guides/cicd-setup.md)
- [性能监控](../guides/performance-monitoring.md)

