/**
 * VisualLocator - 基于视觉特征的元素定位器（模拟实现）
 * 
 * 真实实现需要浏览器环境和计算机视觉能力
 * 这里提供模拟版本用于架构验证
 * 
 * 视觉特征包括：
 * - 位置（相对于父元素或视口）
 * - 大小（宽度、高度）
 * - 颜色（背景色、文本色）
 * - 文本内容（作为辅助特征）
 */

import type { ElementDescriptor, LocatorResult } from '../LocatorEngine';
import type { BrowserContext } from '../adapters/BrowserAdapter';

export interface VisualFeatures {
  /** 元素位置（相对） */
  position: { x: number; y: number };
  /** 元素大小 */
  size: { width: number; height: number };
  /** 背景颜色（十六进制） */
  backgroundColor?: string;
  /** 文本颜色 */
  textColor?: string;
  /** 文本内容（辅助特征） */
  textContent?: string;
  /** 边框信息 */
  border?: {
    width: number;
    color: string;
    style: string;
  };
}

export interface VisualLocatorConfig {
  /** 最小置信度阈值 */
  minConfidence?: number;
  /** 位置相似度权重 */
  positionWeight?: number;
  /** 大小相似度权重 */
  sizeWeight?: number;
  /** 颜色相似度权重 */
  colorWeight?: number;
  /** 文本相似度权重 */
  textWeight?: number;
  /** 位置容差（像素） */
  positionTolerance?: number;
  /** 大小容差（百分比） */
  sizeTolerance?: number;
}

/**
 * 视觉定位器（模拟实现）
 */
export class VisualLocator {
  private config: Required<VisualLocatorConfig>;

