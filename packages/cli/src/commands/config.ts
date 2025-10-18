/**
 * Config Command: Manage configuration
 */

import chalk from 'chalk';
import { loadConfig } from '../utils/config';

export const configCommand = async (
  action: string = 'show',
  key?: string,
  value?: string
) => {
  console.log(chalk.bold.cyan('\n🧠 TestMind - Configuration\n'));

  const config = await loadConfig();

  if (!config) {
    console.log(chalk.red('❌ TestMind is not initialized in this project.\n'));
    process.exit(1);
  }

  switch (action) {
    case 'show':
      displayConfig(config);
      break;
    
    case 'set':
      if (!key || !value) {
        console.log(chalk.red('❌ Key and value required for set action\n'));
        process.exit(1);
      }
      console.log(chalk.yellow('⚠️  Config set not yet implemented\n'));
      break;
    
    case 'reset':
      console.log(chalk.yellow('⚠️  Config reset not yet implemented\n'));
      break;
    
    default:
      console.log(chalk.red(`❌ Unknown action: ${action}\n`));
      console.log(chalk.gray('   Available actions: show, set, reset\n'));
      break;
  }
};

const displayConfig = (config: any) => {
  console.log(chalk.bold('Project Configuration:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`${chalk.cyan('ID:')} ${config.id}`);
  console.log(`${chalk.cyan('Name:')} ${config.name}`);
  console.log(`${chalk.cyan('Language:')} ${config.language}`);
  console.log(`${chalk.cyan('Test Framework:')} ${config.testFramework}`);
  console.log(`${chalk.cyan('Test Directory:')} ${config.config.testDirectory}`);
  console.log(`${chalk.cyan('Coverage Threshold:')} ${config.config.coverageThreshold}%`);
  console.log(`${chalk.cyan('LLM Provider:')} ${config.config.llmProvider}`);
  console.log(`${chalk.cyan('LLM Model:')} ${config.config.llmModel}`);
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
};



























