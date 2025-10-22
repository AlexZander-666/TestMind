/**
 * IdLocator - 基于ID属性的元素定位器
 * 
 * 这是最快最可靠的定位策略，优先使用测试专用ID属性
 * 
 * 优先级顺序：
 * 1. data-testid (最高，专为测试设计)
 * 2. data-cy (Cypress惯例)
 * 3. data-pw (Playwright惯例)
 * 4. id (标准HTML ID)
 * 5. name (表单元素)
 * 6. aria-label (可访问性属性)
 */

import type { ElementDescriptor, LocatorResult } from '../LocatorEngine';
import type { BrowserContext } from '../adapters/BrowserAdapter';

export interface IdLocatorConfig {
  /** ID属性优先级列表 */
  idAttributes?: string[];
  /** 最小置信度阈值 */
  minConfidence?: number;
}

/**
 * ID定位器 - 最快最可靠的定位策略
 */
export class IdLocator {
  private config: Required<IdLocatorConfig>;
  
  /**
   * 默认ID属性优先级
   */
  private static readonly DEFAULT_ID_ATTRIBUTES = [
    'data-testid',   // 1.00 - 测试专用，最稳定
    'data-cy',       // 0.95 - Cypress惯例
    'data-pw',       // 0.95 - Playwright惯例
    'data-test',     // 0.95 - 通用测试ID
    'id',            // 0.90 - 标准HTML ID（可能非唯一）
    'name',          // 0.85 - 表单元素name属性
    'aria-label',    // 0.80 - 可访问性标签
    'aria-labelledby', // 0.75 - 可访问性引用
  ];

  /**
   * 属性置信度映射
   */
  private static readonly CONFIDENCE_SCORES: Record<string, number> = {
    'data-testid': 1.00,
    'data-cy': 0.95,
    'data-pw': 0.95,
    'data-test': 0.95,
    'id': 0.90,
    'name': 0.85,
    'aria-label': 0.80,
    'aria-labelledby': 0.75,
  };

  constructor(config: IdLocatorConfig = {}) {
    this.config = {
      idAttributes: config.idAttributes || IdLocator.DEFAULT_ID_ATTRIBUTES,
      minConfidence: config.minConfidence ?? 0.7,
    };
  }

  /**
   * 尝试通过ID属性定位元素
   */
  async locate(descriptor: ElementDescriptor, context?: BrowserContext): Promise<LocatorResult | null> {
    // 1. 如果描述符中直接指定了ID
    if (descriptor.id) {
      const result = await this.locateById(descriptor.id, context);
      if (result && result.confidence >= this.config.minConfidence) {
        return result;
      }
    }

    // 2. 从属性中提取ID值并尝试定位
    if (descriptor.attributes) {
      for (const attr of this.config.idAttributes) {
        const value = descriptor.attributes[attr];
        if (value) {
          const result = await this.locateByAttribute(attr, value, context);
          if (result && result.confidence >= this.config.minConfidence) {
            return result;
          }
        }
      }
    }

    return null;
  }

  /**
   * 通过ID值定位元素
   */
  private async locateById(id: string, context?: BrowserContext): Promise<LocatorResult | null> {
    if (!id || id.trim() === '') {
      return null;
    }

    // 使用浏览器适配器查找元素
    const element = context 
      ? await context.adapter.findElement(`#${id}`)
      : await this.findElementFallback('id', id);
    
    if (!element) {
      return null;
    }

    // 检查是否唯一
    const isUnique = context 
      ? await context.adapter.isUnique(`#${id}`)
      : this.checkUniqueness(null, 'id', id);
    
    // 基础置信度
    let confidence = IdLocator.CONFIDENCE_SCORES['id'] || 0.90;
    
    // 唯一性调整
    if (isUnique) {
      confidence = Math.min(1.0, confidence + 0.05);
    } else {
      confidence = Math.max(0.5, confidence - 0.15);
    }

    return {
      element,
      strategy: 'id' as any, // LocatorStrategy.ID
      confidence,
      metadata: {
        attribute: 'id',
        value: id,
        isUnique,
        selector: `#${id}`
      },
    };
  }

