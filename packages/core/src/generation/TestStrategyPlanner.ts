/**
 * TestStrategyPlanner: Determine testing strategy based on code analysis
 */

import type { FunctionContext, TestStrategy, BoundaryCondition, EdgeCase } from '@testmind/shared';

export class TestStrategyPlanner {
  /**
   * Plan unit test strategy
   */
  async planUnitTest(context: FunctionContext): Promise<TestStrategy> {
    console.log(`[TestStrategyPlanner] Planning test for: ${context.signature.name}`);

    // Analyze function characteristics
    const isComplex = context.complexity.cyclomaticComplexity > 5;
    const hasSideEffects = context.sideEffects.length > 0;
    const hasMultipleParams = context.signature.parameters.length > 2;

    // Decide test approach
    const strategyType = this.decideStrategyType(isComplex, hasMultipleParams);

    // Identify boundary conditions
    const boundaryConditions = this.identifyBoundaryConditions(context);

    // Identify edge cases
    const edgeCases = this.identifyEdgeCases(context);

    // Determine mock strategy
    const mockStrategy = this.determineMockStrategy(context);

    return {
      type: strategyType,
      boundaryConditions,
      edgeCases,
      mockStrategy,
    };
  }

  /**
   * Decide which test pattern to use
   */
  private decideStrategyType(
    isComplex: boolean,
    hasMultipleParams: boolean
  ): TestStrategy['type'] {
    if (hasMultipleParams) {
      return 'table-driven'; // Use parameterized tests
    }
    if (isComplex) {
      return 'AAA'; // Arrange-Act-Assert for clarity
    }
    return 'AAA'; // Default to AAA pattern
  }

  /**
   * Identify boundary conditions to test
   */
  private identifyBoundaryConditions(context: FunctionContext): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    for (const param of context.signature.parameters) {
      const paramType = param.type?.toLowerCase() || 'unknown';

      if (paramType.includes('string')) {
        conditions.push({
          parameter: param.name,
          values: ['', 'a', 'very long string...'],
          reasoning: 'Test empty, single char, and long strings',
        });
      } else if (paramType.includes('number') || paramType.includes('int')) {
        conditions.push({
          parameter: param.name,
          values: [0, -1, 1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
          reasoning: 'Test zero, negative, positive, and boundary values',
        });
      } else if (paramType.includes('array') || paramType.includes('[]')) {
        conditions.push({
          parameter: param.name,
          values: [[], [1], [1, 2, 3]],
          reasoning: 'Test empty, single element, and multiple elements',
        });
      } else if (paramType.includes('boolean')) {
        conditions.push({
          parameter: param.name,
          values: [true, false],
          reasoning: 'Test both boolean states',
        });
      } else if (param.optional) {
        conditions.push({
          parameter: param.name,
          values: [undefined, null],
          reasoning: 'Test optional parameter with undefined/null',
        });
      }
    }

    return conditions;
  }

  /**
   * Identify edge cases and error scenarios
   */
  private identifyEdgeCases(context: FunctionContext): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];

    // Check for async functions
    if (context.signature.isAsync) {
      edgeCases.push({
        scenario: 'Promise rejection',
        input: 'Invalid input causing rejection',
        expectedBehavior: 'Should reject with appropriate error',
      });
    }

    // Check for side effects
    if (context.sideEffects.length > 0) {
      for (const sideEffect of context.sideEffects) {
        edgeCases.push({
          scenario: `${sideEffect.type} failure`,
          input: `Input causing ${sideEffect.type} operation to fail`,
          expectedBehavior: `Should handle ${sideEffect.type} error gracefully`,
        });
      }
    }

    // Check for null/undefined handling
    const hasOptionalParams = context.signature.parameters.some((p) => p.optional);
    if (hasOptionalParams) {
      edgeCases.push({
        scenario: 'Null/undefined parameters',
        input: 'null or undefined for optional params',
        expectedBehavior: 'Should handle gracefully or throw appropriate error',
      });
    }

    return edgeCases;
  }

  /**
   * Determine mocking strategy
   * Fixed: Pure functions don't need mocking
   */
  private determineMockStrategy(context: FunctionContext): TestStrategy['mockStrategy'] {
    const externalDeps = context.dependencies.filter((d) => d.type === 'external');
    const hasSideEffects = context.sideEffects.length > 0;

    // Fix: Check if this is a pure function
    const isPureFunction = !hasSideEffects && externalDeps.length === 0;

    if (isPureFunction) {
      // Pure functions don't need any mocking
      console.log('[TestStrategyPlanner] Pure function detected, no mocking needed');
      return {
        dependencies: [],
        mockType: 'partial',
        mockData: {},
      };
    }

    // If function has I/O side effects, we should mock them
    const mockType = hasSideEffects ? 'full' : 'partial';

    // Identify which dependencies to mock
    const depsToMock = [
      ...externalDeps.map((d) => d.name),
      ...context.sideEffects.map((se) => se.type),
    ];

    return {
      dependencies: [...new Set(depsToMock)], // Remove duplicates
      mockType,
      mockData: {}, // TODO: Generate realistic mock data
    };
  }
}















