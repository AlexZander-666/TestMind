/**
 * Heal Command: Auto-heal failing tests
 * 
 * Analyzes test failures and suggests/applies fixes using the self-healing engine
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { 
  FailureClassifier,
  FixSuggester,
  LocatorEngine,
  type TestFailure,
  type FixContext,
  LLMService
} from '@testmind/core';
import { loadConfig } from '../utils/config';
import { TestReviewer } from '@testmind/core';

export interface HealOptions {
  /** Test file to heal */
  file?: string;
  
  /** Automatically apply fixes without review */
  auto?: boolean;
  
  /** Only analyze, don't suggest fixes */
  analyzeOnly?: boolean;
  
  /** Enable LLM-powered fix suggestions */
  useLLM?: boolean;
}

export const healCommand = async (testFile: string | undefined, options: HealOptions) => {
  console.log(chalk.bold.cyan('\n🔧 TestMind - Self-Healing Test Engine\n'));

  // Check API key if LLM is needed
  if (options.useLLM && !process.env.OPENAI_API_KEY) {
    console.log(chalk.yellow('⚠️  OPENAI_API_KEY not set. LLM-powered suggestions disabled.\n'));
    console.log(chalk.gray('Set your key for enhanced suggestions:'));
    console.log(chalk.cyan('  export OPENAI_API_KEY=sk-your-key-here\n'));
    options.useLLM = false;
  }

  const spinner = ora('Loading configuration...').start();
  const config = await loadConfig();
  
  if (!config) {
    spinner.fail('Not initialized');
    console.log(chalk.red('\n❌ TestMind is not initialized in this project.'));
    console.log(chalk.gray('   Run: testmind init\n'));
    process.exit(1);
  }

  try {
    // Initialize self-healing engines
    spinner.text = 'Initializing self-healing engines...';
    
    const llmService = options.useLLM ? new LLMService() : undefined;
    const classifier = new FailureClassifier(llmService);
    const suggester = new FixSuggester(llmService);
    const locatorEngine = new LocatorEngine();
    
    spinner.succeed('Self-healing engines ready');

    // Parse test failures
    spinner.start('Analyzing test failures...');
    
    const failures = await parseTestFailures(testFile);
    
    if (failures.length === 0) {
      spinner.succeed('No test failures detected');
      console.log(chalk.green('\n✨ All tests are passing! Nothing to heal.\n'));
      return;
    }

    spinner.succeed(`Found ${failures.length} test failure(s)`);
    console.log('');

    // Process each failure
    for (let i = 0; i < failures.length; i++) {
      const failure = failures[i];
      
      console.log(chalk.bold(`\n📋 Failure ${i + 1}/${failures.length}: ${failure.testName}`));
      console.log(chalk.gray(`   File: ${failure.testFile}`));
      console.log(chalk.gray(`   Error: ${failure.errorMessage}`));

      // Classify the failure
      const classificationSpinner = ora('Classifying failure...').start();
      const classification = await classifier.classify(failure);
      
      classificationSpinner.succeed(`Classification: ${getFailureTypeLabel(classification.failureType)}`);
      console.log(chalk.gray(`   Confidence: ${(classification.confidence * 100).toFixed(0)}%`));
      console.log(chalk.gray(`   Reason: ${classification.reasoning}`));
      
      if (classification.isFlaky) {
        console.log(chalk.yellow('   ⚠️  Detected as FLAKY test (unstable history)'));
      }

      if (options.analyzeOnly) {
        console.log(chalk.gray('\n   Suggested actions:'));
        classification.suggestedActions.forEach((action, idx) => {
          console.log(chalk.gray(`   ${idx + 1}. ${action}`));
        });
        continue;
      }

      // Generate fix suggestions
      const fixSpinner = ora('Generating fix suggestions...').start();
      
      const context: FixContext = {
        testCode: await readTestFile(failure.testFile),
        currentSelector: failure.selector,
        failureClassification: classification
      };

      // If it's a selector issue, find alternatives
      if (failure.selector && classification.failureType === 'test_fragility') {
        context.alternativeSelectors = await locatorEngine.suggestAlternativeLocators({
          cssSelector: failure.selector
        });
      }

      const suggestions = await suggester.suggestFixes(failure, context);
      
      if (suggestions.length === 0) {
        fixSpinner.warn('No automatic fixes available');
        console.log(chalk.gray('   Manual investigation required\n'));
        continue;
      }

      fixSpinner.succeed(`Generated ${suggestions.length} fix suggestion(s)`);

      // Show and apply suggestions
      for (let j = 0; j < Math.min(suggestions.length, 3); j++) {
        const suggestion = suggestions[j];
        
        console.log(chalk.bold.cyan(`\n   💡 Suggestion ${j + 1}: ${suggestion.description}`));
        console.log(chalk.gray(`      Type: ${suggestion.type}`));
        console.log(chalk.gray(`      Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`));
        console.log(chalk.gray(`      Effort: ${suggestion.estimatedEffort}`));
        console.log(chalk.gray(`      Reason: ${suggestion.reasoning}`));

        // Show diff
        console.log(chalk.bold('\n   📝 Proposed Changes:'));
        console.log(formatDiff(suggestion.diff));

        if (!options.auto) {
          // Use TestReviewer for interactive approval
          const reviewer = new TestReviewer();
          const decision = await reviewer.reviewTest(
            suggestion.diff,
            {
              testName: failure.testName,
              framework: config.testFramework || 'vitest',
              metadata: {
                fixType: suggestion.type,
                confidence: suggestion.confidence
              }
            }
          );

          if (decision.action === 'accept') {
            await applyFix(failure.testFile, suggestion.diff);
            console.log(chalk.green('   ✅ Fix applied successfully\n'));
            break; // Only apply one fix per failure
          } else if (decision.action === 'reject') {
            console.log(chalk.yellow('   ⏭️  Skipped\n'));
            continue;
          }
        } else {
          // Auto-apply mode
          if (suggestion.confidence >= 0.8) {
            await applyFix(failure.testFile, suggestion.diff);
            console.log(chalk.green('   ✅ Auto-applied (high confidence)\n'));
            break;
          } else {
            console.log(chalk.yellow('   ⏭️  Skipped (confidence too low for auto-apply)\n'));
          }
        }
      }

      if (suggestions.length > 3) {
        console.log(chalk.gray(`\n   ... and ${suggestions.length - 3} more suggestions\n`));
      }
    }

    console.log(chalk.bold.green('\n✨ Self-healing complete!\n'));

  } catch (error: any) {
    spinner.fail('Healing failed');
    console.error(chalk.red('\n❌ Error:'), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
};

/**
 * Parse test failures from test output or file
 */
async function parseTestFailures(testFile?: string): Promise<TestFailure[]> {
  // TODO: Implement actual test failure parsing
  // This should:
  // 1. Read test output from CI/local test runs
  // 2. Parse vitest/jest output format
  // 3. Extract error messages, stack traces, etc.
  
  // For now, return mock data for demonstration
  if (testFile) {
    return [
      {
        testName: 'Example failing test',
        testFile: testFile,
        errorMessage: 'Element not found: .submit-button',
        stackTrace: `at click (${testFile}:45:12)`,
        timestamp: new Date(),
        selector: '.submit-button'
      }
    ];
  }

  return [];
}

/**
 * Read test file content
 */
async function readTestFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Could not read ${filePath}`));
    return '';
  }
}

/**
 * Apply fix to test file
 */
async function applyFix(filePath: string, diff: string): Promise<void> {
  // TODO: Implement actual patch application
  // This should:
  // 1. Parse the diff
  // 2. Apply changes to the file
  // 3. Write back to disk
  // 4. Optionally create a git commit
  
  console.log(chalk.gray(`   Applying fix to ${filePath}...`));
  
  // For now, just log (actual implementation needed)
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Format diff for terminal display
 */
function formatDiff(diff: string): string {
  return diff
    .split('\n')
    .map(line => {
      if (line.startsWith('+')) {
        return chalk.green(line);
      } else if (line.startsWith('-')) {
        return chalk.red(line);
      } else if (line.startsWith('@@')) {
        return chalk.cyan(line);
      } else {
        return chalk.gray(line);
      }
    })
    .join('\n');
}

/**
 * Get human-readable failure type label
 */
function getFailureTypeLabel(type: string): string {
  switch (type) {
    case 'environment':
      return chalk.yellow('Environment Issue');
    case 'real_bug':
      return chalk.red('Real Bug');
    case 'test_fragility':
      return chalk.blue('Test Fragility');
    default:
      return chalk.gray('Unknown');
  }
}









