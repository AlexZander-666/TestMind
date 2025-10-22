/**
 * ApiMockAdapter - API mocking for testing
 * 
 * Supports:
 * - nock (HTTP mocking library)
 * - MSW (Mock Service Worker)
 * - Custom mock handlers
 */

import type { HttpMethod, HttpRequest, HttpResponse } from './ApiTestAdapter';

// ============================================================================
// Mock Handler Types
// ============================================================================

export interface MockHandler {
  /**
   * Match criteria for the mock
   */
  match: MockMatcher;
  
  /**
   * Response to return when matched
   */
  response: MockResponse;
  
  /**
   * How many times this mock can be used (undefined = unlimited)
   */
  times?: number;
  
  /**
   * Delay before responding (ms)
   */
  delay?: number;
  
  /**
   * Enable/disable this mock
   */
  enabled?: boolean;
}

export interface MockMatcher {
  method: HttpMethod;
  path: string | RegExp;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  body?: any;
}

export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  json?: any;
}

export interface MockStats {
  callCount: number;
  lastCalled?: Date;
  calls: MockCall[];
}

export interface MockCall {
  timestamp: Date;
  request: HttpRequest;
  response: HttpResponse;
}

// ============================================================================
// Mock Adapter Interface
// ============================================================================

export interface MockAdapter {
  /**
   * Add a mock handler
   */
  addMock(handler: MockHandler): string;
  
  /**
   * Remove a mock handler by ID
   */
  removeMock(id: string): boolean;
  
  /**
   * Clear all mocks
   */
  clearMocks(): void;
  
  /**
   * Enable/disable mocking
   */
  setEnabled(enabled: boolean): void;
  
  /**
   * Get mock statistics
   */
  getStats(id: string): MockStats | undefined;
  
  /**
   * Verify mock was called
   */
  verify(id: string, times?: number): boolean;
  
  /**
   * Reset mock statistics
   */
  resetStats(): void;
}

// ============================================================================
// Nock Adapter
// ============================================================================

export class NockMockAdapter implements MockAdapter {
  private mocks: Map<string, { handler: MockHandler; stats: MockStats; scope?: any }> = new Map();
  private enabled: boolean = true;
  private nock: any;

  constructor() {
    try {
      this.nock = require('nock');
    } catch (error) {
      throw new Error('nock is not installed. Run: npm install --save-dev nock');
    }
  }

  addMock(handler: MockHandler): string {
    const id = this.generateId();
    const { match, response, times, delay } = handler;

    // Parse URL
    const urlObj = new URL(typeof match.path === 'string' ? match.path : 'http://localhost/');
    const baseURL = `${urlObj.protocol}//${urlObj.host}`;
    const path = urlObj.pathname;

    // Create nock scope
    let scope = this.nock(baseURL);

    // Setup interceptor
    const method = match.method.toLowerCase();
    let interceptor = (scope as any)[method](match.path);

    // Add query matching
    if (match.query) {
      interceptor = interceptor.query(match.query);
    }

    // Add header matching
    if (match.headers) {
      Object.entries(match.headers).forEach(([key, value]) => {
        interceptor = interceptor.matchHeader(key, value);
      });
    }

    // Add body matching
    if (match.body) {
      interceptor = interceptor.body(match.body);
    }

    // Add response
    let reply = interceptor.reply(
      response.status,
      response.json || response.body || '',
      response.headers || {}
    );

    // Add delay if specified
    if (delay) {
      reply = reply.delay(delay);
    }

    // Limit times if specified
    if (times !== undefined) {
      reply = reply.times(times);
    }

    this.mocks.set(id, {
      handler,
      stats: {
        callCount: 0,
        calls: [],
      },
      scope,
    });

    return id;
  }

  removeMock(id: string): boolean {
    const mock = this.mocks.get(id);
    if (!mock) return false;

    // Clean up nock scope
    if (mock.scope) {
      this.nock.cleanAll();
    }

    return this.mocks.delete(id);
  }

