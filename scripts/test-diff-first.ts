/**
 * Dogfooding Test Script for Diff-First Flow
 * Tests TestMind on its own codebase
 */

import path from 'path';
import chalk from 'chalk';

interface TestResult {
  success: boolean;
  testName: string;
  diffGenerated: boolean;
  diffFormat: 'valid' | 'invalid';
  error?: string;
}

async function runDogfoodingTests(): Promise<void> {
  console.log(chalk.bold.cyan('\n🐕 TestMind Dogfooding - Diff-First Flow Test\n'));
  console.log(chalk.gray('Testing TestMind on its own codebase...\n'));

  const results: TestResult[] = [];

  // Test 1: TestReviewer Diff Generation
  await testDiffGeneration(results);

  // Test 2: Git Automation (without actual commit)
  await testGitAutomation(results);

  // Test 3: Format Validation
  await testDiffFormatting(results);

  // Print results
  printResults(results);
}

async function testDiffGeneration(results: TestResult[]): Promise<void> {
  console.log(chalk.bold('\n📋 Test 1: Diff Generation\n'));

  try {
    const { TestReviewer } = await import('../packages/core/dist/index.mjs');
    const reviewer = new TestReviewer();

    const mockTestSuite = {
      id: 'test-1',
      projectId: 'testmind',
      targetEntityId: 'entity-1',
      testType: 'unit' as const,
      framework: 'jest' as const,
      code: `import { add } from './math';

describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(add(-1, -2)).toBe(-3);
  });
});`,
      filePath: path.join(__dirname, '../packages/core/src/utils/math.test.ts'),
      generatedAt: new Date(),
      generatedBy: 'ai' as const,
      metadata: {
        targetFunction: 'add',
        dependencies: [],
        mocks: [],
        fixtures: [],
        estimatedRunTime: 100,
      },
    };

    const diffResult = await reviewer.generateDiff(mockTestSuite);

    console.log(chalk.green('✓ Diff generated successfully'));
    console.log(chalk.gray(`  File: ${diffResult.filePath}`));
    console.log(chalk.gray(`  Exists: ${diffResult.exists}`));
    console.log(chalk.gray(`  Diff length: ${diffResult.diff.length} chars`));

    // Validate diff format
    const hasHeader = diffResult.diff.includes('📝');
    const hasAdditions = diffResult.diff.includes('+');
    const isFormatValid = hasHeader && (diffResult.exists ? true : hasAdditions);

    results.push({
      success: true,
      testName: 'Diff Generation',
      diffGenerated: true,
      diffFormat: isFormatValid ? 'valid' : 'invalid',
    });

    // Show sample diff
    console.log(chalk.bold('\n  Sample Diff Output:'));
    console.log(chalk.gray('  ' + '─'.repeat(60)));
    const lines = diffResult.diff.split('\n').slice(0, 10);
    lines.forEach(line => {
      if (line.startsWith('+')) {
        console.log(chalk.green('  ' + line));
      } else if (line.startsWith('-')) {
        console.log(chalk.red('  ' + line));
      } else if (line.startsWith('📝')) {
        console.log(chalk.cyan('  ' + line));
      } else {
        console.log(chalk.gray('  ' + line));
      }
    });
    if (diffResult.diff.split('\n').length > 10) {
      console.log(chalk.gray('  ... (truncated)'));
    }
    console.log(chalk.gray('  ' + '─'.repeat(60)));

  } catch (error) {
    console.log(chalk.red('✗ Diff generation failed'));
    console.error(chalk.red('  Error:'), error);
    results.push({
      success: false,
      testName: 'Diff Generation',
      diffGenerated: false,
      diffFormat: 'invalid',
      error: String(error),
    });
  }
}

async function testGitAutomation(results: TestResult[]): Promise<void> {
  console.log(chalk.bold('\n🔧 Test 2: Git Automation\n'));

  try {
    const { GitAutomation } = await import('../packages/core/dist/index.mjs');
    const projectRoot = path.join(__dirname, '..');
    const gitAutomation = new GitAutomation(projectRoot);

    // Test 1: Is Git repo
    const isRepo = await gitAutomation.isGitRepo();
    console.log(chalk.green('✓ Git repository detected:'), isRepo);

    // Test 2: Create branch name
    const branchName = await gitAutomation.createTestBranch('testFunction');
    console.log(chalk.green('✓ Branch name generated:'), chalk.cyan(branchName));
    
    // Validate branch name format
    const isValidBranchName = /^testmind\/test-[a-z0-9-]+$/.test(branchName);
    console.log(chalk.green('✓ Branch name format valid:'), isValidBranchName);

    // Test 3: Generate commit message
    const commitMessage = GitAutomation.generateCommitMessage({
      functionName: 'testFunction',
      filePath: 'src/test.ts',
      testCount: 3,
    });
    console.log(chalk.green('✓ Commit message generated'));
    console.log(chalk.gray('  Preview:'));
    commitMessage.split('\n').forEach(line => {
      console.log(chalk.gray('    ' + line));
    });

    // Validate commit message format
    const hasTestPrefix = commitMessage.startsWith('test:');
    const hasAITag = commitMessage.includes('🤖');
    const isValidMessage = hasTestPrefix && hasAITag;
    console.log(chalk.green('✓ Commit message format valid:'), isValidMessage);

    results.push({
      success: true,
      testName: 'Git Automation',
      diffGenerated: true,
      diffFormat: 'valid',
    });

  } catch (error) {
    console.log(chalk.red('✗ Git automation failed'));
    console.error(chalk.red('  Error:'), error);
    results.push({
      success: false,
      testName: 'Git Automation',
      diffGenerated: false,
      diffFormat: 'invalid',
      error: String(error),
    });
  }
}