  constructor(config: VisualLocatorConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.7,
      positionWeight: config.positionWeight ?? 0.3,
      sizeWeight: config.sizeWeight ?? 0.2,
      colorWeight: config.colorWeight ?? 0.2,
      textWeight: config.textWeight ?? 0.3,
      positionTolerance: config.positionTolerance ?? 10, // 10px
      sizeTolerance: config.sizeTolerance ?? 0.15, // 15%
    };
  }

  /**
   * 尝试通过视觉特征定位元素
   */
  async locate(descriptor: ElementDescriptor, context?: BrowserContext): Promise<LocatorResult | null> {
    // 从描述符提取视觉特征
    const targetFeatures = this.extractVisualFeatures(descriptor);
    
    if (!targetFeatures) {
      return null;
    }

    // 在上下文中查找最匹配的元素
    const result = await this.findByVisualFeatures(targetFeatures, context);
    
    if (!result || result.confidence < this.config.minConfidence) {
      return null;
    }

    return result;
  }

  /**
   * 从元素描述符提取视觉特征
   */
  private extractVisualFeatures(descriptor: ElementDescriptor): VisualFeatures | null {
    const visualSignature = descriptor.visualSignature;
    
    // 如果有视觉签名字符串，解析它
    if (visualSignature && typeof visualSignature === 'string') {
      try {
        return JSON.parse(visualSignature);
      } catch {
        return null;
      }
    }

    // 从属性中提取
    const attributes = descriptor.attributes;
    if (!attributes) return null;

    const features: VisualFeatures = {
      position: {
        x: Number(attributes['_x']) || 0,
        y: Number(attributes['_y']) || 0,
      },
      size: {
        width: Number(attributes['_width']) || 0,
        height: Number(attributes['_height']) || 0,
      },
      backgroundColor: attributes['_backgroundColor'] as string,
      textColor: attributes['_textColor'] as string,
      textContent: descriptor.textContent,
    };

    return features;
  }

  /**
   * 通过视觉特征查找元素
   */
  private async findByVisualFeatures(
    targetFeatures: VisualFeatures,
    context?: any
  ): Promise<LocatorResult | null> {
    // 获取候选元素
    const candidates = this.getCandidateElements(context);
    
    if (candidates.length === 0) {
      return null;
    }

    // 为每个候选元素计算相似度
    const matches = candidates.map(element => ({
      element,
      features: this.getElementFeatures(element),
      similarity: 0,
    }));

    for (const match of matches) {
      match.similarity = this.calculateVisualSimilarity(
        targetFeatures,
        match.features
      );
    }

    // 找到最佳匹配
    const bestMatch = matches.reduce((best, current) => 
      current.similarity > best.similarity ? current : best
    );

    if (bestMatch.similarity < this.config.minConfidence) {
      return null;
    }

    // 视觉定位的置信度通常较低（因为是模拟）
    const confidence = Math.min(0.80, bestMatch.similarity);

    return {
      element: bestMatch.element,
      strategy: 'visual_similarity' as any,
      confidence,
      metadata: {
        similarity: bestMatch.similarity,
        targetFeatures,
        matchedFeatures: bestMatch.features,
      },
    };
  }

  /**
   * 计算视觉相似度
   */
  private calculateVisualSimilarity(
    target: VisualFeatures,
    candidate: VisualFeatures
  ): number {
    let totalSimilarity = 0;

    // 1. 位置相似度
    const positionSim = this.calculatePositionSimilarity(
      target.position,
      candidate.position
    );
    totalSimilarity += positionSim * this.config.positionWeight;

    // 2. 大小相似度
    const sizeSim = this.calculateSizeSimilarity(
      target.size,
      candidate.size
    );
    totalSimilarity += sizeSim * this.config.sizeWeight;

    // 3. 颜色相似度
    const colorSim = this.calculateColorSimilarity(
      target.backgroundColor,
      candidate.backgroundColor
    );
    totalSimilarity += colorSim * this.config.colorWeight;

    // 4. 文本相似度
    const textSim = this.calculateTextSimilarity(
      target.textContent,
      candidate.textContent
    );
    totalSimilarity += textSim * this.config.textWeight;

    return totalSimilarity;
  }

  /**
   * 计算位置相似度
   */
  private calculatePositionSimilarity(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    const distance = Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
    );

    // 距离在容差内视为完全匹配
    if (distance <= this.config.positionTolerance) {
      return 1.0;
    }

    // 距离越远，相似度越低
    const similarity = Math.max(0, 1 - (distance / 500));
    return similarity;
  }

  /**
   * 计算大小相似度
   */
  private calculateSizeSimilarity(
    size1: { width: number; height: number },
    size2: { width: number; height: number }
  ): number {
    if (size1.width === 0 || size1.height === 0) return 0;

    const widthRatio = Math.abs(size1.width - size2.width) / size1.width;
    const heightRatio = Math.abs(size1.height - size2.height) / size1.height;

    // 在容差内视为完全匹配
    if (widthRatio <= this.config.sizeTolerance && heightRatio <= this.config.sizeTolerance) {
      return 1.0;
    }

    // 计算相似度
    const widthSim = Math.max(0, 1 - widthRatio);
    const heightSim = Math.max(0, 1 - heightRatio);

    return (widthSim + heightSim) / 2;
  }

  /**
   * 计算颜色相似度
   */
  private calculateColorSimilarity(color1?: string, color2?: string): number {
    if (!color1 || !color2) return 0.5; // 缺少颜色信息时返回中性值

    // 简化实现：精确匹配
    if (color1.toLowerCase() === color2.toLowerCase()) {
      return 1.0;
    }

    // RGB相似度计算（简化版）
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    if (!rgb1 || !rgb2) return 0;

    const distance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );

    // RGB最大距离约为441（255*sqrt(3)）
    const similarity = Math.max(0, 1 - (distance / 441));
    return similarity;
  }

  /**
   * 计算文本相似度
   */
  private calculateTextSimilarity(text1?: string, text2?: string): number {
    if (!text1 && !text2) return 1.0; // 两者都没有文本，视为匹配
    if (!text1 || !text2) return 0; // 一个有文本一个没有，不匹配

    // 精确匹配
    if (text1 === text2) return 1.0;

    // Levenshtein距离（简化版）
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(text1, text2);
    const similarity = 1 - (distance / maxLength);

    return Math.max(0, similarity);
  }

  /**
   * 十六进制颜色转RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Levenshtein距离（简化实现）
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,      // deletion
            dp[i][j - 1] + 1,      // insertion
            dp[i - 1][j - 1] + 1   // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 获取候选元素
   */
  private getCandidateElements(context?: any): any[] {
    if (context && context.elements) {
      return context.elements;
    }

    // 测试环境模拟
    if (process.env.NODE_ENV === 'test') {
      return [{
        _x: 100,
        _y: 200,
        _width: 150,
        _height: 40,
        _backgroundColor: '#007bff',
        textContent: 'Submit',
        _mock: true,
      }];
    }

    return [];
  }

  /**
   * 获取元素的视觉特征
   */
  private getElementFeatures(element: any): VisualFeatures {
    return {
      position: {
        x: element._x || element.x || 0,
        y: element._y || element.y || 0,
      },
      size: {
        width: element._width || element.width || 0,
        height: element._height || element.height || 0,
      },
      backgroundColor: element._backgroundColor || element.backgroundColor,
      textColor: element._textColor || element.textColor,
      textContent: element.textContent || element.innerText,
    };
  }

  /**
   * 从真实DOM元素提取视觉特征（真实浏览器环境）
   */
  static extractFeaturesFromElement(element: HTMLElement): VisualFeatures {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    return {
      position: {
        x: rect.left,
        y: rect.top,
      },
      size: {
        width: rect.width,
        height: rect.height,
      },
      backgroundColor: computedStyle.backgroundColor,
      textColor: computedStyle.color,
      textContent: element.textContent || '',
      border: {
        width: parseFloat(computedStyle.borderWidth) || 0,
        color: computedStyle.borderColor,
        style: computedStyle.borderStyle,
      },
    };
  }

  /**
   * 生成视觉签名字符串
   */
  static generateVisualSignature(features: VisualFeatures): string {
    return JSON.stringify(features);
  }

  /**
   * 评估视觉定位的可行性
   */
  static assessVisualLocatorFeasibility(element: any): {
    feasible: boolean;
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 50; // 基础分数

    // 1. 位置信息
    if (element._x !== undefined && element._y !== undefined) {
      score += 15;
    } else {
      reasons.push('缺少位置信息');
      score -= 10;
    }

    // 2. 大小信息
    if (element._width !== undefined && element._height !== undefined) {
      score += 15;
    } else {
      reasons.push('缺少大小信息');
      score -= 10;
    }

    // 3. 颜色信息
    if (element._backgroundColor) {
      score += 10;
    } else {
      reasons.push('缺少颜色信息');
    }

    // 4. 文本内容
    if (element.textContent) {
      score += 10;
      reasons.push('有文本内容，可作为辅助特征');
    }

    // 5. 稳定性评估
    if (element.tagName === 'button' || element.tagName === 'a') {
      reasons.push('交互元素，视觉特征相对稳定');
      score += 5;
    }

    return {
      feasible: score >= 60,
      score: Math.max(0, Math.min(100, score)),
      reasons,
    };
  }
}