  clearMocks(): void {
    this.nock.cleanAll();
    this.mocks.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.nock.activate();
    } else {
      this.nock.restore();
    }
  }

  getStats(id: string): MockStats | undefined {
    return this.mocks.get(id)?.stats;
  }

  verify(id: string, times?: number): boolean {
    const stats = this.getStats(id);
    if (!stats) return false;

    if (times !== undefined) {
      return stats.callCount === times;
    }

    return stats.callCount > 0;
  }

  resetStats(): void {
    for (const mock of this.mocks.values()) {
      mock.stats = {
        callCount: 0,
        calls: [],
      };
    }
  }

  private generateId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// MSW (Mock Service Worker) Adapter
// ============================================================================

export class MSWMockAdapter implements MockAdapter {
  private mocks: Map<string, { handler: MockHandler; stats: MockStats }> = new Map();
  private enabled: boolean = true;
  private server: any;
  private rest: any;

  constructor() {
    try {
      const msw = require('msw');
      const { setupServer } = require('msw/node');
      this.rest = msw.rest;
      this.server = setupServer();
      this.server.listen();
    } catch (error) {
      throw new Error('msw is not installed. Run: npm install --save-dev msw');
    }
  }

  addMock(handler: MockHandler): string {
    const id = this.generateId();
    const { match, response, delay } = handler;

    // Create MSW handler
    const method = match.method.toLowerCase();
    const mswHandler = (this.rest as any)[method](
      match.path,
      async (req: any, res: any, ctx: any) => {
        // Update stats
        const mock = this.mocks.get(id);
        if (mock) {
          mock.stats.callCount++;
          mock.stats.lastCalled = new Date();
        }

        // Add delay if specified
        const transforms = [];
        if (delay) {
          transforms.push(ctx.delay(delay));
        }

        // Set status
        transforms.push(ctx.status(response.status));

        // Set headers
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            transforms.push(ctx.set(key, value));
          });
        }

        // Set body
        if (response.json) {
          transforms.push(ctx.json(response.json));
        } else if (response.body) {
          transforms.push(ctx.body(response.body));
        }

        return res(...transforms);
      }
    );

    this.server.use(mswHandler);

    this.mocks.set(id, {
      handler,
      stats: {
        callCount: 0,
        calls: [],
      },
    });

    return id;
  }

  removeMock(id: string): boolean {
    const deleted = this.mocks.delete(id);
    
    // Rebuild server with remaining mocks
    if (deleted) {
      this.rebuildServer();
    }
    
    return deleted;
  }

  clearMocks(): void {
    this.server.resetHandlers();
    this.mocks.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.server.close();
    } else {
      this.server.listen();
    }
  }

  getStats(id: string): MockStats | undefined {
    return this.mocks.get(id)?.stats;
  }

  verify(id: string, times?: number): boolean {
    const stats = this.getStats(id);
    if (!stats) return false;

    if (times !== undefined) {
      return stats.callCount === times;
    }

    return stats.callCount > 0;
  }

  resetStats(): void {
    for (const mock of this.mocks.values()) {
      mock.stats = {
        callCount: 0,
        calls: [],
      };
    }
  }

  private rebuildServer(): void {
    this.server.resetHandlers();
    // Re-add all remaining mocks
    for (const [id, mock] of this.mocks.entries()) {
      this.addMock(mock.handler);
    }
  }

  private generateId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on dispose
   */
  dispose(): void {
    if (this.server) {
      this.server.close();
    }
  }
}

// ============================================================================
// Simple In-Memory Mock Adapter
// ============================================================================

export class SimpleMockAdapter implements MockAdapter {
  private mocks: Map<string, { handler: MockHandler; stats: MockStats }> = new Map();
  private enabled: boolean = true;

  addMock(handler: MockHandler): string {
    const id = this.generateId();
    
    this.mocks.set(id, {
      handler,
      stats: {
        callCount: 0,
        calls: [],
      },
    });

    return id;
  }

  removeMock(id: string): boolean {
    return this.mocks.delete(id);
  }

