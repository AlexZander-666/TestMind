/**
 * TestEvaluator: Evaluate test quality and provide improvement suggestions
 */

import type { TestSuite, TestRunResult, QualityScore, Improvement } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { TestRunner } from './TestRunner';
import { QualityAnalyzer } from './QualityAnalyzer';

export class TestEvaluator {
  private runner: TestRunner;
  private analyzer: QualityAnalyzer;

  constructor() {
    this.runner = new TestRunner();
    this.analyzer = new QualityAnalyzer();
  }

  /**
   * Run tests and collect metrics
   */
  async runTests(testSuite: TestSuite): Promise<TestRunResult> {
    console.log(`[TestEvaluator] Running test suite: ${testSuite.id}`);

    // Execute tests
    const executionResult = await this.runner.run(testSuite);

    // Analyze quality
    const qualityScore = await this.evaluateQuality(testSuite);

    const result: TestRunResult = {
      id: generateUUID(),
      suiteId: testSuite.id,
      status: executionResult.success ? 'passed' : 'failed',
      coverage: executionResult.coverage,
      duration: executionResult.duration,
      qualityScore,
      runAt: new Date(),
      errors: executionResult.errors,
    };

    console.log('[TestEvaluator] Test run complete:', {
      status: result.status,
      coverage: result.coverage.percentage,
      qualityScore: result.qualityScore.overallScore,
    });

    return result;
  }

  /**
   * Evaluate test quality without running
   */
  async evaluateQuality(testSuite: TestSuite): Promise<QualityScore> {
    console.log(`[TestEvaluator] Evaluating quality: ${testSuite.id}`);
    return this.analyzer.analyze(testSuite);
  }

  /**
   * Generate improvement suggestions
   */
  async suggestImprovements(evaluation: QualityScore, suiteId: string): Promise<Improvement[]> {
    console.log(`[TestEvaluator] Generating improvements for: ${suiteId}`);

    const improvements: Improvement[] = [];

    // Coverage improvements
    if (evaluation.coverage < 80) {
      improvements.push({
        id: generateUUID(),
        suiteId,
        type: 'add-coverage',
        description: `Coverage is ${evaluation.coverage.toFixed(1)}%. Consider adding tests for uncovered branches.`,
        priority: 'high',
        status: 'pending',
        estimatedEffort: 'medium',
        expectedImpact: 'high',
        createdAt: new Date(),
      });
    }

    // Assertion quality improvements
    if (evaluation.assertionQuality < 0.7) {
      improvements.push({
        id: generateUUID(),
        suiteId,
        type: 'improve-assertion',
        description: 'Tests have weak assertions. Add more specific assertions about behavior.',
        priority: 'medium',
        status: 'pending',
        estimatedEffort: 'low',
        expectedImpact: 'medium',
        createdAt: new Date(),
      });
    }

    // Anti-pattern fixes
    for (const antiPattern of evaluation.antiPatterns) {
      improvements.push({
        id: generateUUID(),
        suiteId,
        type: this.mapAntiPatternToImprovement(antiPattern.type),
        description: antiPattern.suggestion,
        priority: antiPattern.severity === 'high' ? 'high' : 'medium',
        status: 'pending',
        estimatedEffort: 'medium',
        expectedImpact: antiPattern.severity === 'high' ? 'high' : 'medium',
        createdAt: new Date(),
      });
    }

    return improvements;
  }

  /**
   * Map anti-pattern type to improvement type
   */
  private mapAntiPatternToImprovement(
    antiPatternType: string
  ): Improvement['type'] {
    const mapping: Record<string, Improvement['type']> = {
      'over-mocking': 'reduce-mocking',
      'testing-implementation': 'refactor-test',
      'flaky-test': 'fix-flaky-test',
      'slow-test': 'refactor-test',
      'no-assertions': 'improve-assertion',
      'too-many-assertions': 'refactor-test',
      'global-state-dependency': 'refactor-test',
    };

    return mapping[antiPatternType] || 'refactor-test';
  }
}



























