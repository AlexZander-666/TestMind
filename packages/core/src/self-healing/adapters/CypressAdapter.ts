/**
 * CypressAdapter - Cypress 浏览器适配器
 * 
 * 将 Cypress API 适配到统一的 BrowserAdapter 接口
 * 
 * 注意：Cypress 的 API 是同步风格但返回 Chainable，
 * 这里我们将其适配为标准的 Promise API
 */

import type { BrowserAdapter, ElementHandle, BrowserAdapterFactory } from './BrowserAdapter';

/**
 * Cypress 全局对象类型（简化）
 */
interface CypressGlobal {
  get(selector: string, options?: any): any;
  $(selector: string): any;
  wait(ms: number): any;
  screenshot(options?: any): any;
}

/**
 * Cypress 适配器实现
 * 
 * 特殊性：Cypress 在浏览器内运行，没有传统的 "page" 对象
 * 所有操作通过全局 cy 对象完成
 */
export class CypressAdapter implements BrowserAdapter {
  readonly name = 'cypress';
  readonly version = '13.x';
  
  private cy: CypressGlobal;
  
  constructor(cypressInstance?: any) {
    // 如果没有传入，尝试使用全局 cy
    if (typeof cypressInstance !== 'undefined') {
      this.cy = cypressInstance;
    } else if (typeof (globalThis as any).cy !== 'undefined') {
      this.cy = (globalThis as any).cy;
    } else {
      throw new Error('Cypress instance not available');
    }
  }
  
  /**
   * 查找单个元素
   */
  async findElement(selector: string): Promise<ElementHandle | null> {
    return new Promise((resolve) => {
      this.cy
        .get(selector, { timeout: 1000 })
        .then(($el: any) => {
          if ($el?.length > 0) {
            resolve(this.wrapElement($el[0]));
          } else {
            resolve(null);
          }
        })
        .catch(() => {
          resolve(null);
        });
    });
  }
  
  /**
   * 查找多个元素
   */
  async findElements(selector: string): Promise<ElementHandle[]> {
    return new Promise((resolve) => {
      this.cy
        .get(selector, { timeout: 1000 })
        .then(($els) => {
          const elements: ElementHandle[] = [];
          $els.each((_, el) => {
            elements.push(this.wrapElement(el));
          });
          resolve(elements);
        })
        .catch(() => {
          resolve([]);
        });
    });
  }
  
  /**
   * 获取元素属性
   */
  async getAttribute(element: ElementHandle, attr: string): Promise<string | null> {
    const el = this.unwrapElement(element);
    return el.getAttribute(attr);
  }
  
  /**
   * 获取计算样式
   */
  async getComputedStyles(element: ElementHandle): Promise<Record<string, string>> {
    const el = this.unwrapElement(element);
    const computed = window.getComputedStyle(el);
    const result: Record<string, string> = {};
    
    // 提取常用样式
    const props = [
      'display', 'visibility', 'opacity', 'position',
      'width', 'height', 'color', 'backgroundColor',
      'fontSize', 'fontFamily', 'fontWeight'
    ];
    
    props.forEach(prop => {
      result[prop] = computed.getPropertyValue(prop);
    });
    
    return result;
  }
  
  /**
   * 获取文本内容
   */
  async getTextContent(element: ElementHandle): Promise<string> {
    const el = this.unwrapElement(element);
    return el.textContent || '';
  }
  
  /**
   * 检查元素是否可见
   */
  async isVisible(element: ElementHandle): Promise<boolean> {
    return new Promise((resolve) => {
      const el = this.unwrapElement(element);
      // Cypress 的可见性检查逻辑
      const isHidden = (
        el.offsetParent === null ||
        window.getComputedStyle(el).display === 'none' ||
        window.getComputedStyle(el).visibility === 'hidden' ||
        window.getComputedStyle(el).opacity === '0'
      );
      resolve(!isHidden);
    });
  }
  
  /**
   * 截取元素截图
   * 
   * 注意：Cypress 截图是异步的且保存到文件，这里我们返回空 Buffer
   * 实际使用中需要配合 Cypress 的截图插件
   */
  async screenshot(element: ElementHandle): Promise<Buffer> {
    console.warn('[CypressAdapter] Element screenshots not fully supported in Cypress adapter');
    // Cypress 截图主要用于调试，不返回 Buffer
    // 这里返回空 Buffer，实际项目中可能需要使用插件
    return Buffer.from('');
  }
  