  clearMocks(): void {
    this.mocks.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getStats(id: string): MockStats | undefined {
    return this.mocks.get(id)?.stats;
  }

  verify(id: string, times?: number): boolean {
    const stats = this.getStats(id);
    if (!stats) return false;

    if (times !== undefined) {
      return stats.callCount === times;
    }

    return stats.callCount > 0;
  }

  resetStats(): void {
    for (const mock of this.mocks.values()) {
      mock.stats = {
        callCount: 0,
        calls: [],
      };
    }
  }

  /**
   * Find matching mock for request
   */
  findMatch(request: HttpRequest): MockResponse | null {
    if (!this.enabled) return null;

    for (const { handler, stats } of this.mocks.values()) {
      if (!handler.enabled && handler.enabled !== undefined) continue;
      if (handler.times !== undefined && stats.callCount >= handler.times) continue;

      if (this.matchesRequest(handler.match, request)) {
        // Update stats
        stats.callCount++;
        stats.lastCalled = new Date();

        return handler.response;
      }
    }

    return null;
  }

  private matchesRequest(matcher: MockMatcher, request: HttpRequest): boolean {
    // Check method
    if (matcher.method !== request.method) {
      return false;
    }

    // Check path
    if (matcher.path instanceof RegExp) {
      if (!matcher.path.test(request.url)) {
        return false;
      }
    } else {
      if (matcher.path !== request.url) {
        return false;
      }
    }

    // Check query params
    if (matcher.query && request.params) {
      for (const [key, value] of Object.entries(matcher.query)) {
        if (request.params[key] !== value) {
          return false;
        }
      }
    }

    // Check headers
    if (matcher.headers && request.headers) {
      for (const [key, value] of Object.entries(matcher.headers)) {
        if (request.headers[key] !== value) {
          return false;
        }
      }
    }

    // Check body
    if (matcher.body) {
      if (JSON.stringify(matcher.body) !== JSON.stringify(request.data)) {
        return false;
      }
    }

    return true;
  }

  private generateId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export type MockAdapterType = 'nock' | 'msw' | 'simple';

/**
 * Create mock adapter
 */
export function createMockAdapter(type: MockAdapterType = 'nock'): MockAdapter {
  switch (type) {
    case 'nock':
      return new NockMockAdapter();
    
    case 'msw':
      return new MSWMockAdapter();
    
    case 'simple':
      return new SimpleMockAdapter();
    
    default:
      throw new Error(`Unsupported mock adapter type: ${type}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate mock setup code for tests
 */
export function generateMockSetupCode(
  type: MockAdapterType,
  endpoint: {
    method: HttpMethod;
    path: string;
    response: MockResponse;
  }
): string {
  switch (type) {
    case 'nock':
      return `import nock from 'nock';

// Mock ${endpoint.method} ${endpoint.path}
nock('http://localhost')
  .${endpoint.method.toLowerCase()}('${endpoint.path}')
  .reply(${endpoint.response.status}, ${JSON.stringify(endpoint.response.json || endpoint.response.body, null, 2)});`;

    case 'msw':
      return `import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.${endpoint.method.toLowerCase()}('${endpoint.path}', (req, res, ctx) => {
    return res(
      ctx.status(${endpoint.response.status}),
      ctx.json(${JSON.stringify(endpoint.response.json || endpoint.response.body, null, 2)})
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());`;

    case 'simple':
      return `// Simple mock implementation
const mockResponse = ${JSON.stringify(endpoint.response, null, 2)};

// Use mockResponse in your tests`;

    default:
      return `// Unsupported mock type: ${type}`;
  }
}

/**
 * Create mock handler from OpenAPI endpoint
 */
export function createMockFromEndpoint(endpoint: {
  method: HttpMethod;
  path: string;
  responses: Record<string, { body?: any; example?: any }>;
}): MockHandler {
  // Use the first success response (2xx)
  const successStatus = Object.keys(endpoint.responses).find(s => s.startsWith('2')) || '200';
  const response = endpoint.responses[successStatus];

  return {
    match: {
      method: endpoint.method,
      path: endpoint.path,
    },
    response: {
      status: parseInt(successStatus, 10),
      json: response.example || response.body || {},
    },
  };
}




