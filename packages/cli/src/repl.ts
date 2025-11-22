/**
 * Interactive REPL Session
 * Implements the interactive CLI interface from 1.md framework
 * 
 * Features:
 * - Natural language prompts
 * - Context management commands (/add, /focus, /context)
 * - Action commands (/apply, /undo, /exit)
 * - Session persistence
 */

import readline from 'readline';
import chalk from 'chalk';
import { ContextManager } from '@testmind/core';
import { GitAutomation } from '@testmind/core';
import { loadConfig } from './utils/config';
import type { ProjectConfig } from '@testmind/shared';

interface SessionState {
  contextManager: ContextManager;
  gitAutomation: GitAutomation;
  projectPath: string;
  config: ProjectConfig;
  pendingChanges: any[];
}

export class InteractiveSession {
  private rl: readline.Interface;
  private state: SessionState | null = null;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('testmind> '),
    });
  }

  /**
   * Start the interactive session
   */
  async start(): Promise<void> {
    try {
      // Initialize session
      await this.initialize();

      // Display welcome message
      this.showWelcome();

      // Start REPL loop
      this.rl.prompt();

      this.rl.on('line', async (line) => {
        const input = line.trim();

        if (!input) {
          this.rl.prompt();
          return;
        }

        try {
          await this.handleCommand(input);
        } catch (error: any) {
          console.error(chalk.red('Error:'), error.message);
        }

        this.rl.prompt();
      });

      this.rl.on('close', async () => {
        await this.cleanup();
        console.log(chalk.blue('\n👋 Goodbye!'));
        process.exit(0);
      });

    } catch (error: any) {
      console.error(chalk.red('Failed to start session:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Initialize session state
   */
  private async initialize(): Promise<void> {
    const projectPath = process.cwd();
    const config = await loadConfig();

    const contextManager = new ContextManager(config, projectPath);
    const gitAutomation = new GitAutomation(projectPath);

    this.state = {
      contextManager,
      gitAutomation,
      projectPath,
      config,
      pendingChanges: [],
    };
  }

  /**
   * Show welcome message
   */
  private showWelcome(): void {
    console.log(chalk.bold('\n🧠 TestMind Interactive Session\n'));
    console.log('Type ' + chalk.cyan('/help') + ' for available commands\n');
  }

  /**
   * Handle user input
   */
  private async handleCommand(input: string): Promise<void> {
    if (!this.state) {
      throw new Error('Session not initialized');
    }

    // Command handling
    if (input.startsWith('/')) {
      await this.handleSlashCommand(input);
    } else {
      // Natural language processing (to be implemented)
      await this.handleNaturalLanguage(input);
    }
  }

  /**
   * Handle slash commands
   */
  private async handleSlashCommand(input: string): Promise<void> {
    const parts = input.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case '/help':
        this.showHelp();
        break;

      case '/add':
        if (args.length === 0) {
          console.log(chalk.yellow('Usage: /add <file>'));
          break;
        }
        await this.state!.contextManager.addToContext(args[0]!);
        console.log(chalk.green(`✓ Added to context: ${args[0]}`));
        break;

      case '/focus':
        if (args.length === 0) {
          console.log(chalk.yellow('Usage: /focus <file>::<function>'));
          break;
        }
        const [file, func] = args[0]!.split('::');
        if (!file || !func) {
          console.log(chalk.yellow('Usage: /focus <file>::<function>'));
          break;
        }
        await this.state!.contextManager.focusOn(file, func);
        console.log(chalk.green(`✓ Focused on: ${file}::${func}`));
        break;

      case '/context':
        const snapshot = this.state!.contextManager.getCurrentContext();
        console.log(snapshot.message);
        break;

      case '/clear':
        this.state!.contextManager.clearContext();
        console.log(chalk.green('✓ Context cleared'));
        break;

      case '/apply':
        await this.applyPendingChanges();
        break;

      case '/undo':
        await this.undoLastCommit();
        break;

      case '/status':
        await this.showStatus();
        break;

      case '/exit':
      case '/quit':
        this.rl.close();
        break;

      default:
        console.log(chalk.yellow(`Unknown command: ${command}`));
        console.log(chalk.gray('Type /help for available commands'));
    }
  }

  /**
   * Handle natural language input
   */
  private async handleNaturalLanguage(input: string): Promise<void> {
    console.log(chalk.blue('💭 Processing:'), input);
    
    // Build hybrid context
    const hybridContext = await this.state!.contextManager.buildHybridContext(input);
    
    console.log(chalk.gray(`Context: ${hybridContext.contextSize}`));
    
    // TODO: Implement LLM integration for natural language processing
    // For now, show what would be sent to LLM
    console.log(chalk.yellow('\n⚠️  Natural language processing not yet implemented'));
    console.log(chalk.gray('This will be connected to LLM in the next phase'));
    console.log(chalk.gray('\nFor now, please use slash commands:'));
    console.log(chalk.gray('  /add <file>          - Add file to context'));
    console.log(chalk.gray('  /focus <file>::<fn>  - Focus on function'));
    console.log(chalk.gray('  /context             - Show current context'));
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(chalk.bold('\n📖 Available Commands:\n'));
    
    console.log(chalk.cyan('Context Management:'));
    console.log('  /add <file>           Add file to context');
    console.log('  /focus <file>::<fn>   Focus on specific function');
    console.log('  /context              Show current context');
    console.log('  /clear                Clear all context\n');
    
    console.log(chalk.cyan('Actions:'));
    console.log('  /apply                Apply pending changes');
    console.log('  /undo                 Undo last commit');
    console.log('  /status               Show session status\n');
    
    console.log(chalk.cyan('Session:'));
    console.log('  /help                 Show this help');
    console.log('  /exit, /quit          Exit session\n');
    
    console.log(chalk.gray('Natural Language:'));
    console.log(chalk.gray('  Just type your request in plain English (coming soon)'));
    console.log(chalk.gray('  Example: "generate tests for add function"\n'));
  }

  /**
   * Apply pending changes (commit to Git)
   */
  private async applyPendingChanges(): Promise<void> {
    if (this.state!.pendingChanges.length === 0) {
      console.log(chalk.yellow('No pending changes to apply'));
      return;
    }

    console.log(chalk.blue('Applying changes...'));
    
    // TODO: Implement change application logic
    console.log(chalk.yellow('⚠️  Change application not yet implemented'));
  }

  /**
   * Undo last commit
   */
  private async undoLastCommit(): Promise<void> {
    const result = await this.state!.gitAutomation.undoLastCommit();
    
    if (result.success) {
      console.log(chalk.green('✓ ' + result.message));
    } else {
      console.log(chalk.yellow(result.message));
    }
  }

  /**
   * Show current session status
   */
  private async showStatus(): Promise<void> {
    console.log(chalk.bold('\n📊 Session Status:\n'));
    
    // Context status
    const snapshot = this.state!.contextManager.getCurrentContext();
    console.log(chalk.cyan('Context:'));
    console.log(`  Files: ${snapshot.explicitFiles.length}`);
    console.log(`  Focus points: ${snapshot.focusPoints.length}`);
    console.log(`  Estimated tokens: ${snapshot.totalTokens.toLocaleString()}\n`);
    
    // Git status
    console.log(chalk.cyan('Git:'));
    const currentBranch = await this.state!.gitAutomation.getCurrentBranch();
    console.log(`  Branch: ${currentBranch}`);
    const hasChanges = await this.state!.gitAutomation.hasUncommittedChanges();
    console.log(`  Uncommitted changes: ${hasChanges ? 'Yes' : 'No'}\n`);
    
    // Pending changes
    console.log(chalk.cyan('Pending:'));
    console.log(`  Changes to apply: ${this.state!.pendingChanges.length}\n`);
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.state) {
      await this.state.contextManager.dispose();
    }
  }
}

/**
 * Start interactive session
 */
export async function startInteractiveSession(): Promise<void> {
  const session = new InteractiveSession();
  await session.start();
}



