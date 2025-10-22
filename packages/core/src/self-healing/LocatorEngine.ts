/**
 * LocatorEngine - 多策略元素定位器
 * 
 * 实现5级定位策略瀑布：
 * 1. ID 定位 (最快)
 * 2. CSS Selector
 * 3. XPath
 * 4. 视觉相似度 (AI)
 * 5. 语义理解 (LLM)
 */

import { IdLocator } from './strategies/IdLocator';
// TODO: Implement CssSelectorLocator and XPathLocator
// import { CssSelectorLocator } from './strategies/CssSelectorLocator';
// import { XPathLocator } from './strategies/XPathLocator';
import { VisualLocator } from './strategies/VisualLocator';
import { SemanticLocator } from './strategies/SemanticLocator';
import type { LLMService } from '../llm/LLMService';

export interface ElementDescriptor {
  id?: string;
  cssSelector?: string;
  xpath?: string;
  textContent?: string;
  visualSignature?: string;
  semanticIntent?: string;
  attributes?: Record<string, string>;
}

export interface LocatorResult {
  element: any; // 实际元素引用 (在真实环境中是 DOM Element)
  strategy: LocatorStrategy;
  confidence: number; // 0-1 之间的置信度分数
  metadata?: Record<string, any>;
}

export enum LocatorStrategy {
  ID = 'id',
  CSS_SELECTOR = 'css_selector',
  XPATH = 'xpath',
  VISUAL_SIMILARITY = 'visual_similarity',
  SEMANTIC_INTENT = 'semantic_intent'
}

export interface LocatorEngineConfig {
  enableVisualMatching?: boolean;
  enableSemanticMatching?: boolean;
  minConfidenceThreshold?: number;
  fallbackStrategies?: LocatorStrategy[];
  llmService?: LLMService;
}

/**
 * 多策略元素定位引擎
 */
export class LocatorEngine {
  private config: Required<Omit<LocatorEngineConfig, 'llmService'>> & { llmService?: LLMService };
  private idLocator: IdLocator;
  private cssLocator: any; // TODO: CssSelectorLocator;
  private xpathLocator: any; // TODO: XPathLocator;
  private visualLocator: VisualLocator;
  private semanticLocator?: SemanticLocator;

  constructor(config: LocatorEngineConfig = {}) {
    this.config = {
      enableVisualMatching: config.enableVisualMatching ?? true,
      enableSemanticMatching: config.enableSemanticMatching ?? true,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 0.7,
      fallbackStrategies: config.fallbackStrategies ?? [
        LocatorStrategy.ID,
        LocatorStrategy.CSS_SELECTOR,
        LocatorStrategy.XPATH,
        LocatorStrategy.VISUAL_SIMILARITY,
        LocatorStrategy.SEMANTIC_INTENT
      ],
      llmService: config.llmService
    };

    // 初始化策略定位器
    this.idLocator = new IdLocator();
    // TODO: Implement CssSelectorLocator and XPathLocator
    this.cssLocator = null as any; // new CssSelectorLocator();
    this.xpathLocator = null as any; // new XPathLocator();
    this.visualLocator = new VisualLocator();
    
    if (this.config.llmService) {
      this.semanticLocator = new SemanticLocator(this.config.llmService);
    }
  }

  /**
   * 使用多策略瀑布定位元素
   */
  async locateElement(
    descriptor: ElementDescriptor,
    context?: any
  ): Promise<LocatorResult | null> {
    for (const strategy of this.config.fallbackStrategies) {
      try {
        const result = await this.tryStrategy(strategy, descriptor, context);
        
        if (result && result.confidence >= this.config.minConfidenceThreshold) {
          return result;
        }
      } catch (error) {
        // 策略失败，继续下一个
        console.debug(`Strategy ${strategy} failed:`, error);
      }
    }

    return null; // 所有策略都失败
  }

  /**
   * 尝试单个定位策略
   */
  private async tryStrategy(
    strategy: LocatorStrategy,
    descriptor: ElementDescriptor,
    context?: any
  ): Promise<LocatorResult | null> {
    switch (strategy) {
      case LocatorStrategy.ID:
        return this.idLocator.locate(descriptor, context);
      
      case LocatorStrategy.CSS_SELECTOR:
        return this.cssLocator.locate(descriptor, context);
      
      case LocatorStrategy.XPATH:
        return this.xpathLocator.locate(descriptor, context);
      
      case LocatorStrategy.VISUAL_SIMILARITY:
        if (!this.config.enableVisualMatching) return null;
        return this.visualLocator.locate(descriptor, context);
      
      case LocatorStrategy.SEMANTIC_INTENT:
        if (!this.config.enableSemanticMatching || !this.semanticLocator) return null;
        return this.semanticLocator.locate(descriptor, context);
      
      default:
        return null;
    }
  }

  /**
   * 生成更稳定的选择器建议
   */
  generateStableSelectors(element: any): ElementDescriptor {
    return {
      id: element.id,
      cssSelector: this.cssLocator.generateStableSelector(element),
      xpath: this.xpathLocator.generateStableXPath(element),
    };
  }

  /**
   * 生成备选定位策略建议
   */
  async suggestAlternativeLocators(
    descriptor: ElementDescriptor,
    context?: any
  ): Promise<ElementDescriptor[]> {
    const suggestions: ElementDescriptor[] = [];

    // 如果有 ID，建议使用
    if (descriptor.id) {
      suggestions.push({
        ...descriptor,
        cssSelector: `#${descriptor.id}`
      });
    }

    // 如果有 class，建议组合选择器
    if (descriptor.attributes?.class) {
      suggestions.push({
        ...descriptor,
        cssSelector: `.${descriptor.attributes.class.split(' ')[0]}`
      });
    }

    // 如果有文本内容，建议使用文本定位
    if (descriptor.textContent) {
      suggestions.push({
        ...descriptor,
        xpath: `//*[contains(text(), '${descriptor.textContent}')]`
      });
    }

    return suggestions;
  }
}

/**
 * 便捷工厂函数
 */
export function createLocatorEngine(config?: LocatorEngineConfig): LocatorEngine {
  return new LocatorEngine(config);
}


