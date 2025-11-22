/**
 * Config Command: Manage configuration
 */

import chalk from 'chalk';
import { loadConfig } from '../utils/config';
import { createComponentLogger } from '../../../core/src/utils/logger';

const logger = createComponentLogger('config');

export const configCommand = async (
  action: string = 'show',
  key?: string,
  value?: string
) => {
  logger.info(chalk.bold.cyan('\n🧠 TestMind - Configuration\n'));

  const config = await loadConfig();

  if (!config) {
    logger.info(chalk.red('❌ TestMind is not initialized in this project.\n'));
    process.exit(1);
  }

  switch (action) {
    case 'show':
      displayConfig(config);
      break;
    
    case 'set':
      if (!key || !value) {
        logger.info(chalk.red('❌ Key and value required for set action\n'));
        process.exit(1);
      }
      logger.info(chalk.yellow('⚠️  Config set not yet implemented\n'));
      break;
    
    case 'reset':
      logger.info(chalk.yellow('⚠️  Config reset not yet implemented\n'));
      break;
    
    default:
      logger.info(chalk.red(`❌ Unknown action: ${action}\n`));
      logger.info(chalk.gray('   Available actions: show, set, reset\n'));
      break;
  }
};

const displayConfig = (config: any) => {
  logger.info(chalk.bold('Project Configuration:'));
  logger.info(chalk.gray('─'.repeat(60)));
  logger.info(`${chalk.cyan('ID:')} ${config.id}`);
  logger.info(`${chalk.cyan('Name:')} ${config.name}`);
  logger.info(`${chalk.cyan('Language:')} ${config.language}`);
  logger.info(`${chalk.cyan('Test Framework:')} ${config.testFramework}`);
  logger.info(`${chalk.cyan('Test Directory:')} ${config.config.testDirectory}`);
  logger.info(`${chalk.cyan('Coverage Threshold:')} ${config.config.coverageThreshold}%`);
  logger.info(`${chalk.cyan('LLM Provider:')} ${config.config.llmProvider}`);
  logger.info(`${chalk.cyan('LLM Model:')} ${config.config.llmModel}`);
  logger.info(chalk.gray('─'.repeat(60)));
  logger.info();
};



























