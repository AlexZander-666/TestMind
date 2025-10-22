/**
 * Minimal type declarations for Playwright (optional peer dependency)
 * These types allow compilation when Playwright is not installed
 */

declare module 'playwright' {
  export interface Page {
    $(selector: string): Promise<ElementHandle | null>;
    $$(selector: string): Promise<ElementHandle[]>;
    url(): string;
    title(): Promise<string>;
    screenshot(options?: any): Promise<Buffer>;
    evaluate<R>(pageFunction: () => R): Promise<R>;
    waitForTimeout(timeout: number): Promise<void>;
  }

  export interface ElementHandle {
    getAttribute(name: string): Promise<string | null>;
    textContent(): Promise<string | null>;
    isVisible(): Promise<boolean>;
    isEnabled(): Promise<boolean>;
    boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
    evaluate<R>(pageFunction: (element: HTMLElement) => R): Promise<R>;
    $(selector: string): Promise<ElementHandle | null>;
    $$(selector: string): Promise<ElementHandle[]>;
  }

  export interface Locator {
    first(): Locator;
    count(): Promise<number>;
    getAttribute(name: string): Promise<string | null>;
  }
}

