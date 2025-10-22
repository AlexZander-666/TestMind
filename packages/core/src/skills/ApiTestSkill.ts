/**
 * ApiTestSkill - API 测试生成技能
 * 
 * 功能：
 * - REST API 测试生成
 * - GraphQL 查询/变更测试
 * - OpenAPI/Swagger 规范解析
 * - 响应断言生成
 * - Mock 数据生成
 * - 错误场景覆盖
 */

import type { LLMService } from '../llm/LLMService';
import type { Skill, SkillContext, SkillResult } from './Skill';

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description?: string;
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<number, ApiResponse>;
  authentication?: AuthType;
}

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  type: string;
  description?: string;
  example?: any;
}

export interface ApiRequestBody {
  contentType: string;
  schema?: any; // JSON Schema
  example?: any;
}

export interface ApiResponse {
  description: string;
  contentType?: string;
  schema?: any;
  example?: any;
}

export type AuthType = 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'none';

export interface GraphQLOperation {
  type: 'query' | 'mutation' | 'subscription';
  name: string;
  fields: string[];
  variables?: Record<string, any>;
  description?: string;
}

export interface ApiTestOptions {
  framework?: 'supertest' | 'axios' | 'fetch' | 'playwright';
  includeErrorCases?: boolean;
  includeMocks?: boolean;
  includeSchemaValidation?: boolean;
  generateE2EFlow?: boolean;
}

/**
 * API 测试生成技能
 */
export class ApiTestSkill implements Skill {
  readonly name = 'api-test';
  readonly description = 'Generate comprehensive API tests for REST and GraphQL';
  readonly category = 'testing' as const;
  readonly version = '1.0.0';
  
  private llmService: any; // Will be injected via setLLMService

  canHandle(context: SkillContext): boolean {
    // Check if this is an API testing request
    const prompt = context.userPrompt?.toLowerCase() || '';
    return prompt.includes('api') || prompt.includes('rest') || 
           prompt.includes('graphql') || prompt.includes('endpoint');
  }

  setLLMService(service: any): void {
    this.llmService = service;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    // Extract options from context
    const input = context.userPrompt || '';
    const options = context.analysisResult as any || {};
    const testOptions: ApiTestOptions = {
      framework: options?.framework || 'supertest',
      includeErrorCases: options?.includeErrorCases ?? true,
      includeMocks: options?.includeMocks ?? true,
      includeSchemaValidation: options?.includeSchemaValidation ?? true,
      generateE2EFlow: options?.generateE2EFlow ?? false
    };

    try {
      let testCode: string;
      
      // 检测 API 类型
      if (this.isGraphQL(input)) {
        testCode = await this.generateGraphQLTest(input, testOptions, context);
      } else {
        testCode = await this.generateRestTest(input, testOptions, context);
      }

      return {
        success: true,
        message: 'API test generated successfully',
        changes: [{
          type: 'create',
          path: 'api.test.ts', // Will be determined by orchestrator
          content: testCode,
          description: `Generated ${this.isGraphQL(input) ? 'GraphQL' : 'REST'} API test`
        }],
        metadata: {
          framework: testOptions.framework,
          testType: this.isGraphQL(input) ? 'graphql' : 'rest',
          testCode // Store test code in metadata for backward compatibility
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        metadata: {
          error: error instanceof Error ? error.stack : undefined
        }
      };
    }
  }

  /**
   * 生成 REST API 测试
   */
  private async generateRestTest(
    input: string,
    options: ApiTestOptions,
    context: SkillContext
  ): Promise<string> {
    // 尝试解析 OpenAPI 规范
    const endpoint = this.parseEndpointFromInput(input);

    if (!endpoint) {
      // 如果无法解析，使用 LLM 生成
      return this.generateTestWithLLM(input, 'rest', options, context);
    }

    // 基于解析的端点生成测试
    return this.generateRestTestFromEndpoint(endpoint, options);
  }

  /**
   * 从输入解析端点信息
   */
  private parseEndpointFromInput(input: string): ApiEndpoint | null {
    // 尝试解析简单格式：GET /api/users
    const simpleMatch = input.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+?)$/i);
    
    if (simpleMatch) {
      return {
        method: simpleMatch[1].toUpperCase() as ApiEndpoint['method'],
        path: simpleMatch[2].trim()
      };
    }

