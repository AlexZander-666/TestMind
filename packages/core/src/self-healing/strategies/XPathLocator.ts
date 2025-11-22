/**
 * XPathLocator - 基于XPath的元素定位器
 * 
 * XPath强大但脆弱，需要谨慎使用：
 * - 相对路径 > 绝对路径（更稳定）
 * - 文本内容匹配（contains, text()）
 * - 属性匹配
 * 
 * 置信度受路径深度和类型影响
 */

import type { ElementDescriptor, LocatorResult } from '../LocatorEngine';
import type { BrowserContext } from '../adapters/BrowserAdapter';

export interface XPathLocatorConfig {
  /** 最小置信度阈值 */
  minConfidence?: number;
  /** 优先使用相对路径 */
  preferRelativePaths?: boolean;
  /** 启用文本内容匹配 */
  enableTextMatching?: boolean;
}

interface XPathStrategy {
  name: string;
  xpath: string;
  baseConfidence: number;
  pathType: 'relative' | 'absolute';
}

/**
 * XPath定位器
 */
export class XPathLocator {
  private config: Required<XPathLocatorConfig>;

  constructor(config: XPathLocatorConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.7,
      preferRelativePaths: config.preferRelativePaths ?? true,
      enableTextMatching: config.enableTextMatching ?? true,
    };
  }

  /**
   * 尝试通过XPath定位元素
   */
  async locate(descriptor: ElementDescriptor, context?: BrowserContext): Promise<LocatorResult | null> {
    // 1. 如果直接提供了XPath
    if (descriptor.xpath) {
      const result = await this.locateByXPath(descriptor.xpath, context);
      if (result && result.confidence >= this.config.minConfidence) {
        return result;
      }
    }

    // 2. 从描述符构建XPath策略
    const strategies = this.buildXPathStrategies(descriptor);

    // 3. 按优先级尝试每个策略
    for (const strategy of strategies) {
      const result = await this.locateByXPath(strategy.xpath, context, strategy);
      if (result && result.confidence >= this.config.minConfidence) {
        return result;
      }
    }

    return null;
  }

  /**
   * 通过XPath定位元素
   */
  private async locateByXPath(
    xpath: string,
    context?: BrowserContext,
    strategy?: XPathStrategy
  ): Promise<LocatorResult | null> {
    if (!xpath || xpath.trim() === '') {
      return null;
    }

    // 验证XPath语法
    if (!this.isValidXPath(xpath)) {
      return null;
    }

    // 使用浏览器适配器查找元素
    const element = context
      ? await context.adapter.findElement(xpath)
      : await this.findElementFallback(xpath);
    
    if (!element) {
      return null;
    }

    // 检查唯一性
    const isUnique = context
      ? await context.adapter.isUnique(xpath)
      : this.estimateUniqueness(xpath);
    
    const matchCount = isUnique ? 1 : 2;

    // 计算置信度
    let confidence = strategy?.baseConfidence ?? 0.70;

    // 唯一性调整
    if (isUnique) {
      confidence = Math.min(1.0, confidence + 0.10);
    } else {
      confidence = Math.max(0.4, confidence - 0.15);
    }

    // 路径深度惩罚（绝对路径越长越脆弱）
    if (strategy?.pathType === 'absolute') {
      const depth = this.calculatePathDepth(xpath);
      if (depth > 5) {
        confidence = Math.max(0.5, confidence - (depth - 5) * 0.02);
      }
    }

    // 文本匹配奖励（更语义化）
    if (xpath.includes('text()') || xpath.includes('contains(')) {
      confidence = Math.min(1.0, confidence + 0.05);
    }

    return {
      element,
      strategy: 'xpath' as any,
      confidence,
      metadata: {
        xpath,
        strategyName: strategy?.name || 'direct',
        pathType: strategy?.pathType || this.detectPathType(xpath),
        isUnique,
        matchCount,
        depth: this.calculatePathDepth(xpath),
      },
    };
  }

  /**
   * 构建XPath策略
   */
  private buildXPathStrategies(descriptor: ElementDescriptor): XPathStrategy[] {
    const strategies: XPathStrategy[] = [];

    const tag = this.extractTag(descriptor);
    const attributes = descriptor.attributes || {};
    const textContent = descriptor.textContent;

    // 策略1: 文本内容精确匹配（最语义化）
    if (this.config.enableTextMatching && textContent && tag) {
      strategies.push({
        name: 'text_exact',
        xpath: `//${tag}[text()="${this.escapeXPathString(textContent)}"]`,
        baseConfidence: 0.90,
        pathType: 'relative',
      });
    }

    // 策略2: 文本内容包含（更宽松）
    if (this.config.enableTextMatching && textContent && tag) {
      strategies.push({
        name: 'text_contains',
        xpath: `//${tag}[contains(text(), "${this.escapeXPathString(textContent)}")]`,
        baseConfidence: 0.85,
        pathType: 'relative',
      });
    }

    // 策略3: ID属性（高置信度）
    if (attributes['id']) {
      strategies.push({
        name: 'id_attribute',
        xpath: `//*[@id="${this.escapeXPathString(attributes['id'])}"]`,
        baseConfidence: 0.90,
        pathType: 'relative',
      });
    }

    // 策略4: 测试专用属性
    const testAttrs = ['data-testid', 'data-cy', 'data-pw', 'data-test'];
    for (const attr of testAttrs) {
      if (attributes[attr]) {
        strategies.push({
          name: `test_attribute_${attr}`,
          xpath: `//*[@${attr}="${this.escapeXPathString(attributes[attr])}"]`,
          baseConfidence: 0.95,
          pathType: 'relative',
        });
      }
    }

    // 策略5: 标签 + 单个属性
    if (tag && attributes) {
      const priorityAttrs = ['type', 'name', 'role', 'aria-label', 'class'];
      for (const attrName of priorityAttrs) {
        if (attributes[attrName]) {
          strategies.push({
            name: `tag_with_${attrName}`,
            xpath: `//${tag}[@${attrName}="${this.escapeXPathString(attributes[attrName])}"]`,
            baseConfidence: 0.80,
            pathType: 'relative',
          });
        }
      }
    }

    // 策略6: 标签 + 多个属性
    if (tag && Object.keys(attributes).length >= 2) {
      const attrPredicates = Object.entries(attributes)
        .slice(0, 2)
        .map(([name, value]) => `@${name}="${this.escapeXPathString(String(value))}"`)
        .join(' and ');
      
      strategies.push({
        name: 'tag_multi_attributes',
        xpath: `//${tag}[${attrPredicates}]`,
        baseConfidence: 0.85,
        pathType: 'relative',
      });
    }

    // 策略7: 仅标签（置信度最低）
    if (tag) {
      strategies.push({
        name: 'tag_only',
        xpath: `//${tag}`,
        baseConfidence: 0.60,
        pathType: 'relative',
      });
    }

    return strategies;
  }

  /**
   * 提取标签名
   */
  private extractTag(descriptor: ElementDescriptor): string | undefined {
    return descriptor.attributes?.['tagName'] || descriptor.attributes?.['tag'];
  }

  /**
   * 验证XPath语法
   */
  private isValidXPath(xpath: string): boolean {
    try {
      // 基本语法检查
      if (xpath.length === 0) return false;
      
      // 必须以 / 或 // 开头
      if (!xpath.startsWith('/') && !xpath.startsWith('(')) return false;

      // 检查括号平衡
      const openBrackets = (xpath.match(/\[/g) || []).length;
      const closeBrackets = (xpath.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) return false;

      const openParens = (xpath.match(/\(/g) || []).length;
      const closeParens = (xpath.match(/\)/g) || []).length;
      if (openParens !== closeParens) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 转义XPath字符串
   */
  private escapeXPathString(str: string): string {
    // XPath字符串转义：处理单引号和双引号
    if (!str.includes("'")) {
      return str;
    }
    if (!str.includes('"')) {
      return str;
    }
    
    // 包含两种引号，使用concat()
    const parts = str.split("'");
    return parts.map((part, i) => {
      if (i === parts.length - 1) return `"${part}"`;
      return `"${part}",',"'`;
    }).join(',');
  }

  /**
   * 检测路径类型
   */
  private detectPathType(xpath: string): 'relative' | 'absolute' {
    if (xpath.startsWith('//')) return 'relative';
    if (xpath.startsWith('/html') || xpath.startsWith('/body')) return 'absolute';
    return 'relative';
  }

  /**
   * 计算路径深度
   */
  private calculatePathDepth(xpath: string): number {
    // 计算路径中的层级数
    if (xpath.startsWith('//')) {
      // 相对路径，深度较低
      return 1;
    }
    
    // 绝对路径，计算 / 的数量
    const slashCount = (xpath.match(/\//g) || []).length;
    return slashCount;
  }

  /**
   * 回退方法：在没有浏览器上下文时查找元素
   */
  private async findElementFallback(xpath: string): Promise<any> {
    // 测试环境模拟
    if (process.env.NODE_ENV === 'test') {
      return {
        _raw: {
          xpath,
          _mock: true,
        },
        tagName: 'div',
        metadata: { framework: 'mock' }
      };
    }

    return null;
  }

  /**
   * 估算XPath唯一性
   */
  private estimateUniqueness(xpath: string): boolean {
    // 基于XPath特征估算
    if (xpath.includes('text()') || xpath.includes('@id')) return true;
    if (xpath.includes('@data-testid')) return true;
    if (xpath.includes(' and ')) return true;
    if ((xpath.match(/\[@\w+/g) || []).length >= 2) return true;
    return false;
  }

  /**
   * 从绝对路径转换为相对路径
   */
  static convertToRelativePath(absolutePath: string): string {
    // /html/body/div[1]/button -> //button
    const lastElement = absolutePath.split('/').pop();
    if (lastElement) {
      return `//${lastElement}`;
    }
    return absolutePath;
  }

  /**
   * 优化XPath（简化复杂路径）
   */
  static optimizeXPath(xpath: string): string {
    // 移除不必要的索引
    let optimized = xpath.replace(/\[1\]/g, ''); // 第一个子元素的索引可省略
    
    // 如果是绝对路径，尝试转换为相对路径
    if (optimized.startsWith('/html/body/')) {
      const parts = optimized.split('/');
      if (parts.length > 4) {
        // 保留最后2-3个层级
        const lastParts = parts.slice(-2);
        optimized = '//' + lastParts.join('/');
      }
    }

    return optimized;
  }

  /**
   * 从元素生成最佳XPath
   */
  static generateBestXPath(element: any): string {
    // 1. 如果有ID，使用ID
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    // 2. 如果有测试属性
    const testAttrs = ['data-testid', 'data-cy', 'data-pw'];
    for (const attr of testAttrs) {
      if (element[attr]) {
        return `//*[@${attr}="${element[attr]}"]`;
      }
    }

    // 3. 如果有文本内容且是button或a
    if (element.textContent && (element.tagName === 'button' || element.tagName === 'a')) {
      return `//${element.tagName.toLowerCase()}[text()="${element.textContent}"]`;
    }

    // 4. 标签 + 属性组合
    const tag = element.tagName?.toLowerCase() || '*';
    const attrs = [];

    if (element.type) attrs.push(`@type="${element.type}"`);
    if (element.name) attrs.push(`@name="${element.name}"`);
    if (element.class || element.className) {
      const firstClass = (element.class || element.className).split(/\s+/)[0];
      if (firstClass) attrs.push(`@class="${firstClass}"`);
    }

    if (attrs.length > 0) {
      return `//${tag}[${attrs.join(' and ')}]`;
    }

    // 5. 仅标签
    return `//${tag}`;
  }

  /**
   * 获取XPath建议
   */
  static getXPathRecommendations(element: any): Array<{
    xpath: string;
    confidence: number;
    reason: string;
  }> {
    const recommendations = [];

    // ID
    if (element.id) {
      recommendations.push({
        xpath: `//*[@id="${element.id}"]`,
        confidence: 0.90,
        reason: 'ID属性通常唯一',
      });
    }

    // 测试属性
    if (element['data-testid']) {
      recommendations.push({
        xpath: `//*[@data-testid="${element['data-testid']}"]`,
        confidence: 0.95,
        reason: '测试专用属性，最稳定',
      });
    }

    // 文本内容
    if (element.textContent && element.tagName) {
      const tag = element.tagName.toLowerCase();
      recommendations.push({
        xpath: `//${tag}[text()="${element.textContent}"]`,
        confidence: 0.85,
        reason: '基于文本内容，语义化',
      });
    }

    // 属性组合
    if (element.tagName && element.type) {
      const tag = element.tagName.toLowerCase();
      recommendations.push({
        xpath: `//${tag}[@type="${element.type}"]`,
        confidence: 0.75,
        reason: '标签+类型属性',
      });
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 验证XPath是否稳定（基于启发式规则）
   */
  static assessXPathStability(xpath: string): {
    stable: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // 1. 绝对路径惩罚
    if (xpath.startsWith('/html/body/')) {
      issues.push('使用绝对路径，容易因DOM结构变化而失效');
      score -= 30;
    }

    // 2. 数字索引惩罚
    const indexCount = (xpath.match(/\[\d+\]/g) || []).length;
    if (indexCount > 0) {
      issues.push(`使用了${indexCount}个数字索引，容易因元素顺序变化而失效`);
      score -= indexCount * 15;
    }

    // 3. 路径深度惩罚
    const depth = (xpath.match(/\//g) || []).length;
    if (depth > 5) {
      issues.push('路径深度过深，脆弱性高');
      score -= (depth - 5) * 5;
    }

    // 4. 属性匹配奖励
    if (xpath.includes('@id') || xpath.includes('@data-testid')) {
      score += 20;
    }

    // 5. 文本匹配奖励
    if (xpath.includes('text()') || xpath.includes('contains(')) {
      score += 10;
    }

    return {
      stable: score >= 70,
      score: Math.max(0, Math.min(100, score)),
      issues,
    };
  }
}





