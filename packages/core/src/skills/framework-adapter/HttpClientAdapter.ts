/**
 * HttpClientAdapter - Adapters for different HTTP clients
 * 
 * Provides unified interface for:
 * - axios
 * - native fetch
 * - supertest
 * - got
 */

import type {
  HttpClient,
  HttpClientConfig,
  HttpRequest,
  HttpResponse,
  HttpMethod,
  HttpClientError,
} from './ApiTestAdapter';

// ============================================================================
// Axios Adapter
// ============================================================================

export class AxiosClientAdapter implements HttpClient {
  private axiosInstance: any;

  constructor(config: HttpClientConfig) {
    // Dynamically import axios
    const axios = require('axios');
    
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: config.headers || {},
      validateStatus: config.validateStatus || ((status: number) => status < 500),
      maxRedirects: config.maxRedirects || 5,
    });

    // Setup auth if provided
    if (config.auth) {
      this.setupAuth(config.auth);
    }
  }

  private setupAuth(auth: NonNullable<HttpClientConfig['auth']>): void {
    if (auth.type === 'basic' && auth.username && auth.password) {
      this.axiosInstance.defaults.auth = {
        username: auth.username,
        password: auth.password,
      };
    } else if (auth.type === 'bearer' && auth.token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'apiKey' && auth.token) {
      this.axiosInstance.defaults.headers.common['X-API-Key'] = auth.token;
    }
  }

  async request<T = any>(request: HttpRequest): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.request({
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        data: request.data,
        timeout: request.timeout,
      });

      return this.transformResponse(response);
    } catch (error: any) {
      if (error.response) {
        return this.transformResponse(error.response);
      }
      throw this.transformError(error);
    }
  }

  async get<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, data, ...config });
  }

  async delete<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  private transformResponse(axiosResponse: any): HttpResponse {
    return {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: axiosResponse.headers || {},
      data: axiosResponse.data,
    };
  }

  private transformError(error: any): HttpClientError {
    const err = new Error(error.message) as any;
    err.name = 'HttpClientError';
    err.request = error.config;
    return err;
  }
}

// ============================================================================
// Fetch Adapter
// ============================================================================

export class FetchClientAdapter implements HttpClient {
  constructor(private config: HttpClientConfig) {}

  async request<T = any>(request: HttpRequest): Promise<HttpResponse<T>> {
    const url = this.buildUrl(request.url, request.params);
    const headers = this.buildHeaders(request.headers);

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      body: request.data ? JSON.stringify(request.data) : undefined,
      signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined,
    };

    try {
      const response = await fetch(url, fetchOptions);
      return await this.transformResponse<T>(response);
    } catch (error: any) {
      throw this.transformError(error, request);
    }
  }

  async get<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, data, ...config });
  }

  async delete<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const baseUrl = this.config.baseURL.replace(/\/$/, '');
    const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private buildHeaders(requestHeaders?: Record<string, string>): Headers {
    const headers = new Headers(this.config.headers || {});

    // Add auth headers
    if (this.config.auth) {
      if (this.config.auth.type === 'bearer' && this.config.auth.token) {
        headers.set('Authorization', `Bearer ${this.config.auth.token}`);
      } else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
        const credentials = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
        headers.set('Authorization', `Basic ${credentials}`);
      } else if (this.config.auth.type === 'apiKey' && this.config.auth.token) {
        headers.set('X-API-Key', this.config.auth.token);
      }
    }

    // Add request-specific headers
    if (requestHeaders) {
      Object.entries(requestHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    return headers;
  }

  private async transformResponse<T>(response: Response): Promise<HttpResponse<T>> {
    const contentType = response.headers.get('content-type') || '';
    let data: any;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('text/')) {
      data = await response.text();
    } else {
      data = await response.blob();
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      data,
    };
  }

  private transformError(error: Error, request: HttpRequest): HttpClientError {
    const err = new Error(error.message) as any;
    err.name = 'HttpClientError';
    err.request = request;
    return err;
  }
}

// ============================================================================
// Supertest Adapter
// ============================================================================

export class SupertestClientAdapter implements HttpClient {
  private app: any;
  private request: any;

  constructor(app: any) {
    this.app = app;
    // Dynamically import supertest
    const supertest = require('supertest');
    this.request = supertest;
  }

  async request<T = any>(request: HttpRequest): Promise<HttpResponse<T>> {
    let req = this.request(this.app)[request.method.toLowerCase()](request.url);

    // Add headers
    if (request.headers) {
      Object.entries(request.headers).forEach(([key, value]) => {
        req = req.set(key, value);
      });
    }

    // Add query params
    if (request.params) {
      req = req.query(request.params);
    }

    // Add body
    if (request.data) {
      req = req.send(request.data);
    }

    // Set timeout
    if (request.timeout) {
      req = req.timeout(request.timeout);
    }

    try {
      const response = await req;
      return this.transformResponse<T>(response);
    } catch (error: any) {
      if (error.response) {
        return this.transformResponse<T>(error.response);
      }
      throw error;
    }
  }

