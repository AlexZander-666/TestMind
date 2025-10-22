/**
 * FastifyTestSkill - Fastify 路由测试生成技能
 * 
 * 功能：
 * - Fastify 路由测试生成
 * - Schema 验证测试
 * - Hooks 测试
 * - Plugins 测试
 * - 高性能异步处理测试
 */

import type { LLMService } from '../llm/LLMService';
import type { TestSuite } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface FastifyTestContext {
  filePath: string;
  fileType?: 'route' | 'plugin' | 'hook' | 'app';
  framework?: 'vitest' | 'jest' | 'tap';
}

interface FastifyFileAnalysis {
  type: 'route' | 'plugin' | 'hook' | 'app';
  routes: Array<{
    method: string;
    path: string;
    hasSchema: boolean;
  }>;
  hasSchemaValidation: boolean;
  hasHooks: boolean;
  hooks: string[];
  usesDecorators: boolean;
}

export class FastifyTestSkill {
  private logger = createComponentLogger('FastifyTestSkill');

  constructor(private llm: LLMService) {
    this.logger.debug('FastifyTestSkill initialized');
  }

  /**
   * 生成 Fastify 测试
   */
  async generateTest(context: FastifyTestContext): Promise<TestSuite> {
    const startTime = Date.now();
    this.logger.info('Generating Fastify test', { filePath: context.filePath });

    try {
      // 1. 分析文件
      const analysis = await this.analyzeFastifyFile(context.filePath);
      
      // 2. 生成测试
      const testCode = await this.generateFastifyTest(context, analysis);

      // 3. 创建测试套件
      const testSuite: TestSuite = {
        id: generateUUID(),
        projectId: 'fastify-project',
        targetEntityId: generateUUID(),
        testType: 'api',
        framework: context.framework || 'vitest',
        code: testCode,
        filePath: this.generateTestFilePath(context.filePath),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          fastifyType: analysis.type,
          routesCount: analysis.routes.length,
          hasSchema: analysis.hasSchemaValidation,
          duration: Date.now() - startTime,
        },
      };

      this.logger.info('Fastify test generation complete', {
        type: analysis.type,
        duration: Date.now() - startTime,
      });

      return testSuite;
    } catch (error) {
      this.logger.error('Failed to generate Fastify test', { error });
      throw error;
    }
  }

  /**
   * 分析 Fastify 文件
   */
  private async analyzeFastifyFile(filePath: string): Promise<FastifyFileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 检测类型
    let type: FastifyFileAnalysis['type'] = 'route';
    
    if (content.includes('fastify.register') || content.includes('export default async function')) {
      type = 'plugin';
    } else if (content.includes('fastify.addHook')) {
      type = 'hook';
    } else if (content.includes('fastify()')) {
      type = 'app';
    }

    // 提取路由
    const routes: Array<{ method: string; path: string; hasSchema: boolean }> = [];
    const routePatterns = [
      /fastify\.(get|post|put|delete|patch)\(['"]([^'"]+)['"],\s*({[\s\S]*?schema[\s\S]*?})?/g,
      /\.route\(\{\s*method:\s*['"](\w+)['"],\s*url:\s*['"]([^'"]+)['"],\s*schema:/g,
    ];

    for (const pattern of routePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          hasSchema: !!match[3] || content.includes('schema:'),
        });
      }
    }

    // 检测特性
    const hasSchemaValidation = content.includes('schema:');
    const hasHooks = content.includes('fastify.addHook') || content.includes('onRequest') || content.includes('preHandler');
    
    // 提取 hooks
    const hooks: string[] = [];
    const hookNames = ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onResponse', 'onError'];
    for (const hookName of hookNames) {
      if (content.includes(hookName)) {
        hooks.push(hookName);
      }
    }

    const usesDecorators = content.includes('fastify.decorate');

    return {
      type,
      routes,
      hasSchemaValidation,
      hasHooks,
      hooks,
      usesDecorators,
    };
  }

  /**
   * 生成 Fastify 测试代码
   */
  private async generateFastifyTest(
    context: FastifyTestContext,
    analysis: FastifyFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const prompt = `Generate comprehensive tests for a Fastify ${analysis.type}.

# Fastify Code Analysis

File: ${context.filePath}
Type: ${analysis.type}
Routes: ${analysis.routes.length > 0 ? '\n' + analysis.routes.map(r => `- ${r.method} ${r.path}${r.hasSchema ? ' (with schema)' : ''}`).join('\n') : 'None'}
Has Schema Validation: ${analysis.hasSchemaValidation}
Has Hooks: ${analysis.hasHooks}
Hooks: ${analysis.hooks.join(', ') || 'None'}
Uses Decorators: ${analysis.usesDecorators}

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. **Test Setup**: Use ${framework === 'tap' ? 'tap' : framework} and fastify testing utilities
2. **Fastify Instance**:
   - Create test Fastify instance
   - Register plugins/routes
   - Use \`fastify.inject()\` for request simulation (or tap.test)
3. **Route Testing** (for each route):
   - Test successful responses
   - Test different HTTP methods
   - Test route parameters
   - Test query parameters
   - Test request body
   - Test response status codes
   - Test response body structure
   ${analysis.hasSchemaValidation ? '- Test schema validation (valid and invalid data)' : ''}
4. **Schema Validation Testing**:
   - Test valid requests pass validation
   - Test invalid requests are rejected (400 status)
   - Test validation error messages
5. **Hooks Testing** (if present):
   ${analysis.hooks.map(h => `- Test ${h} hook execution`).join('\n   ')}
   - Test hooks modify request/response correctly
   - Test hooks error handling
6. **Performance Considerations**:
   - Test async/await properly
   - Test concurrent requests (Fastify's strength)
7. **Best Practices**:
   - Use \`t.after()\` or afterEach for cleanup
   - Close Fastify instance after tests
   - Mock database/external services
   - Use descriptive test names

# Output

Generate ONLY the test code with imports. No explanations.

\`\`\`typescript
// Test code here
\`\`\`
`;

    const response = await this.llm.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt,
      temperature: 0.2,
      maxTokens: 4000,
    });

    return this.extractCodeFromResponse(response.content);
  }

  /**
   * 从响应中提取代码
   */
  private extractCodeFromResponse(content: string): string {
    const codeBlockMatch = content.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return content.trim();
  }

  /**
   * 生成测试文件路径
   */
  private generateTestFilePath(filePath: string): string {
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    
    return path.join(dir, '__tests__', `${baseName}.test.ts`);
  }
}

