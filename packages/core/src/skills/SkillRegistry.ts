/**
 * SkillRegistry - 技能注册表
 * 
 * 管理所有测试技能的注册、发现和执行
 */

import type { TestSkill, SkillMetadata, SkillLoadOptions, TestContext } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('SkillRegistry');

/**
 * 技能注册表
 */
export class SkillRegistry {
  private skills: Map<string, TestSkill> = new Map();
  private enabledSkills: Set<string> = new Set();

  constructor() {
    logger.debug('SkillRegistry initialized');
  }

  /**
   * 注册技能
   */
  register(skill: TestSkill): void {
    const name = skill.metadata.name;

    if (this.skills.has(name)) {
      logger.warn('Skill already registered, overwriting', { name });
    }

    this.skills.set(name, skill);
    this.enabledSkills.add(name); // 默认启用

    logger.info('Skill registered', {
      name,
      version: skill.metadata.version,
      frameworks: skill.metadata.supportedFrameworks,
    });
  }

  /**
   * 注销技能
   */
  unregister(name: string): boolean {
    const existed = this.skills.delete(name);
    this.enabledSkills.delete(name);

    if (existed) {
      logger.info('Skill unregistered', { name });
    }

    return existed;
  }

  /**
   * 启用技能
   */
  enable(name: string): boolean {
    if (!this.skills.has(name)) {
      logger.warn('Cannot enable non-existent skill', { name });
      return false;
    }

    this.enabledSkills.add(name);
    logger.info('Skill enabled', { name });
    return true;
  }

  /**
   * 禁用技能
   */
  disable(name: string): boolean {
    const existed = this.enabledSkills.delete(name);

    if (existed) {
      logger.info('Skill disabled', { name });
    }

    return existed;
  }

  /**
   * 查找适合处理给定上下文的技能
   */
  findSkill(context: TestContext): TestSkill | null {
    for (const [name, skill] of this.skills) {
      // 跳过禁用的技能
      if (!this.enabledSkills.has(name)) {
        continue;
      }

      try {
        if (skill.canHandle(context)) {
          logger.debug('Found matching skill', {
            name,
            testType: context.testType,
            framework: context.framework,
          });
          return skill;
        }
      } catch (error) {
        logger.error('Error checking skill compatibility', { name, error });
      }
    }

    logger.warn('No skill found for context', {
      testType: context.testType,
      framework: context.framework,
    });

    return null;
  }

  /**
   * 查找所有可以处理给定上下文的技能
   */
  findAllSkills(context: TestContext): TestSkill[] {
    const matches: TestSkill[] = [];

    for (const [name, skill] of this.skills) {
      if (!this.enabledSkills.has(name)) {
        continue;
      }

      try {
        if (skill.canHandle(context)) {
          matches.push(skill);
        }
      } catch (error) {
        logger.error('Error checking skill compatibility', { name, error });
      }
    }

    logger.debug(`Found ${matches.length} matching skills`);

    return matches;
  }

  /**
   * 获取技能
   */
  getSkill(name: string): TestSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * 列出所有技能
   */
  listSkills(options: SkillLoadOptions = {}): SkillMetadata[] {
    let skills = Array.from(this.skills.values());

    // 过滤：只显示启用的
    if (options.enabledOnly) {
      skills = skills.filter(s => this.enabledSkills.has(s.metadata.name));
    }

    // 过滤：按框架
    if (options.filterByFramework) {
      skills = skills.filter(s =>
        s.metadata.supportedFrameworks.includes(options.filterByFramework!)
      );
    }

    // 过滤：按语言
    if (options.filterByLanguage) {
      skills = skills.filter(s =>
        s.metadata.supportedLanguages.includes(options.filterByLanguage!)
      );
    }

    return skills.map(s => s.metadata);
  }

  /**
   * 获取技能统计信息
   */
  getStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    byFramework: Record<string, number>;
    byLanguage: Record<string, number>;
  } {
    const byFramework: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};

    for (const skill of this.skills.values()) {
      // 统计框架
      for (const framework of skill.metadata.supportedFrameworks) {
        byFramework[framework] = (byFramework[framework] || 0) + 1;
      }

      // 统计语言
      for (const language of skill.metadata.supportedLanguages) {
        byLanguage[language] = (byLanguage[language] || 0) + 1;
      }
    }

    return {
      total: this.skills.size,
      enabled: this.enabledSkills.size,
      disabled: this.skills.size - this.enabledSkills.size,
      byFramework,
      byLanguage,
    };
  }

  /**
   * 清空所有技能
   */
  clear(): void {
    const count = this.skills.size;
    this.skills.clear();
    this.enabledSkills.clear();
    logger.info('All skills cleared', { count });
  }

  /**
   * 验证技能是否符合接口规范
   */
  validateSkill(skill: TestSkill): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查元数据
    if (!skill.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!skill.metadata.name) errors.push('Missing metadata.name');
      if (!skill.metadata.version) errors.push('Missing metadata.version');
      if (!skill.metadata.description) errors.push('Missing metadata.description');
      if (!skill.metadata.author) errors.push('Missing metadata.author');
      if (!skill.metadata.supportedFrameworks || skill.metadata.supportedFrameworks.length === 0) {
        errors.push('Missing metadata.supportedFrameworks');
      }
      if (!skill.metadata.supportedLanguages || skill.metadata.supportedLanguages.length === 0) {
        errors.push('Missing metadata.supportedLanguages');
      }
    }

    // 检查必需方法
    if (typeof skill.canHandle !== 'function') {
      errors.push('Missing canHandle method');
    }

    if (typeof skill.generateTest !== 'function') {
      errors.push('Missing generateTest method');
    }

    if (typeof skill.validateTest !== 'function') {
      errors.push('Missing validateTest method');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 全局技能注册表实例
 */
export const globalSkillRegistry = new SkillRegistry();



