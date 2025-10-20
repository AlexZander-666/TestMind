/**
 * SkillRegistry - Manages skill registration and discovery
 * Part of the extensible skill framework from 1.md
 */

import type { Skill, SkillContext, SkillMetadata } from './Skill';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private categories: Map<string, Set<string>> = new Map();

  /**
   * Register a skill
   * @param skill - The skill to register
   */
  async register(skill: Skill): Promise<void> {
    // Validate skill
    if (!skill.name) {
      throw new Error('Skill must have a name');
    }

    if (this.skills.has(skill.name)) {
      throw new Error(`Skill ${skill.name} is already registered`);
    }

    // Check dependencies (optional)
    if (skill.requiredDependencies) {
      await this.checkDependencies(skill);
    }

    // Register skill
    this.skills.set(skill.name, skill);

    // Add to category index
    if (!this.categories.has(skill.category)) {
      this.categories.set(skill.category, new Set());
    }
    this.categories.get(skill.category)!.add(skill.name);

    // Call onRegister hook if present
    if (skill.onRegister) {
      await skill.onRegister();
    }

    console.log(`[SkillRegistry] Registered skill: ${skill.name} (${skill.category})`);
  }

  /**
   * Unregister a skill
   * @param skillName - Name of the skill to unregister
   */
  async unregister(skillName: string): Promise<void> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return;
    }

    // Remove from category index
    const categorySkills = this.categories.get(skill.category);
    if (categorySkills) {
      categorySkills.delete(skillName);
    }

    // Call dispose if present
    if (skill.dispose) {
      await skill.dispose();
    }

    // Remove from registry
    this.skills.delete(skillName);

    console.log(`[SkillRegistry] Unregistered skill: ${skillName}`);
  }

  /**
   * Get a skill by name
   * @param name - Skill name
   * @returns The skill or undefined
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all registered skills
   * @returns Array of all skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   * @param category - Skill category
   * @returns Array of skills in the category
   */
  getSkillsByCategory(category: string): Skill[] {
    const skillNames = this.categories.get(category);
    if (!skillNames) {
      return [];
    }

    return Array.from(skillNames)
      .map(name => this.skills.get(name))
      .filter((skill): skill is Skill => skill !== undefined);
  }

  /**
   * Find skills that can handle a given context
   * @param context - The skill context
   * @returns Array of skills that can handle the context
   */
  async findSkillsForContext(context: SkillContext): Promise<Skill[]> {
    const matchingSkills: Skill[] = [];

    for (const skill of this.skills.values()) {
      try {
        const canHandle = await Promise.resolve(skill.canHandle(context));
        if (canHandle) {
          matchingSkills.push(skill);
        }
      } catch (error) {
        console.warn(`[SkillRegistry] Error checking if ${skill.name} can handle context:`, error);
      }
    }

    return matchingSkills;
  }

  /**
   * Get metadata for all skills
   * @returns Array of skill metadata
   */
  getSkillMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values()).map(skill => ({
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      author: skill.author,
    }));
  }

  /**
   * Check if a skill is registered
   * @param name - Skill name
   * @returns true if registered
   */
  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get number of registered skills
   * @returns Count of skills
   */
  getSkillCount(): number {
    return this.skills.size;
  }

  /**
   * Clear all registered skills
   */
  async clear(): Promise<void> {
    // Dispose all skills
    for (const skill of this.skills.values()) {
      if (skill.dispose) {
        await skill.dispose();
      }
    }

    this.skills.clear();
    this.categories.clear();
  }

  /**
   * Check skill dependencies
   * @param skill - The skill to check
   */
  private async checkDependencies(skill: Skill): Promise<void> {
    if (!skill.requiredDependencies || skill.requiredDependencies.length === 0) {
      return;
    }

    const missing: string[] = [];

    for (const dep of skill.requiredDependencies) {
      try {
        // Try to require the dependency
        require.resolve(dep);
      } catch {
        missing.push(dep);
      }
    }

    if (missing.length > 0) {
      console.warn(
        `[SkillRegistry] Warning: Skill ${skill.name} has missing dependencies: ${missing.join(', ')}`
      );
    }
  }
}

/**
 * Global skill registry instance
 */
export const globalSkillRegistry = new SkillRegistry();