    // 尝试解析 JSON (OpenAPI snippet)
    try {
      const parsed = JSON.parse(input);
      if (parsed.path && parsed.method) {
        return parsed as ApiEndpoint;
      }
    } catch {
      // Not JSON
    }

    return null;
  }

  /**
   * 基于端点生成 REST 测试
   */
  private generateRestTestFromEndpoint(
    endpoint: ApiEndpoint,
    options: ApiTestOptions
  ): string {
    const framework = options.framework!;
    const tests: string[] = [];

    // 导入语句
    tests.push(this.generateImports(framework));
    tests.push('');

    // 测试套件
    tests.push(`describe('${endpoint.method} ${endpoint.path}', () => {`);

    // 成功场景
    tests.push(this.generateSuccessTest(endpoint, framework));

    // 错误场景
    if (options.includeErrorCases) {
      tests.push(this.generateErrorTests(endpoint, framework));
    }

    // Schema 验证
    if (options.includeSchemaValidation && endpoint.responses) {
      tests.push(this.generateSchemaValidationTest(endpoint, framework));
    }

    // 认证测试
    if (endpoint.authentication && endpoint.authentication !== 'none') {
      tests.push(this.generateAuthTest(endpoint, framework));
    }

    tests.push('});');

    return tests.join('\n');
  }

  /**
   * 生成导入语句
   */
  private generateImports(framework: string): string {
    switch (framework) {
      case 'supertest':
        return `import request from 'supertest';\nimport app from '../app';`;
      
      case 'axios':
        return `import axios from 'axios';\nimport { describe, it, expect } from 'vitest';`;
      
      case 'fetch':
        return `import { describe, it, expect } from 'vitest';`;
      
      case 'playwright':
        return `import { test, expect } from '@playwright/test';`;
      
      default:
        return `import { describe, it, expect } from 'vitest';`;
    }
  }

  /**
   * 生成成功场景测试
   */
  private generateSuccessTest(endpoint: ApiEndpoint, framework: string): string {
    const method = endpoint.method.toLowerCase();
    const path = endpoint.path;

    let test = `\n  it('should return success for valid ${method.toUpperCase()} request', async () => {\n`;

    switch (framework) {
      case 'supertest':
        test += `    const response = await request(app)\n`;
        test += `      .${method}('${path}')\n`;
        
        if (endpoint.requestBody) {
          test += `      .send(${JSON.stringify(endpoint.requestBody.example || {}, null, 6)})\n`;
        }
        
        test += `      .expect(200);\n\n`;
        test += `    expect(response.body).toBeDefined();\n`;
        break;

      case 'axios':
        test += `    const response = await axios.${method}('${path}'`;
        if (endpoint.requestBody) {
          test += `, ${JSON.stringify(endpoint.requestBody.example || {})}`;
        }
        test += `);\n\n`;
        test += `    expect(response.status).toBe(200);\n`;
        test += `    expect(response.data).toBeDefined();\n`;
        break;

      case 'fetch':
        test += `    const response = await fetch('${path}', {\n`;
        test += `      method: '${method.toUpperCase()}',\n`;
        if (endpoint.requestBody) {
          test += `      headers: { 'Content-Type': 'application/json' },\n`;
          test += `      body: JSON.stringify(${JSON.stringify(endpoint.requestBody.example || {})})\n`;
        }
        test += `    });\n\n`;
        test += `    expect(response.status).toBe(200);\n`;
        test += `    const data = await response.json();\n`;
        test += `    expect(data).toBeDefined();\n`;
        break;
    }

    test += `  });\n`;
    return test;
  }

  /**
   * 生成错误场景测试
   */
  private generateErrorTests(endpoint: ApiEndpoint, framework: string): string {
    const tests: string[] = [];

    // 400 - Bad Request
    tests.push(`\n  it('should return 400 for invalid request', async () => {`);
    tests.push(`    // TODO: Implement invalid request test`);
    tests.push(`  });\n`);

    // 401 - Unauthorized (if auth is required)
    if (endpoint.authentication && endpoint.authentication !== 'none') {
      tests.push(`\n  it('should return 401 without authentication', async () => {`);
      tests.push(`    // TODO: Implement unauthorized test`);
      tests.push(`  });\n`);
    }

    // 404 - Not Found
    if (endpoint.parameters?.some(p => p.in === 'path')) {
      tests.push(`\n  it('should return 404 for non-existent resource', async () => {`);
      tests.push(`    // TODO: Implement not found test`);
      tests.push(`  });\n`);
    }

    return tests.join('\n');
  }

  /**
   * 生成 Schema 验证测试
   */
  private generateSchemaValidationTest(endpoint: ApiEndpoint, framework: string): string {
    let test = `\n  it('should return response matching schema', async () => {\n`;
    test += `    // TODO: Implement schema validation\n`;
    test += `    // Using: joi, zod, or ajv for schema validation\n`;
    test += `  });\n`;
    return test;
  }

  /**
   * 生成认证测试
   */
  private generateAuthTest(endpoint: ApiEndpoint, framework: string): string {
    let test = `\n  it('should authenticate with ${endpoint.authentication}', async () => {\n`;
    test += `    // TODO: Implement ${endpoint.authentication} authentication test\n`;
    test += `  });\n`;
    return test;
  }

  /**
   * 生成 GraphQL 测试
   */
  private async generateGraphQLTest(
    input: string,
    options: ApiTestOptions,
    context: SkillContext
  ): Promise<string> {
    const operation = this.parseGraphQLOperation(input);

    if (!operation) {
      return this.generateTestWithLLM(input, 'graphql', options, context);
    }

    return this.generateGraphQLTestFromOperation(operation, options);
  }

  /**
   * 解析 GraphQL 操作
   */
  private parseGraphQLOperation(input: string): GraphQLOperation | null {
    // 简单的 GraphQL 解析
    const queryMatch = input.match(/query\s+(\w+)/);
    const mutationMatch = input.match(/mutation\s+(\w+)/);

    if (queryMatch) {
      return {
        type: 'query',
        name: queryMatch[1],
        fields: []
      };
    }

    if (mutationMatch) {
      return {
        type: 'mutation',
        name: mutationMatch[1],
        fields: []
      };
    }

    return null;
  }

  /**
   * 基于操作生成 GraphQL 测试
   */
  private generateGraphQLTestFromOperation(
    operation: GraphQLOperation,
    options: ApiTestOptions
  ): string {
    const tests: string[] = [];

    tests.push(`import { GraphQLClient } from 'graphql-request';\nimport { describe, it, expect } from 'vitest';\n`);
    tests.push(`const client = new GraphQLClient('/graphql');\n`);
    tests.push(`describe('GraphQL ${operation.type}: ${operation.name}', () => {`);
    tests.push(`\n  it('should execute ${operation.type} successfully', async () => {`);
    tests.push(`    const query = \`${operation.type} ${operation.name} { ... }\`;`);
    tests.push(`    const result = await client.request(query);`);
    tests.push(`    expect(result).toBeDefined();`);
    tests.push(`  });\n`);
    tests.push(`});`);

    return tests.join('\n');
  }

  /**
   * 使用 LLM 生成测试
   */
  private async generateTestWithLLM(
    input: string,
    apiType: 'rest' | 'graphql',
    options: ApiTestOptions,
    context: SkillContext
  ): Promise<string> {
    if (!this.llmService) {
      throw new Error('LLM service is required for advanced test generation');
    }

    const prompt = `
Generate comprehensive API tests for the following ${apiType.toUpperCase()} endpoint:

${input}

Requirements:
1. Use ${options.framework} framework
2. Include success scenarios
${options.includeErrorCases ? '3. Include error scenarios (400, 401, 404, 500)' : ''}
${options.includeSchemaValidation ? '4. Add response schema validation' : ''}
${options.includeMocks ? '5. Include mock data examples' : ''}

Generate complete, production-ready test code in TypeScript.
Include proper imports and describe blocks.
`;

    const response = await this.llmService.generate({
      provider: context.projectConfig?.llmProvider || 'openai',
      model: context.projectConfig?.llmModel || 'gpt-4',
      prompt,
      temperature: 0.3,
      maxTokens: 2000
    });

    // 提取代码块
    const codeMatch = response.content.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1] : response.content;
  }

  /**
   * 检测是否为 GraphQL
   */
  private isGraphQL(input: string): boolean {
    return /\b(query|mutation|subscription)\s+\w+/i.test(input);
  }

  // validate method is optional in Skill interface, so we don't need it here
}

/**
 * 便捷工厂函数
 */
export function createApiTestSkill(llmService?: LLMService): ApiTestSkill {
  const skill = new ApiTestSkill();
  if (llmService) {
    skill.setLLMService(llmService);
  }
  return skill;
}

