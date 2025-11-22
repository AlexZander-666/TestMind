/**
 * Skill Framework - Core Interfaces
 * Implements the extensible skill framework from 1.md strategic framework
 * 
 * Design Philosophy:
 * - Pluggable: Skills can be added without modifying core
 * - Self-contained: Each skill is independent
 * - Well-defined interfaces: Clear contracts for skill execution
 * - Composable: Skills can work together
 */

import { createComponentLogger, Logger } from '../utils/logger';

export type SkillCategory = 'testing' | 'refactoring' | 'analysis' | 'optimization' | 'documentation';

/**
 * Context passed to a skill for execution
 */
export interface SkillContext {
  // Project information
  projectPath: string;
  projectConfig: any;

  // Target files/functions
  targetFiles: string[];
  targetFunctions?: Array<{ file: string; name: string }>;

  // User request
  userPrompt: string;
  naturalLanguageRequest?: string;

  // Analysis results (if available)
  analysisResult?: any;
  
  // Hybrid context from ContextManager
  hybridContext?: any;
}

/**
 * Result returned by a skill after execution
 */
export interface SkillResult {
  // Execution status
  success: boolean;
  message: string;

  // Code changes (if any)
  changes?: CodeChange[];

  // Analysis data
  analysis?: any;

  // Metadata for logging/debugging
  metadata?: Record<string, any>;

  // Execution time
  duration?: number;
}

/**
 * A code change proposed by a skill
 */
export interface CodeChange {
  type: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
  diff?: string;
  description?: string;
}

/**
 * Skill configuration
 */
export interface SkillConfiguration {
  // LLM settings
  llmModel?: string;
  temperature?: number;
  maxTokens?: number;

  // Skill-specific settings
  [key: string]: any;
}

/**
 * Core Skill interface
 * All skills must implement this interface
 */
export interface Skill {
  // ============================================================================
  // Metadata
  // ============================================================================
  
  /** Unique skill identifier */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Skill category */
  readonly category: SkillCategory;

  /** Skill version */
  readonly version: string;

  /** Skill author/maintainer */
  readonly author?: string;

  // ============================================================================
  // Capabilities
  // ============================================================================

  /**
   * Determine if this skill can handle the given context
   * This is used by the orchestrator for skill selection
   * 
   * @param context - The skill context
   * @returns true if this skill can handle the request
   */
  canHandle(context: SkillContext): boolean | Promise<boolean>;

  /**
   * Execute the skill
   * This is the main entry point for skill execution
   * 
   * @param context - The skill context
   * @returns The skill result with changes/analysis
   */
  execute(context: SkillContext): Promise<SkillResult>;

  // ============================================================================
  // Configuration & Dependencies
  // ============================================================================

  /**
   * Required dependencies (npm packages, system tools, etc.)
   * The orchestrator can check these before execution
   */
  readonly requiredDependencies?: string[];

  /**
   * Skill configuration
   * Can be overridden by user config
   */
  configuration?: SkillConfiguration;

  // ============================================================================
  // Optional: Validation & Preview
  // ============================================================================

  /**
   * Validate context before execution
   * Returns error message if validation fails
   */
  validate?(context: SkillContext): Promise<string | null>;

  /**
   * Generate a preview of what the skill will do
   * Useful for user confirmation before execution
   */
  preview?(context: SkillContext): Promise<string>;

  // ============================================================================
  // Optional: Lifecycle Hooks
  // ============================================================================

  /**
   * Called once when skill is registered
   */
  onRegister?(): Promise<void>;

  /**
   * Called before each execution
   */
  beforeExecute?(context: SkillContext): Promise<void>;

  /**
   * Called after each execution
   */
  afterExecute?(context: SkillContext, result: SkillResult): Promise<void>;

  /**
   * Cleanup resources
   */
  dispose?(): Promise<void>;
}

/**
 * Abstract base class for skills
 * Provides common functionality and sensible defaults
 */
export abstract class BaseSkill implements Skill {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: SkillCategory;
  abstract readonly version: string;

  readonly author?: string;
  readonly requiredDependencies?: string[];
  configuration?: SkillConfiguration;
  
  protected logger!: Logger;

  /**
   * Default implementation - always returns true
   * Override this to add skill-specific logic
   */
  canHandle(context: SkillContext): boolean {
    return true;
  }

  /**
   * Main execution method - must be implemented by subclasses
   */
  abstract execute(context: SkillContext): Promise<SkillResult>;

  /**
   * Default validation - no validation
   * Override to add validation logic
   */
  async validate(context: SkillContext): Promise<string | null> {
    return null;
  }

  /**
   * Helper: Create a successful result
   */
  protected success(message: string, changes?: CodeChange[], metadata?: any): SkillResult {
    return {
      success: true,
      message,
      changes,
      metadata,
    };
  }

  /**
   * Helper: Create a failure result
   */
  protected failure(message: string, metadata?: any): SkillResult {
    return {
      success: false,
      message,
      metadata,
    };
  }

  /**
   * Helper: Log skill execution
   */
  protected log(message: string, context?: any): void {
    // Lazy initialization of logger
    if (!this.logger) {
      this.logger = createComponentLogger(`Skill:${this.name}`);
    }
    this.logger.info(message, context);
  }
}

/**
 * Skill metadata for discovery and documentation
 */
export interface SkillMetadata {
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  author?: string;
  examples?: string[];
  documentation?: string;
}



