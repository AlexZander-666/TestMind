/**
 * SkillRegistry - 技能注册表
 * 
 * 管理所有测试技能的注册、发现和执行
 */

import type { SkillMetadata, SkillLoadOptions, TestSkill } from '@testmind/shared';

import { getSkillFlagSnapshot, isSkillInExperiment } from './feature-flags';
import { createComponentLogger } from '../utils/logger';
import type { Skill, SkillContext } from './Skill';
import { createTestSkillAdapter, type TestSkillAdapterOptions } from './TestSkillAdapter';

const logger = createComponentLogger('SkillRegistry');

interface RegisteredSkillEntry {
  skill: Skill;
  metadata: SkillMetadata;
  source: 'core' | 'test';
}

interface RegisterSkillOptions {
  metadata?: SkillMetadata;
  enable?: boolean;
  source?: 'core' | 'test';
}

interface RegisterTestSkillOptions {
  adapter?: TestSkillAdapterOptions;
  enable?: boolean;
}

/**
 * 技能注册表
 */
export class SkillRegistry {
  private readonly skills: Map<string, RegisteredSkillEntry> = new Map();
  private readonly enabledSkills: Set<string> = new Set();

  constructor() {
    logger.debug('SkillRegistry initialized');
  }

  /**
   * 注册技能（核心 Skill 或适配后的 TestSkill）
   */
  register(skill: Skill, options: RegisterSkillOptions = {}): void {
    const name = skill.name;

    if (this.skills.has(name)) {
      logger.warn('Skill already registered, overwriting', { name });
    }

    const metadata = options.metadata ?? this.createMetadataFromSkill(skill);
    const entry: RegisteredSkillEntry = {
      skill,
      metadata,
      source: options.source ?? 'core',
    };

    this.skills.set(name, entry);

    const shouldEnable = options.enable ?? true;
    if (shouldEnable) {
      this.enabledSkills.add(name);
    } else {
      this.enabledSkills.delete(name);
      logger.info('Skill registered in disabled state due to feature flag', {
        name,
        flag: getSkillFlagSnapshot(),
      });
    }

    logger.info('Skill registered', {
      name,
      version: metadata.version,
      frameworks: metadata.supportedFrameworks,
      source: entry.source,
    });
  }

  /**
   * 通过适配器注册 TestSkill
   */
  registerTestSkill(skill: TestSkill, options: RegisterTestSkillOptions = {}): void {
    const validation = this.validateSkill(skill);
    if (!validation.valid) {
      logger.error('TestSkill validation failed', {
        name: skill.metadata.name,
        errors: validation.errors,
      });
      throw new Error(`Cannot register invalid TestSkill: ${skill.metadata.name}`);
    }

    const adapter = createTestSkillAdapter(skill, options.adapter);
    const enable = options.enable ?? isSkillInExperiment(skill.metadata.name);

    this.register(adapter, {
      metadata: skill.metadata,
      enable,
      source: 'test',
    });
  }

  private createMetadataFromSkill(skill: Skill): SkillMetadata {
    return {
      name: skill.name,
      version: skill.version,
      description: skill.description,
      author: skill.author ?? 'unknown',
      supportedFrameworks: [],
      supportedLanguages: [],
    };
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
  async findSkill(context: SkillContext): Promise<Skill | null> {
    for (const [name, entry] of this.skills) {
      if (!this.enabledSkills.has(name)) {
        continue;
      }

      try {
        const canHandle = await entry.skill.canHandle(context);
        if (canHandle) {
          logger.debug('Found matching skill', {
            name,
            testType: context.testType,
            framework: context.framework,
          });
          return entry.skill;
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
  async findAllSkills(context: SkillContext): Promise<Skill[]> {
    const matches: Skill[] = [];

    for (const [name, entry] of this.skills) {
      if (!this.enabledSkills.has(name)) {
        continue;
      }

      try {
        const canHandle = await entry.skill.canHandle(context);
        if (canHandle) {
          matches.push(entry.skill);
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
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)?.skill;
  }

  /**
   * 判断技能当前是否处于启用状态
   */
  isSkillEnabled(name: string): boolean {
    return this.enabledSkills.has(name);
  }

  /**
   * 列出所有技能
   */
  listSkills(options: SkillLoadOptions = {}): SkillMetadata[] {
    let entries = Array.from(this.skills.values());

    if (options.enabledOnly) {
      entries = entries.filter(entry => this.enabledSkills.has(entry.skill.name));
    }

    if (options.filterByFramework) {
      entries = entries.filter(entry =>
        entry.metadata.supportedFrameworks.includes(options.filterByFramework!),
      );
    }

    if (options.filterByLanguage) {
      entries = entries.filter(entry =>
        entry.metadata.supportedLanguages.includes(options.filterByLanguage!),
      );
    }

    return entries.map(entry => entry.metadata);
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

    for (const entry of this.skills.values()) {
      // 统计框架
      for (const framework of entry.metadata.supportedFrameworks) {
        byFramework[framework] = (byFramework[framework] || 0) + 1;
      }

      // 统计语言
      for (const language of entry.metadata.supportedLanguages) {
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

  /**
   * 获取所有技能（包括禁用的）
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values()).map(entry => entry.skill);
  }

  /**
   * findSkillsForContext 是 findAllSkills 的别名
   */
  findSkillsForContext(context: SkillContext): Promise<Skill[]> {
    return this.findAllSkills(context);
  }

  /**
   * 获取技能数量
   */
  getSkillCount(): number {
    return this.skills.size;
  }
}

/**
 * 全局技能注册表实例
 */
export const globalSkillRegistry = new SkillRegistry();
