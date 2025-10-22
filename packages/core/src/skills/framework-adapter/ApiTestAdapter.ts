/**
 * ApiTestAdapter - Unified interface for API testing frameworks
 * 
 * Provides a consistent API across different HTTP clients and test frameworks
 */

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/**
 * Base HTTP client interface
 */
export interface HttpClient {
  request<T = any>(request: HttpRequest): Promise<HttpResponse<T>>;
  get<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>>;
  post<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>>;
  put<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>>;
  delete<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>>;
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  auth?: {
    username?: string;
    password?: string;
    token?: string;
    type?: 'basic' | 'bearer' | 'apiKey';
  };
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
}

/**
 * Response assertion helpers
 */
export interface ResponseAssertions {
  /**
   * Assert response status code
   */
  assertStatus(response: HttpResponse, expectedStatus: number): void;
  
  /**
   * Assert response has specific header
   */
  assertHeader(response: HttpResponse, headerName: string, expectedValue?: string): void;
  
  /**
   * Assert response body matches schema
   */
  assertSchema(response: HttpResponse, schema: any): void;
  
  /**
   * Assert response body contains specific data
   */
  assertBodyContains(response: HttpResponse, expected: any): void;
  
  /**
   * Assert response body equals expected data
   */
  assertBodyEquals(response: HttpResponse, expected: any): void;
  
  /**
   * Assert response time is within limit
   */
  assertResponseTime(duration: number, maxMs: number): void;
}

/**
 * Test framework adapter interface
 */
export interface TestFrameworkAdapter {
  /**
   * Framework name
   */
  readonly name: 'vitest' | 'jest' | 'mocha' | 'ava';
  
  /**
   * Generate test imports
   */
  generateImports(): string;
  
  /**
   * Generate test suite setup
   */
  generateSuiteSetup(suiteName: string): string;
  
  /**
   * Generate test suite teardown
   */
  generateSuiteTeardown(): string;
  
  /**
   * Generate test case
   */
  generateTestCase(testName: string, testBody: string, options?: TestCaseOptions): string;
  
  /**
   * Generate assertion
   */
  generateAssertion(actual: string, matcher: string, expected?: string): string;
  
  /**
   * Generate async test wrapper
   */
  generateAsyncTest(testName: string, testBody: string): string;
  
  /**
   * Generate before/after hooks
   */
  generateHook(hookType: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach', hookBody: string): string;
}

export interface TestCaseOptions {
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

/**
 * API test generator interface
 */
export interface ApiTestGenerator {
  /**
   * Generate complete test file
   */
  generateTestFile(options: TestFileOptions): string;
  
  /**
   * Generate test for single endpoint
   */
  generateEndpointTest(endpoint: EndpointInfo): string;
  
  /**
   * Generate authentication setup
   */
  generateAuthSetup(authType: AuthType): string;
  
  /**
   * Generate mock setup
   */
  generateMockSetup(endpoint: EndpointInfo): string;
}

export interface TestFileOptions {
  endpoints: EndpointInfo[];
  framework: TestFrameworkAdapter;
  httpClient: HttpClient;
  baseURL: string;
  includeAuth?: boolean;
  includeMocks?: boolean;
}

export interface EndpointInfo {
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: ParameterInfo[];
  requestBody?: RequestBodyInfo;
  responses?: Record<string, ResponseInfo>;
  security?: SecurityInfo[];
}

export interface ParameterInfo {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  schema: any;
  description?: string;
  example?: any;
}

export interface RequestBodyInfo {
  required: boolean;
  contentType: string;
  schema: any;
  example?: any;
}

export interface ResponseInfo {
  description: string;
  schema?: any;
  example?: any;
}

export interface SecurityInfo {
  type: AuthType;
  name: string;
  in?: 'header' | 'query' | 'cookie';
}

export type AuthType = 'apiKey' | 'bearer' | 'basic' | 'oauth2' | 'none';

/**
 * Base API test adapter
 */
export abstract class BaseApiTestAdapter implements ApiTestGenerator {
  constructor(
    protected framework: TestFrameworkAdapter,
    protected httpClient: HttpClient
  ) {}

  abstract generateTestFile(options: TestFileOptions): string;
  abstract generateEndpointTest(endpoint: EndpointInfo): string;
  abstract generateAuthSetup(authType: AuthType): string;
  abstract generateMockSetup(endpoint: EndpointInfo): string;

  /**
   * Generate test file header with imports
   */
  protected generateHeader(options: TestFileOptions): string {
    let header = this.framework.generateImports();
    header += '\n';
    header += this.generateHttpClientImport();
    header += '\n\n';
    
    if (options.includeAuth) {
      header += `import { setupAuth, getAuthHeaders } from './auth-helper';\n`;
    }
    
    if (options.includeMocks) {
      header += `import { setupMocks } from './mock-helper';\n`;
    }
    
    header += `\nconst BASE_URL = '${options.baseURL}';\n\n`;
    
    return header;
  }

  /**
   * Generate HTTP client import
   */
  protected abstract generateHttpClientImport(): string;

  /**
   * Generate setup code for HTTP client
   */
  protected abstract generateClientSetup(baseURL: string): string;

  /**
   * Generate HTTP request code
   */
  protected abstract generateRequest(
    method: HttpMethod,
    url: string,
    options?: {
      data?: string;
      headers?: string;
      params?: string;
    }
  ): string;

  /**
   * Generate response validation code
   */
  protected generateResponseValidation(response: string, expectedStatus: number): string {
    return this.framework.generateAssertion(
      `${response}.status`,
      'toBe',
      expectedStatus.toString()
    );
  }

  /**
   * Generate schema validation code
   */
  protected generateSchemaValidation(response: string, schema: any): string {
    // Implementation depends on validation library (Zod, Joi, AJV, etc.)
    return `// TODO: Validate ${response} against schema\n`;
  }
}

/**
 * Error classes
 */
export class HttpClientError extends Error {
  constructor(
    message: string,
    public response?: HttpResponse,
    public request?: HttpRequest
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: any[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Utility functions
 */
export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

export function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

export function parseContentType(contentType: string): { type: string; charset?: string } {
  const [type, ...params] = contentType.split(';').map(s => s.trim());
  const charset = params.find(p => p.startsWith('charset='))?.split('=')[1];
  return { type, charset };
}

export function serializeQueryParams(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    
    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, String(v)));
    } else {
      searchParams.set(key, String(value));
    }
  }
  
  return searchParams.toString();
}




