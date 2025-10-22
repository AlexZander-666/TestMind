/**
 * BrowserAdapter - 浏览器适配器接口
 * 
 * 为不同的浏览器自动化框架提供统一的抽象层
 * 支持：Playwright、Cypress、Puppeteer 等
 */

/**
 * 元素句柄的通用接口
 * 在实际实现中会映射到具体框架的元素类型
 */
export interface ElementHandle {
  /** 框架特定的原始元素引用 */
  _raw: any;
  
  /** 元素的唯一标识符（如果有） */
  id?: string;
  
  /** 元素标签名 */
  tagName?: string;
  
  /** 附加元数据 */
  metadata?: Record<string, any>;
}

/**
 * 浏览器上下文接口
 * 包含页面和适配器的完整上下文
 */
export interface BrowserContext {
  /** 适配器实例 */
  adapter: BrowserAdapter;
  
  /** 页面引用（框架特定） */
  page: any;
  
  /** 当前 URL */
  url?: string;
  
  /** 视口大小 */
  viewport?: { width: number; height: number };
  
  /** 附加配置 */
  config?: Record<string, any>;
}

/**
 * 浏览器适配器统一接口
 * 
 * 所有浏览器框架适配器必须实现此接口
 */
export interface BrowserAdapter {
  /**
   * 适配器名称（如 'playwright', 'cypress'）
   */
  readonly name: string;
  
  /**
   * 适配器版本
   */
  readonly version: string;
  
  /**
   * 查找单个元素
   * @param selector CSS 选择器、XPath 或其他定位策略
   * @returns 元素句柄，未找到则返回 null
   */
  findElement(selector: string): Promise<ElementHandle | null>;
  
  /**
   * 查找多个元素
   * @param selector CSS 选择器、XPath 或其他定位策略
   * @returns 元素句柄数组
   */
  findElements(selector: string): Promise<ElementHandle[]>;
  
  /**
   * 获取元素属性
   * @param element 元素句柄
   * @param attr 属性名
   * @returns 属性值，不存在则返回 null
   */
  getAttribute(element: ElementHandle, attr: string): Promise<string | null>;
  
  /**
   * 获取元素的计算样式
   * @param element 元素句柄
   * @returns 样式对象
   */
  getComputedStyles(element: ElementHandle): Promise<Record<string, string>>;
  
  /**
   * 获取元素文本内容
   * @param element 元素句柄
   * @returns 文本内容
   */
  getTextContent(element: ElementHandle): Promise<string>;
  
  /**
   * 检查元素是否可见
   * @param element 元素句柄
   * @returns 是否可见
   */
  isVisible(element: ElementHandle): Promise<boolean>;
  
  /**
   * 截取元素截图
   * @param element 元素句柄
   * @returns 图片 Buffer
   */
  screenshot(element: ElementHandle): Promise<Buffer>;
  
  /**
   * 截取整个页面
   * @returns 图片 Buffer
   */
  screenshotPage(): Promise<Buffer>;
  
  /**
   * 获取元素的边界框
   * @param element 元素句柄
   * @returns 边界框坐标
   */
  getBoundingBox(element: ElementHandle): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>;
  
  /**
   * 点击元素
   * @param element 元素句柄
   */
  click(element: ElementHandle): Promise<void>;
  
  /**
   * 填充输入框
   * @param element 元素句柄
   * @param value 要填充的值
   */
  fill(element: ElementHandle, value: string): Promise<void>;
  
  /**
   * 等待元素出现
   * @param selector 选择器
   * @param timeout 超时时间（毫秒）
   * @returns 元素句柄，超时则返回 null
   */
  waitForElement(selector: string, timeout?: number): Promise<ElementHandle | null>;
  
  /**
   * 执行 JavaScript 代码
   * @param script JavaScript 代码
   * @param args 参数
   * @returns 执行结果
   */
  evaluate<T = any>(script: string | Function, ...args: any[]): Promise<T>;
  
  /**
   * 获取页面的简化 DOM 树
   * @param maxDepth 最大深度
   * @returns 简化的 DOM 树字符串
   */
  getSimplifiedDOM(maxDepth?: number): Promise<string>;
  
  /**
   * 检查元素是否唯一
   * @param selector 选择器
   * @returns 是否唯一（只有一个匹配）
   */
  isUnique(selector: string): Promise<boolean>;
}

/**
 * 适配器工厂接口
 */
export interface BrowserAdapterFactory {
  /**
   * 创建适配器实例
   * @param page 页面对象（框架特定）
   * @returns 适配器实例
   */
  create(page: any): BrowserAdapter;
  
  /**
   * 检测是否支持当前环境
   * @returns 是否支持
   */
  isSupported(): boolean;
}

/**
 * 适配器注册表
 * 用于管理和获取不同的适配器实现
 */
export class BrowserAdapterRegistry {
  private static adapters = new Map<string, BrowserAdapterFactory>();
  
  /**
   * 注册适配器
   */
  static register(name: string, factory: BrowserAdapterFactory): void {
    this.adapters.set(name, factory);
  }
  
  /**
   * 获取适配器工厂
   */
  static get(name: string): BrowserAdapterFactory | undefined {
    return this.adapters.get(name);
  }
  
  /**
   * 自动检测并创建适配器
   */
  static autoDetect(page: any): BrowserAdapter | null {
    for (const [name, factory] of this.adapters) {
      if (factory.isSupported()) {
        return factory.create(page);
      }
    }
    return null;
  }
  
  /**
   * 列出所有已注册的适配器
   */
  static list(): string[] {
    return Array.from(this.adapters.keys());
  }
}



