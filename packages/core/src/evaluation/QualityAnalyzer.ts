/**
 * QualityAnalyzer: Analyze test code quality
 * 
 * Enhanced with:
 * - Assertion diversity scoring
 * - Boundary condition coverage
 * - Readability scoring
 */

import type { TestSuite, QualityScore, AntiPattern } from '@testmind/shared';

export interface ExtendedQualityScore extends QualityScore {
  assertionDiversity?: number;
  boundaryConditionCoverage?: number;
  readability?: number;
}

export class QualityAnalyzer {
  /**
   * Analyze test suite quality with extended metrics
   */
  async analyze(testSuite: TestSuite): Promise<ExtendedQualityScore> {
    console.log(`[QualityAnalyzer] Analyzing: ${testSuite.id}`);

    // Analyze different quality dimensions
    const assertionQuality = this.analyzeAssertions(testSuite.code);
    const assertionDiversity = this.analyzeAssertionDiversity(testSuite.code);
    const independence = this.analyzeIndependence(testSuite.code);
    const maintainability = this.analyzeMaintainability(testSuite.code);
    const boundaryConditionCoverage = this.analyzeBoundaryConditions(testSuite.code);
    const readability = this.analyzeReadability(testSuite.code);
    const antiPatterns = this.detectAntiPatterns(testSuite.code);

    // Calculate overall score with extended metrics
    const overallScore = this.calculateOverallScore({
      coverage: 0, // Will be filled by test runner
      assertionQuality,
      independence,
      stability: 1, // Will be filled after stability check
      maintainability,
      overallScore: 0,
      antiPatterns,
      assertionDiversity,
      boundaryConditionCoverage,
      readability,
    });

    return {
      coverage: 0,
      assertionQuality,
      independence,
      stability: 1,
      maintainability,
      overallScore,
      antiPatterns,
      assertionDiversity,
      boundaryConditionCoverage,
      readability,
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
   * Analyze assertion diversity
   * Higher diversity = better test quality
   */
  private analyzeAssertionDiversity(code: string): number {
    const assertionTypes = new Set<string>();
    
    // Common assertion types
    const patterns = {
      equality: /\.(toBe|toEqual|toStrictEqual)\(/g,
      boolean: /\.(toBeTruthy|toBeFalsy|toBeDefined|toBeUndefined|toBeNull)\(/g,
      comparison: /\.(toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual|toBeLessThanOrEqual)\(/g,
      containment: /\.(toContain|toHaveProperty|toHaveLength|toMatch)\(/g,
      errors: /\.(toThrow|toThrowError|rejects\.toThrow)\(/g,
      async: /\.(resolves|rejects)\./g,
    };
    
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(code)) {
        assertionTypes.add(type);
      }
    }
    
    // Score based on diversity (max 6 types)
    const diversityScore = assertionTypes.size / 6;
    
    // Bonus for having at least 3 different types
    const hasGoodDiversity = assertionTypes.size >= 3;
    
    return hasGoodDiversity ? Math.min(1, diversityScore + 0.2) : diversityScore;
  }
  
  /**
   * Analyze boundary condition coverage
   * Checks for common boundary cases
   */
  private analyzeBoundaryConditions(code: string): number {
    const boundaryPatterns = {
      emptyArrays: /\[\]|\.length === 0/g,
      null: /null/g,
      undefined: /undefined/g,
      zero: /\b0\b/g,
      negatives: /-\d+/g,
      maxValues: /MAX_|Infinity|Number\.MAX/g,
      emptyStrings: /['"]{2}|''/g,
    };
    
    let coveredBoundaries = 0;
    for (const [, pattern] of Object.entries(boundaryPatterns)) {
      if (pattern.test(code)) {
        coveredBoundaries++;
      }
    }
    
    // Score based on number of boundary types covered
    // Good tests cover at least 3 boundary types
    const score = Math.min(1, coveredBoundaries / 7);
    
    return score;
  }
  
  /**
   * Analyze test readability
   * Considers naming, structure, and comments
   */
  private analyzeReadability(code: string): number {
    let score = 1.0;
    
    // 1. Check test naming quality
    const testNames = code.match(/it\(['"](.+?)['"]/g) || [];
    const hasDescriptiveNames = testNames.every((name) => {
      // Extract name content
      const nameContent = name.match(/it\(['"](.+?)['"]/)?.[1] || '';
      // Good names are 30-100 chars and describe behavior
      return nameContent.length >= 30 && nameContent.length <= 100 && nameContent.includes('should');
    });
    
    if (!hasDescriptiveNames) score -= 0.2;
    
    // 2. Check for arrange-act-assert pattern (AAA)
    const hasAAA = /\/\/ Arrange|\/\/ Act|\/\/ Assert/.test(code);
    if (hasAAA) score += 0.1;
    
    // 3. Check for explanatory comments
    const commentLines = (code.match(/\/\/.+/g) || []).length;
    const codeLines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
    const commentRatio = commentLines / Math.max(1, codeLines);
    
    if (commentRatio >= 0.1 && commentRatio <= 0.3) {
      // Good balance: 10-30% comments
      score += 0.1;
    } else if (commentRatio > 0.5) {
      // Too many comments may indicate unclear code
      score -= 0.1;
    }
    
    // 4. Check for magic numbers
    const hasMagicNumbers = /\d{4,}/.test(code); // Numbers with 4+ digits
    if (hasMagicNumbers) score -= 0.1;
    
    // 5. Check for proper test organization
    const hasDescribe = /describe\(['"]/.test(code);
    const hasNestedDescribe = /describe\([^)]+describe\(/s.test(code);
    if (hasDescribe && !hasNestedDescribe) {
      // Has describe but not overly nested
      score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Calculate overall quality score with extended metrics
   */
  private calculateOverallScore(score: Partial<ExtendedQualityScore>): number {
    const weights = {
      coverage: 0.25,
      assertionQuality: 0.15,
      assertionDiversity: 0.10,
      independence: 0.15,
      stability: 0.10,
      maintainability: 0.10,
      boundaryConditionCoverage: 0.08,
      readability: 0.07,
    };

    let total = 0;
    if (score.coverage !== undefined) total += score.coverage * weights.coverage;
    if (score.assertionQuality !== undefined) total += score.assertionQuality * 100 * weights.assertionQuality;
    if (score.assertionDiversity !== undefined) total += score.assertionDiversity * 100 * weights.assertionDiversity;
    if (score.independence !== undefined) total += score.independence * 100 * weights.independence;
    if (score.stability !== undefined) total += score.stability * 100 * weights.stability;
    if (score.maintainability !== undefined) total += score.maintainability * 100 * weights.maintainability;
    if (score.boundaryConditionCoverage !== undefined) total += score.boundaryConditionCoverage * 100 * weights.boundaryConditionCoverage;
    if (score.readability !== undefined) total += score.readability * 100 * weights.readability;

    // Penalize for anti-patterns
    const antiPatternPenalty = (score.antiPatterns?.length || 0) * 5;
    
    return Math.max(0, Math.min(100, total - antiPatternPenalty));
  }
  
  /**
   * Generate improvement suggestions based on scores
   */
  public generateImprovements(score: ExtendedQualityScore): string[] {
    const suggestions: string[] = [];
    
    if (score.assertionDiversity && score.assertionDiversity < 0.5) {
      suggestions.push('Increase assertion diversity: Use different types of assertions (equality, containment, errors, etc.)');
    }
    
    if (score.boundaryConditionCoverage && score.boundaryConditionCoverage < 0.4) {
      suggestions.push('Add boundary condition tests: Test with null, undefined, empty arrays, zero, negative numbers, max values');
    }
    
    if (score.readability && score.readability < 0.7) {
      suggestions.push('Improve readability: Use descriptive test names (30-100 chars), add AAA comments, avoid magic numbers');
    }
    
    if (score.assertionQuality < 0.7) {
      suggestions.push('Improve assertion quality: Use specific assertions (toBe, toEqual) instead of weak ones (toBeTruthy)');
    }
    
    if (score.independence < 0.7) {
      suggestions.push('Improve test independence: Add proper setup/teardown, avoid global state');
    }
    
    if (score.antiPatterns && score.antiPatterns.length > 0) {
      for (const pattern of score.antiPatterns) {
        suggestions.push(`Fix ${pattern.type}: ${pattern.suggestion}`);
      }
    }
    
    return suggestions;
  }
}



























