/**
 * Browser Adapters - 统一导出
 */

export * from './BrowserAdapter';
export * from './PlaywrightAdapter';
export * from './CypressAdapter';

// 自动注册适配器
import { BrowserAdapterRegistry } from './BrowserAdapter';
import { PlaywrightAdapterFactory } from './PlaywrightAdapter';
import { CypressAdapterFactory } from './CypressAdapter';

// 注册 Playwright 适配器
BrowserAdapterRegistry.register('playwright', new PlaywrightAdapterFactory());

// 注册 Cypress 适配器
BrowserAdapterRegistry.register('cypress', new CypressAdapterFactory());

/**
 * 便捷函数：创建适配器
 */
export function createBrowserAdapter(name: 'playwright' | 'cypress', page: any) {
  const factory = BrowserAdapterRegistry.get(name);
  if (!factory) {
    throw new Error(`Adapter "${name}" not found. Available: ${BrowserAdapterRegistry.list().join(', ')}`);
  }
  return factory.create(page);
}

/**
 * 便捷函数：自动检测并创建适配器
 */
export function autoDetectAdapter(page: any) {
  const adapter = BrowserAdapterRegistry.autoDetect(page);
  if (!adapter) {
    throw new Error(`No compatible adapter found. Available: ${BrowserAdapterRegistry.list().join(', ')}`);
  }
  return adapter;
}














