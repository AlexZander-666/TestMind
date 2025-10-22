/**
 * PlaywrightAdapter - Playwright 浏览器适配器
 * 
 * 将 Playwright API 适配到统一的 BrowserAdapter 接口
 */

import type { Page, Locator, ElementHandle as PWElementHandle } from 'playwright';
import type { BrowserAdapter, ElementHandle, BrowserAdapterFactory } from './BrowserAdapter';

/**
 * Playwright 适配器实现
 */
export class PlaywrightAdapter implements BrowserAdapter {
  readonly name = 'playwright';
  readonly version = '1.x';
  
  constructor(private page: Page) {}
  
  /**
   * 查找单个元素
   */
  async findElement(selector: string): Promise<ElementHandle | null> {
    try {
      const element = await this.page.$(selector);
      if (!element) return null;
      
      return this.wrapElement(element);
    } catch (error) {
      console.debug(`[PlaywrightAdapter] findElement failed: ${selector}`, error);
      return null;
    }
  }
  
  /**
   * 查找多个元素
   */
  async findElements(selector: string): Promise<ElementHandle[]> {
    try {
      const elements = await this.page.$$(selector);
      return Promise.all(elements.map(el => this.wrapElement(el)));
    } catch (error) {
      console.debug(`[PlaywrightAdapter] findElements failed: ${selector}`, error);
      return [];
    }
  }
  
  /**
   * 获取元素属性
   */
  async getAttribute(element: ElementHandle, attr: string): Promise<string | null> {
    try {
      const pwElement = this.unwrapElement(element);
      return await pwElement.getAttribute(attr);
    } catch (error) {
      console.debug(`[PlaywrightAdapter] getAttribute failed: ${attr}`, error);
      return null;
    }
  }
  
  /**
   * 获取计算样式
   */
  async getComputedStyles(element: ElementHandle): Promise<Record<string, string>> {
    try {
      const pwElement = this.unwrapElement(element);
      const styles = await pwElement.evaluate((el: Element) => {
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
      });
      
      return styles;
    } catch (error) {
      console.debug(`[PlaywrightAdapter] getComputedStyles failed`, error);
      return {};
    }
  }
  
  /**
   * 获取文本内容
   */
  async getTextContent(element: ElementHandle): Promise<string> {
    try {
      const pwElement = this.unwrapElement(element);
      const text = await pwElement.textContent();
      return text || '';
    } catch (error) {
      console.debug(`[PlaywrightAdapter] getTextContent failed`, error);
      return '';
    }
  }
  
  /**
   * 检查元素是否可见
   */
  async isVisible(element: ElementHandle): Promise<boolean> {
    try {
      const pwElement = this.unwrapElement(element);
      return await pwElement.isVisible();
    } catch (error) {
      console.debug(`[PlaywrightAdapter] isVisible failed`, error);
      return false;
    }
  }
  
  /**
   * 截取元素截图
   */
  async screenshot(element: ElementHandle): Promise<Buffer> {
    try {
      const pwElement = this.unwrapElement(element);
      const buffer = await pwElement.screenshot({ type: 'png' });
      return buffer;
    } catch (error) {
      console.error(`[PlaywrightAdapter] screenshot failed`, error);
      throw error;
    }
  }
  
  /**
   * 截取整个页面
   */
  async screenshotPage(): Promise<Buffer> {
    try {
      const buffer = await this.page.screenshot({ 
        type: 'png',
        fullPage: false // 只截取视口，避免性能问题
      });
      return buffer;
    } catch (error) {
      console.error(`[PlaywrightAdapter] screenshotPage failed`, error);
      throw error;
    }
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
    try {
      const pwElement = this.unwrapElement(element);
      const box = await pwElement.boundingBox();
      return box;
    } catch (error) {
      console.debug(`[PlaywrightAdapter] getBoundingBox failed`, error);
      return null;
    }
  }
  
  /**
   * 点击元素
   */
  async click(element: ElementHandle): Promise<void> {
    const pwElement = this.unwrapElement(element);
    await pwElement.click();
  }
  
  /**
   * 填充输入框
   */
  async fill(element: ElementHandle, value: string): Promise<void> {
    const pwElement = this.unwrapElement(element);
    await pwElement.fill(value);
  }
  
  /**
   * 等待元素出现
   */
  async waitForElement(selector: string, timeout = 5000): Promise<ElementHandle | null> {
    try {
      const element = await this.page.waitForSelector(selector, { 
        timeout,
        state: 'visible'
      });
      
      if (!element) return null;
      return this.wrapElement(element);
    } catch (error) {
      console.debug(`[PlaywrightAdapter] waitForElement timeout: ${selector}`);
      return null;
    }
  }
  
  /**
   * 执行 JavaScript
   */
  async evaluate<T = any>(script: string | Function, ...args: any[]): Promise<T> {
    if (typeof script === 'function') {
      return await this.page.evaluate(script, ...args);
    } else {
      return await this.page.evaluate(script);
    }
  }
  
  /**
   * 获取简化的 DOM 树
   */
  async getSimplifiedDOM(maxDepth = 5): Promise<string> {
    try {
      const dom = await this.page.evaluate((depth: number) => {
        function simplifyElement(el: Element, currentDepth: number): string {
          if (currentDepth > depth) return '';
          
          const tag = el.tagName.toLowerCase();
          const id = el.id ? ` id="${el.id}"` : '';
          const className = el.className ? ` class="${el.className}"` : '';
          const testId = el.getAttribute('data-testid') 
            ? ` data-testid="${el.getAttribute('data-testid')}"` 
            : '';
          
          // 获取文本内容（仅直接子文本节点）
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
          
          // 递归处理子元素（限制数量）
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
        
        return simplifyElement(document.body, 0);
      }, maxDepth);
      
      return dom;
    } catch (error) {
      console.error(`[PlaywrightAdapter] getSimplifiedDOM failed`, error);
      return '<error>Failed to extract DOM</error>';
    }
  }
  
  /**
   * 检查选择器是否唯一
   */
  async isUnique(selector: string): Promise<boolean> {
    try {
      const elements = await this.page.$$(selector);
      return elements.length === 1;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 包装 Playwright 元素为通用接口
   */
  private async wrapElement(pwElement: PWElementHandle): Promise<ElementHandle> {
    const tagName = await pwElement.evaluate((el: Element) => el.tagName);
    const id = await pwElement.getAttribute('id');
    
    return {
      _raw: pwElement,
      tagName: tagName?.toLowerCase(),
      id: id || undefined,
      metadata: {
        framework: 'playwright'
      }
    };
  }
  
  /**
   * 解包通用元素为 Playwright 元素
   */
  private unwrapElement(element: ElementHandle): PWElementHandle {
    if (!element._raw) {
      throw new Error('Invalid ElementHandle: missing _raw property');
    }
    return element._raw as PWElementHandle;
  }
}

/**
 * Playwright 适配器工厂
 */
export class PlaywrightAdapterFactory implements BrowserAdapterFactory {
  create(page: any): BrowserAdapter {
    return new PlaywrightAdapter(page as Page);
  }
  
  isSupported(): boolean {
    try {
      // 尝试导入 Playwright
      require('playwright');
      return true;
    } catch {
      return false;
    }
  }
}