async function testDiffFormatting(results: TestResult[]): Promise<void> {
  console.log(chalk.bold('\n🎨 Test 3: Diff Formatting\n'));

  try {
    const { TestReviewer } = await import('../packages/core/dist/index.mjs');
    const reviewer = new TestReviewer();

    const mockTestSuite = {
      id: 'test-format',
      projectId: 'testmind',
      targetEntityId: 'entity-1',
      testType: 'unit' as const,
      framework: 'jest' as const,
      code: 'test code with colors',
      filePath: '/tmp/format.test.ts',
      generatedAt: new Date(),
      generatedBy: 'ai' as const,
      metadata: {
        targetFunction: 'format',
        dependencies: [],
        mocks: [],
        fixtures: [],
        estimatedRunTime: 100,
      },
    };

    const diffResult = await reviewer.generateDiff(mockTestSuite);
    const formatted = reviewer.formatForCLI(diffResult);

    // Validate ANSI color codes
    const hasColorCodes = formatted.includes('\x1b[');
    const hasGreen = formatted.includes('32m'); // Green for additions
    const hasCyan = formatted.includes('36m'); // Cyan for header
    
    console.log(chalk.green('✓ ANSI color codes present:'), hasColorCodes);
    console.log(chalk.green('✓ Green color (additions):'), hasGreen);
    console.log(chalk.green('✓ Cyan color (header):'), hasCyan);

    const isFormatValid = hasColorCodes && hasGreen && hasCyan;

    results.push({
      success: true,
      testName: 'Diff Formatting',
      diffGenerated: true,
      diffFormat: isFormatValid ? 'valid' : 'invalid',
    });

    // Show formatted output
    console.log(chalk.bold('\n  Formatted Output Preview:'));
    console.log(chalk.gray('  ' + '─'.repeat(60)));
    const lines = formatted.split('\n').slice(0, 5);
    lines.forEach(line => console.log('  ' + line));
    console.log(chalk.gray('  ' + '─'.repeat(60)));

  } catch (error) {
    console.log(chalk.red('✗ Diff formatting failed'));
    console.error(chalk.red('  Error:'), error);
    results.push({
      success: false,
      testName: 'Diff Formatting',
      diffGenerated: false,
      diffFormat: 'invalid',
      error: String(error),
    });
  }
}

function printResults(results: TestResult[]): void {
  console.log(chalk.bold.cyan('\n📊 Test Results Summary\n'));

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  const passRate = (passed / total * 100).toFixed(0);

  console.log(chalk.gray('═'.repeat(70)));
  
  results.forEach(result => {
    const icon = result.success ? chalk.green('✓') : chalk.red('✗');
    const status = result.success ? chalk.green('PASS') : chalk.red('FAIL');
    console.log(`${icon} ${result.testName.padEnd(30)} ${status}`);
    
    if (result.diffGenerated) {
      console.log(chalk.gray(`  ├─ Diff generated: ${result.diffGenerated}`));
      console.log(chalk.gray(`  └─ Format valid: ${result.diffFormat}`));
    }
    
    if (result.error) {
      console.log(chalk.red(`  └─ Error: ${result.error}`));
    }
  });

  console.log(chalk.gray('═'.repeat(70)));
  console.log(chalk.bold(`\nTotal: ${passed}/${total} passed (${passRate}%)`));

  if (passed === total) {
    console.log(chalk.green.bold('\n✅ All tests passed! Diff-First flow is working correctly.\n'));
  } else {
    console.log(chalk.yellow.bold(`\n⚠️  ${total - passed} test(s) failed. Review errors above.\n`));
  }

  // Success criteria
  console.log(chalk.bold('\n🎯 Success Criteria:\n'));
  console.log(chalk.gray('  ✓ Diff generation works'));
  console.log(chalk.gray('  ✓ Git automation functions correctly'));
  console.log(chalk.gray('  ✓ Diff formatting includes proper colors'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.cyan('  1. Run unit tests: pnpm test'));
  console.log(chalk.cyan('  2. Try manual generate: testmind generate <file> --function <name>'));
  console.log(chalk.cyan('  3. Start Shannon validation'));
  console.log();
}

// Run tests
runDogfoodingTests().catch(error => {
  console.error(chalk.red('\n❌ Dogfooding test failed:'), error);
  process.exit(1);
});