  /**
   * 截取整个页面
   */
  async screenshotPage(): Promise<Buffer> {
    return new Promise((resolve) => {
      this.cy.screenshot({ capture: 'viewport' });
      // Cypress 截图保存到文件，这里返回空 Buffer
      console.warn('[CypressAdapter] Page screenshots saved to file, not returned as Buffer');
      resolve(Buffer.from(''));
    });
  }
  
  /**
   * 获取边界框
   */
  async getBoundingBox(element: ElementHandle): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null> {
    const el = this.unwrapElement(element);
    const rect = el.getBoundingClientRect();
    
    if (!rect) return null;
    
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }
  
  /**
   * 点击元素
   */
  async click(element: ElementHandle): Promise<void> {
    return new Promise((resolve) => {
      const el = this.unwrapElement(element);
      const $el = this.cy.$(el);
      this.cy.get($el).click().then(() => resolve());
    });
  }
  
  /**
   * 填充输入框
   */
  async fill(element: ElementHandle, value: string): Promise<void> {
    return new Promise((resolve) => {
      const el = this.unwrapElement(element);
      const $el = this.cy.$(el);
      this.cy.get($el).clear().type(value).then(() => resolve());
    });
  }
  
  /**
   * 等待元素出现
   */
  async waitForElement(selector: string, timeout = 5000): Promise<ElementHandle | null> {
    return new Promise((resolve) => {
      this.cy
        .get(selector, { timeout })
        .should('be.visible')
        .then(($el) => {
          resolve(this.wrapElement($el[0]));
        })
        .catch(() => {
          resolve(null);
        });
    });
  }
  
  /**
   * 执行 JavaScript
   */
  async evaluate<T = any>(script: string | Function, ...args: any[]): Promise<T> {
    if (typeof script === 'function') {
      // Cypress 在浏览器中运行，可以直接执行
      return script(...args);
    } else {
      // eslint-disable-next-line no-eval
      return eval(script);
    }
  }
  
  /**
   * 获取简化的 DOM 树
   */
  async getSimplifiedDOM(maxDepth = 5): Promise<string> {
    return new Promise((resolve) => {
      function simplifyElement(el: Element, currentDepth: number): string {
        if (currentDepth > maxDepth) return '';
        
        const tag = el.tagName.toLowerCase();
        const id = el.id ? ` id="${el.id}"` : '';
        const className = el.className ? ` class="${el.className}"` : '';
        const testId = el.getAttribute('data-cy') 
          ? ` data-cy="${el.getAttribute('data-cy')}"` 
          : el.getAttribute('data-testid')
          ? ` data-testid="${el.getAttribute('data-testid')}"` 
          : '';
        
        let text = '';
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const content = node.textContent?.trim();
            if (content && content.length < 50) {
              text = content;
              break;
            }
          }
        }
        const textAttr = text ? ` text="${text}"` : '';
        
        const indent = '  '.repeat(currentDepth);
        let result = `${indent}<${tag}${id}${className}${testId}${textAttr}>`;
        
        const children = Array.from(el.children).slice(0, 10);
        for (const child of children) {
          result += '\n' + simplifyElement(child, currentDepth + 1);
        }
        
        if (children.length > 0) {
          result += `\n${indent}</${tag}>`;
        } else {
          result = result.replace('>', ' />');
        }
        
        return result;
      }
      
      const dom = simplifyElement(document.body, 0);
      resolve(dom);
    });
  }
  
  /**
   * 检查选择器是否唯一
   */
  async isUnique(selector: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.cy.$(selector).then(($els: any) => {
        resolve($els.length === 1);
      });
    });
  }
  
  /**
   * 包装 DOM 元素为通用接口
   */
  private wrapElement(domElement: HTMLElement): ElementHandle {
    return {
      _raw: domElement,
      tagName: domElement.tagName.toLowerCase(),
      id: domElement.id || undefined,
      metadata: {
        framework: 'cypress'
      }
    };
  }
  
  /**
   * 解包通用元素为 DOM 元素
   */
  private unwrapElement(element: ElementHandle): HTMLElement {
    if (!element._raw) {
      throw new Error('Invalid ElementHandle: missing _raw property');
    }
    return element._raw as HTMLElement;
  }
}

/**
 * Cypress 适配器工厂
 */
export class CypressAdapterFactory implements BrowserAdapterFactory {
  create(page: any): BrowserAdapter {
    return new CypressAdapter(page);
  }
  
  isSupported(): boolean {
    // 检查是否在 Cypress 环境中
    return typeof (globalThis as any).cy !== 'undefined' ||
           typeof (globalThis as any).Cypress !== 'undefined';
  }
}



