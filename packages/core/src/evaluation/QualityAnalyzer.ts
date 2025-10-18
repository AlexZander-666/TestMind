/**
 * QualityAnalyzer: Analyze test code quality
 */

import type { TestSuite, QualityScore, AntiPattern } from '@testmind/shared';

export class QualityAnalyzer {
  /**
   * Analyze test suite quality
   */
  async analyze(testSuite: TestSuite): Promise<QualityScore> {
    console.log(`[QualityAnalyzer] Analyzing: ${testSuite.id}`);

    // Analyze different quality dimensions
    const assertionQuality = this.analyzeAssertions(testSuite.code);
    const independence = this.analyzeIndependence(testSuite.code);
    const maintainability = this.analyzeMaintainability(testSuite.code);
    const antiPatterns = this.detectAntiPatterns(testSuite.code);

    // Calculate overall score
    const overallScore = this.calculateOverallScore({
      coverage: 0, // Will be filled by test runner
      assertionQuality,
      independence,
      stability: 1, // Will be filled after stability check
      maintainability,
      overallScore: 0,
      antiPatterns,
    });

    return {
      coverage: 0,
      assertionQuality,
      independence,
      stability: 1,
      maintainability,
      overallScore,
      antiPatterns,
    };
  }

  /**
   * Analyze assertion quality
   */
  private analyzeAssertions(code: string): number {
    // Count assertions
    const assertionPatterns = [
      /expect\(.*\)\./g,
      /assert\(.*\)/g,
      /should\(.*\)/g,
    ];

    let assertionCount = 0;
    for (const pattern of assertionPatterns) {
      const matches = code.match(pattern);
      assertionCount += matches ? matches.length : 0;
    }

    // Check for weak assertions (toBeTruthy, toBeFalsy alone)
    const weakAssertions = (code.match(/\.toBeTruthy\(\)|\.toBeFalsy\(\)/g) || []).length;

    // Calculate quality score
    if (assertionCount === 0) return 0;
    const weakRatio = weakAssertions / assertionCount;
    return Math.max(0, 1 - weakRatio);
  }

  /**
   * Analyze test independence
   */
  private analyzeIndependence(code: string): number {
    // Check for global state usage
    const hasGlobalState = /\b(global|window|process\.env)\./g.test(code);
    
    // Check for proper setup/teardown
    const hasSetup = /beforeEach|beforeAll|setUp/g.test(code);
    const hasTeardown = /afterEach|afterAll|tearDown/g.test(code);

    let score = 1.0;
    if (hasGlobalState && !hasSetup) score -= 0.5;
    if (hasGlobalState && !hasTeardown) score -= 0.3;

    return Math.max(0, score);
  }

  /**
   * Analyze maintainability
   */
  private analyzeMaintainability(code: string): number {
    const lines = code.split('\n');
    const codeLines = lines.filter((l) => l.trim() && !l.trim().startsWith('//')).length;

    // Check test size (smaller is more maintainable)
    const sizeScore = codeLines < 50 ? 1.0 : codeLines < 100 ? 0.8 : 0.6;

    // Check for descriptive test names
    const testNames = code.match(/it\(['"](.+?)['"]/g) || [];
    const hasDescriptiveNames = testNames.length > 0 && testNames.every((name) => name.length > 20);
    const nameScore = hasDescriptiveNames ? 1.0 : 0.7;

    return (sizeScore + nameScore) / 2;
  }

  /**
   * Detect anti-patterns
   */
  private detectAntiPatterns(code: string): AntiPattern[] {
    const antiPatterns: AntiPattern[] = [];

    // Check for over-mocking
    const mockCount = (code.match(/jest\.mock|vi\.mock|sinon\.mock/g) || []).length;
    if (mockCount > 5) {
      antiPatterns.push({
        type: 'over-mocking',
        description: 'Test has too many mocks, which may indicate coupling to implementation',
        location: { filePath: '', line: 0, column: 0 },
        severity: 'medium',
        suggestion: 'Consider testing at a higher level or refactoring to reduce dependencies',
      });
    }

    // Check for no assertions
    const hasAssertions = /expect\(|assert\(|should\(/g.test(code);
    if (!hasAssertions) {
      antiPatterns.push({
        type: 'no-assertions',
        description: 'Test has no assertions',
        location: { filePath: '', line: 0, column: 0 },
        severity: 'high',
        suggestion: 'Add assertions to verify expected behavior',
      });
    }

    // Check for testing implementation details
    const testsPrivateMethods = /\._[a-zA-Z]+\(/.test(code);
    if (testsPrivateMethods) {
      antiPatterns.push({
        type: 'testing-implementation',
        description: 'Test accesses private methods, coupling to implementation',
        location: { filePath: '', line: 0, column: 0 },
        severity: 'medium',
        suggestion: 'Test public API and behavior instead of implementation details',
      });
    }

    return antiPatterns;
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(score: Partial<QualityScore>): number {
    const weights = {
      coverage: 0.3,
      assertionQuality: 0.2,
      independence: 0.2,
      stability: 0.15,
      maintainability: 0.15,
    };

    let total = 0;
    if (score.coverage !== undefined) total += score.coverage * weights.coverage;
    if (score.assertionQuality !== undefined) total += score.assertionQuality * 100 * weights.assertionQuality;
    if (score.independence !== undefined) total += score.independence * 100 * weights.independence;
    if (score.stability !== undefined) total += score.stability * 100 * weights.stability;
    if (score.maintainability !== undefined) total += score.maintainability * 100 * weights.maintainability;

    // Penalize for anti-patterns
    const antiPatternPenalty = (score.antiPatterns?.length || 0) * 5;
    
    return Math.max(0, Math.min(100, total - antiPatternPenalty));
  }
}



























