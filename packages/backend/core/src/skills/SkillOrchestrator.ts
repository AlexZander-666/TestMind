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

import {
  recordSkillExecutionOutcome,
  recordSkillSelectionLatency,
  type ExecutionMode,
} from '../metrics/skill-metrics';
import { getSkillFlagSnapshot } from './feature-flags';
import { createComponentLogger } from '../utils/logger';

import type { Skill, SkillContext, SkillResult, CodeChange } from './Skill';
import type { SkillRegistry } from './SkillRegistry';

const getSkillIdentifier = (skill: Skill | null | undefined, fallback: string = 'unknown'): string => {
  if (!skill) {
    return fallback;
  }

  if (typeof skill.name === 'string') {
    return skill.name;
  }

  return fallback;
};

const logger = createComponentLogger('SkillOrchestrator');

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
    private readonly registry: SkillRegistry,
    private readonly options: OrchestratorOptions = {},
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
    const selectionStarted = Date.now();
    const skill = this.registry.getSkill(skillName);
    const selectionDuration = Date.now() - selectionStarted;
    
    if (!skill) {
      recordSkillSelectionLatency(skillName, selectionDuration, {
        mode: 'direct',
        outcome: 'not_found',
      });
      return {
        success: false,
        message: `Skill not found: ${skillName}`,
      };
    }

    const identifier = getSkillIdentifier(skill, skillName);
    const weight = this.calculateSelectionWeight(skill, context);
    if (!this.registry.isSkillEnabled(skillName)) {
      const flagSnapshot = getSkillFlagSnapshot();
      logger.warn(`[SkillOrchestrator] Skill ${identifier} disabled by feature flag`, {
        skillName,
        flagSnapshot,
      });
      return {
        success: false,
        message: `Skill ${skillName} is disabled by SKILL_ADAPTER_EXPERIMENTAL`,
        metadata: {
          skillName,
          featureFlag: flagSnapshot,
        },
      };
    }

    recordSkillSelectionLatency(identifier, selectionDuration, {
      mode: 'direct',
      outcome: 'selected',
      weight,
    });

    return this.executeSkillInternal(skill, context, 'direct');
  }

  /**
   * Auto-select and execute the best skill for the context
   * @param context - Execution context
   * @returns Skill result
   */
  async executeAuto(context: SkillContext): Promise<SkillResult> {
    const selectionStarted = Date.now();
    const candidates = await this.registry.findSkillsForContext(context);
    const selectionDuration = Date.now() - selectionStarted;

    if (candidates.length === 0) {
      recordSkillSelectionLatency('none', selectionDuration, {
        mode: 'auto',
        outcome: 'no_candidate',
      });
      return {
        success: false,
        message: 'No skill found to handle this request',
        metadata: {
          availableSkills: this.registry
            .getAllSkills()
            .map(skill => getSkillIdentifier(skill)),
        },
      };
    }

    const scoredCandidates = candidates
      .map(skill => ({
        skill,
        identifier: getSkillIdentifier(skill, 'auto'),
        weight: this.calculateSelectionWeight(skill, context),
      }))
      .sort((a, b) => b.weight - a.weight);

    this.logCandidateWeights('auto', scoredCandidates);

    const selected = scoredCandidates[0]!;
    recordSkillSelectionLatency(selected.identifier, selectionDuration, {
      mode: 'auto',
      outcome: 'selected',
      candidate_count: scoredCandidates.length,
      weight: selected.weight,
    });
    return this.executeSkillInternal(selected.skill, context, 'auto');
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
        logger.warn(`[SkillOrchestrator] Skill ${skillName} failed, stopping sequence`);
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

    const skillAny = skill as any;
    if (skillAny.preview) {
      return skillAny.preview(context);
    }

    return `${skillAny.metadata?.name || 'unknown'}: ${skillAny.metadata?.description || 'No description'}`;
  }

  private calculateSelectionWeight(skill: Skill, context: SkillContext): number {
    let weight = 1;
    const metadata = skill.metadata;

    if (metadata) {
      if (context.framework && metadata.supportedFrameworks.includes(context.framework as any)) {
        weight += 3;
      }

      if (context.testType && metadata.tags?.includes(context.testType)) {
        weight += 1;
      }
    }

    if (context.targetFiles && context.targetFiles.length > 0) {
      weight += Math.min(context.targetFiles.length, 3);
    }

    return weight;
  }

  private logCandidateWeights(
    mode: ExecutionMode,
    candidates: Array<{ identifier: string; weight: number }>,
  ): void {
    if (candidates.length === 1) {
      logger.info('[SkillOrchestrator] Single candidate available', {
        mode,
        skill: candidates[0]!.identifier,
        weight: candidates[0]!.weight,
      });
      return;
    }

    logger.info('[SkillOrchestrator] Multiple candidates evaluated', {
      mode,
      candidates: candidates.map(candidate => candidate.identifier),
      weights: candidates.map(candidate => candidate.weight),
    });
  }

  /**
   * Internal skill execution with error handling and lifecycle
   */
  private async executeSkillInternal(
    skill: Skill,
    context: SkillContext,
    mode: ExecutionMode = 'direct',
  ): Promise<SkillResult> {
    const startTime = Date.now();
    const skillIdentifier = getSkillIdentifier(skill);

    try {
      logger.info('[SkillOrchestrator] Executing skill', {
        skill: skillIdentifier,
        mode,
        timeout: this.options.timeout,
        retryOnFailure: this.options.retryOnFailure,
        maxRetries: this.options.maxRetries,
      });

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

      recordSkillExecutionOutcome(skillIdentifier, result.success, mode);
      logger.info('[SkillOrchestrator] Skill completed', {
        skill: skillIdentifier,
        duration: result.duration,
        mode,
      });
      
      return result;

    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      logger.error('[SkillOrchestrator] Skill failed', {
        skill: skillIdentifier,
        error: normalizedError,
      });
      recordSkillExecutionOutcome(skillIdentifier, false, mode);

      return {
        success: false,
        message: `Skill execution failed: ${normalizedError.message}`,
        duration,
        metadata: {
          error: normalizedError.message,
          stack: normalizedError.stack,
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
    logger.info(`\n${'='.repeat(80)}`);
    logger.info('📝 Proposed Changes (Diff-First Review)');
    logger.info(`${'='.repeat(80)}\n`);

    for (const change of changes) {
      logger.info(`${change.type.toUpperCase()}: ${change.path}`);
      if (change.description) {
        logger.info(`  ${change.description}`);
      }
      if (change.diff) {
        logger.info(change.diff);
      }
      logger.info('');
    }

    logger.info('='.repeat(80));
    logger.info('Review changes above before applying');
    logger.info('Use /apply to commit, /reject to discard');
    logger.info(`${'='.repeat(80)}\n`);
  }

  /**
   * Apply changes (commit to Git)
   * This integrates with GitAutomation
   */
  async applyChanges(changes: CodeChange[]): Promise<void> {
    // TODO: Integrate with GitAutomation
    logger.info(`[SkillOrchestrator] Applying ${changes.length} changes...`);
    
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