  async get<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, data, ...config });
  }

  async delete<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  private transformResponse<T>(supertestResponse: any): HttpResponse<T> {
    return {
      status: supertestResponse.status,
      statusText: supertestResponse.statusText || '',
      headers: supertestResponse.headers || {},
      data: supertestResponse.body,
    };
  }
}

// ============================================================================
// Got Adapter
// ============================================================================

export class GotClientAdapter implements HttpClient {
  private gotInstance: any;

  constructor(config: HttpClientConfig) {
    // Dynamically import got
    const got = require('got');
    
    this.gotInstance = got.extend({
      prefixUrl: config.baseURL,
      timeout: {
        request: config.timeout || 10000,
      },
      headers: config.headers || {},
      throwHttpErrors: false,
      retry: { limit: 0 },
    });

    // Setup auth if provided
    if (config.auth) {
      this.setupAuth(config.auth);
    }
  }

  private setupAuth(auth: NonNullable<HttpClientConfig['auth']>): void {
    if (auth.type === 'basic' && auth.username && auth.password) {
      this.gotInstance = this.gotInstance.extend({
        username: auth.username,
        password: auth.password,
      });
    } else if (auth.type === 'bearer' && auth.token) {
      this.gotInstance = this.gotInstance.extend({
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });
    } else if (auth.type === 'apiKey' && auth.token) {
      this.gotInstance = this.gotInstance.extend({
        headers: {
          'X-API-Key': auth.token,
        },
      });
    }
  }

  async request<T = any>(request: HttpRequest): Promise<HttpResponse<T>> {
    try {
      const response = await this.gotInstance({
        method: request.method,
        url: request.url,
        headers: request.headers,
        searchParams: request.params,
        json: request.data,
        timeout: request.timeout ? { request: request.timeout } : undefined,
        responseType: 'json',
      });

      return this.transformResponse<T>(response);
    } catch (error: any) {
      if (error.response) {
        return this.transformResponse<T>(error.response);
      }
      throw this.transformError(error, request);
    }
  }

  async get<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, data, ...config });
  }

  async delete<T = any>(url: string, config?: Partial<HttpRequest>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  private transformResponse<T>(gotResponse: any): HttpResponse<T> {
    return {
      status: gotResponse.statusCode,
      statusText: gotResponse.statusMessage || '',
      headers: gotResponse.headers || {},
      data: gotResponse.body,
    };
  }

  private transformError(error: Error, request: HttpRequest): HttpClientError {
    const err = new Error(error.message) as any;
    err.name = 'HttpClientError';
    err.request = request;
    return err;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export type HttpClientType = 'axios' | 'fetch' | 'supertest' | 'got';

/**
 * Create HTTP client adapter
 */
export function createHttpClient(
  type: HttpClientType,
  config: HttpClientConfig | any
): HttpClient {
  switch (type) {
    case 'axios':
      return new AxiosClientAdapter(config);
    
    case 'fetch':
      return new FetchClientAdapter(config);
    
    case 'supertest':
      return new SupertestClientAdapter(config);
    
    case 'got':
      return new GotClientAdapter(config);
    
    default:
      throw new Error(`Unsupported HTTP client type: ${type}`);
  }
}

/**
 * Generate HTTP client setup code for tests
 */
export function generateHttpClientSetupCode(
  type: HttpClientType,
  baseURL: string,
  options?: {
    timeout?: number;
    headers?: Record<string, string>;
  }
): string {
  switch (type) {
    case 'axios':
      return `import axios from 'axios';

const client = axios.create({
  baseURL: '${baseURL}',
  timeout: ${options?.timeout || 10000},
  headers: ${JSON.stringify(options?.headers || { 'Content-Type': 'application/json' }, null, 2)},
});`;

    case 'fetch':
      return `const BASE_URL = '${baseURL}';

async function request(path: string, options: RequestInit = {}) {
  const url = \`\${BASE_URL}\${path}\`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ${options?.headers ? Object.entries(options.headers).map(([k, v]) => `'${k}': '${v}'`).join(',\n      ') : ''}
      ...options.headers,
    },
  });
  return response;
}`;

    case 'supertest':
      return `import request from 'supertest';
import app from '../app'; // Your Express/Koa/etc app

// Use request(app) to make requests`;

    case 'got':
      return `import got from 'got';

const client = got.extend({
  prefixUrl: '${baseURL}',
  timeout: { request: ${options?.timeout || 10000} },
  headers: ${JSON.stringify(options?.headers || { 'content-type': 'application/json' }, null, 2)},
  responseType: 'json',
});`;

    default:
      return `// Unsupported client type: ${type}`;
  }
}