  /**
   * 通过特定属性定位元素
   */
  private async locateByAttribute(
    attribute: string,
    value: string,
    context?: BrowserContext
  ): Promise<LocatorResult | null> {
    if (!value || value.trim() === '') {
      return null;
    }

    // 生成选择器
    const selector = IdLocator.generateSelector(attribute, value);

    // 使用浏览器适配器查找元素
    const element = context 
      ? await context.adapter.findElement(selector)
      : await this.findElementFallback(attribute, value);
    
    if (!element) {
      return null;
    }

    // 检查唯一性
    const isUnique = context 
      ? await context.adapter.isUnique(selector)
      : this.checkUniqueness(null, attribute, value);
    
    // 基础置信度
    let confidence = IdLocator.CONFIDENCE_SCORES[attribute] || 0.70;
    
    // 唯一性调整
    if (isUnique) {
      confidence = Math.min(1.0, confidence + 0.05);
    } else {
      confidence = Math.max(0.5, confidence - 0.15);
    }

    // 测试专用属性奖励
    if (attribute.startsWith('data-test') || attribute.startsWith('data-cy') || attribute.startsWith('data-pw')) {
      confidence = Math.min(1.0, confidence + 0.02);
    }

    return {
      element,
      strategy: 'id' as any, // LocatorStrategy.ID
      confidence,
      metadata: {
        attribute,
        value,
        isUnique,
        selector
      },
    };
  }

  /**
   * 回退方法：在没有浏览器上下文时查找元素（用于测试）
   */
  private async findElementFallback(attribute: string, value: string): Promise<any> {
    // 测试环境回退
    if (process.env.NODE_ENV === 'test') {
      return {
        _raw: {
          [attribute]: value,
          _mock: true,
        },
        tagName: 'div',
        metadata: { framework: 'mock' }
      };
    }

    // 生产环境必须提供浏览器上下文
    return null;
  }

  /**
   * 检查属性值的唯一性（回退方法）
   */
  private checkUniqueness(context: any, attribute: string, value: string): boolean {
    // 测试专用属性通常是唯一的
    if (attribute.startsWith('data-test') || attribute === 'id') {
      return true;
    }

    // name属性可能不唯一（单选框、复选框）
    if (attribute === 'name') {
      return false;
    }

    // 默认假设唯一
    return true;
  }

  /**
   * 生成选择器字符串
   */
  static generateSelector(attribute: string, value: string): string {
    if (attribute === 'id') {
      return `#${value}`;
    }
    return `[${attribute}="${value}"]`;
  }

  /**
   * 从元素生成描述符
   */
  static extractDescriptor(element: any): ElementDescriptor {
    const descriptor: ElementDescriptor = {
      attributes: {},
    };

    // 提取所有可能的ID属性
    for (const attr of IdLocator.DEFAULT_ID_ATTRIBUTES) {
      if (element[attr] || element.getAttribute?.(attr)) {
        const value = element[attr] || element.getAttribute(attr);
        if (descriptor.attributes) {
          descriptor.attributes[attr] = value;
        }
        
        // 优先使用最高优先级的属性作为主ID
        if (!descriptor.id && attr === 'data-testid') {
          descriptor.id = value;
        }
      }
    }

    // 如果没有data-testid，使用标准id
    if (!descriptor.id && element.id) {
      descriptor.id = element.id;
    }

    return descriptor;
  }

  /**
   * 验证ID值的有效性
   */
  static validateId(id: string): { valid: boolean; reason?: string } {
    if (!id || typeof id !== 'string') {
      return { valid: false, reason: 'ID must be a non-empty string' };
    }

    if (id.trim() === '') {
      return { valid: false, reason: 'ID cannot be whitespace only' };
    }

    if (id.length > 255) {
      return { valid: false, reason: 'ID too long (max 255 characters)' };
    }

    // HTML ID规范：必须至少包含一个字符，不能包含空格
    if (/\s/.test(id)) {
      return { valid: false, reason: 'ID cannot contain whitespace' };
    }

    return { valid: true };
  }

  /**
   * 推荐的ID属性（按优先级）
   */
  static getRecommendedAttributes(): Array<{ attribute: string; confidence: number; description: string }> {
    return [
      {
        attribute: 'data-testid',
        confidence: 1.00,
        description: '测试专用ID，最稳定可靠',
      },
      {
        attribute: 'data-cy',
        confidence: 0.95,
        description: 'Cypress测试惯例',
      },
      {
        attribute: 'data-pw',
        confidence: 0.95,
        description: 'Playwright测试惯例',
      },
      {
        attribute: 'id',
        confidence: 0.90,
        description: '标准HTML ID（注意可能非唯一）',
      },
      {
        attribute: 'name',
        confidence: 0.85,
        description: '表单元素name属性',
      },
      {
        attribute: 'aria-label',
        confidence: 0.80,
        description: '可访问性标签',
      },
    ];
  }
}





