/**
 * SkillOrchestrator - Executes skills and manages their lifecycle
 * Part of the extensible skill framework from 1.md
 * 
 * Responsibilities:
 * - Select appropriate skill(s) for a request
 * - Execute skills with proper error handling
 * - Manage diff-first workflow (show changes before applying)
 * - Coordinate multiple skills if needed
 */

import type { Skill, SkillContext, SkillResult, CodeChange } from './Skill';
import type { SkillRegistry } from './SkillRegistry';

export interface OrchestratorOptions {
  // Diff-first: Always show changes before applying
  autoApply?: boolean;
  
  // Timeout for skill execution (ms)
  timeout?: number;

  // Retry failed executions
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export class SkillOrchestrator {
  constructor(
    private registry: SkillRegistry,
    private options: OrchestratorOptions = {}
  ) {
    // Default options
    this.options = {
      autoApply: false, // Diff-first: never auto-apply
      timeout: 300000, // 5 minutes
      retryOnFailure: false,
      maxRetries: 3,
      ...options,
    };
  }

  /**
   * Execute a specific skill by name
   * @param skillName - Name of the skill to execute
   * @param context - Execution context
   * @returns Skill result
   */
  async executeSkill(skillName: string, context: SkillContext): Promise<SkillResult> {
    const skill = this.registry.getSkill(skillName);
    
    if (!skill) {
      return {
        success: false,
        message: `Skill not found: ${skillName}`,
      };
    }

    return this.executeSkillInternal(skill, context);
  }

  /**
   * Auto-select and execute the best skill for the context
   * @param context - Execution context
   * @returns Skill result
   */
  async executeAuto(context: SkillContext): Promise<SkillResult> {
    // Find skills that can handle this context
    const candidates = await this.registry.findSkillsForContext(context);

    if (candidates.length === 0) {
      return {
        success: false,
        message: 'No skill found to handle this request',
        metadata: { availableSkills: this.registry.getAllSkills().map(s => s.name) },
      };
    }

    if (candidates.length === 1) {
      // Only one skill matches, use it
      return this.executeSkillInternal(candidates[0]!, context);
    }

    // Multiple skills match - need disambiguation
    // For now, use the first one (future: prompt user or use LLM to decide)
    console.log(`[SkillOrchestrator] Multiple skills can handle request: ${candidates.map(s => s.name).join(', ')}`);
    console.log(`[SkillOrchestrator] Using: ${candidates[0]!.name}`);
    
    return this.executeSkillInternal(candidates[0]!, context);
  }

  /**
   * Execute multiple skills in sequence
   * @param skillNames - Array of skill names
   * @param context - Execution context
   * @returns Array of skill results
   */
  async executeSequence(skillNames: string[], context: SkillContext): Promise<SkillResult[]> {
    const results: SkillResult[] = [];

    for (const skillName of skillNames) {
      const result = await this.executeSkill(skillName, context);
      results.push(result);

      // Stop on first failure (unless configured otherwise)
      if (!result.success) {
        console.warn(`[SkillOrchestrator] Skill ${skillName} failed, stopping sequence`);
        break;
      }
    }

    return results;
  }

  /**
   * Preview what a skill would do without executing
   * @param skillName - Name of the skill
   * @param context - Execution context
   * @returns Preview description
   */
  async previewSkill(skillName: string, context: SkillContext): Promise<string> {
    const skill = this.registry.getSkill(skillName);
    
    if (!skill) {
      return `Skill not found: ${skillName}`;
    }

    if (skill.preview) {
      return skill.preview(context);
    }

    return `${skill.name}: ${skill.description}`;
  }

  /**
   * Internal skill execution with error handling and lifecycle
   */
  private async executeSkillInternal(skill: Skill, context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      console.log(`[SkillOrchestrator] Executing skill: ${skill.name}`);

      // Validate context
      if (skill.validate) {
        const validationError = await skill.validate(context);
        if (validationError) {
          return {
            success: false,
            message: `Validation failed: ${validationError}`,
          };
        }
      }

      // beforeExecute hook
      if (skill.beforeExecute) {
        await skill.beforeExecute(context);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(skill, context);

      // Add duration
      result.duration = Date.now() - startTime;

      // afterExecute hook
      if (skill.afterExecute) {
        await skill.afterExecute(context, result);
      }

      // Diff-first: Show changes for review
      if (result.changes && result.changes.length > 0) {
        await this.showDiffForReview(result.changes);
      }

      console.log(`[SkillOrchestrator] Skill completed: ${skill.name} (${result.duration}ms)`);
      
      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SkillOrchestrator] Skill failed: ${skill.name}`, error);

      return {
        success: false,
        message: `Skill execution failed: ${error.message}`,
        duration,
        metadata: {
          error: error.message,
          stack: error.stack,
        },
      };
    }
  }

  /**
   * Execute skill with timeout
   */
  private async executeWithTimeout(skill: Skill, context: SkillContext): Promise<SkillResult> {
    const timeout = this.options.timeout || 300000;

    return Promise.race([
      skill.execute(context),
      new Promise<SkillResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Skill execution timeout after ${timeout}ms`)), timeout);
      }),
    ]);
  }

  /**
   * Show diff for user review (Diff-First principle)
   * This is a placeholder - actual implementation would show interactive diff
   */
  private async showDiffForReview(changes: CodeChange[]): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('📝 Proposed Changes (Diff-First Review)');
    console.log('='.repeat(80) + '\n');

    for (const change of changes) {
      console.log(`${change.type.toUpperCase()}: ${change.path}`);
      if (change.description) {
        console.log(`  ${change.description}`);
      }
      if (change.diff) {
        console.log(change.diff);
      }
      console.log();
    }

    console.log('='.repeat(80));
    console.log('Review changes above before applying');
    console.log('Use /apply to commit, /reject to discard');
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Apply changes (commit to Git)
   * This integrates with GitAutomation
   */
  async applyChanges(changes: CodeChange[]): Promise<void> {
    // TODO: Integrate with GitAutomation
    console.log(`[SkillOrchestrator] Applying ${changes.length} changes...`);
    
    // Write files
    // Create Git commit
    // Return branch info
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): {
    registeredSkills: number;
    executionHistory: number;
  } {
    return {
      registeredSkills: this.registry.getSkillCount(),
      executionHistory: 0, // TODO: Track execution history
    };
  }
}



