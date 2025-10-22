/**
 * ExpressTestSkill - Express.js 路由测试生成技能
 * 
 * 功能：
 * - Express 路由测试生成
 * - 中间件测试生成
 * - 路由参数和查询参数测试
 * - 错误处理中间件测试
 * - Session/Cookie 测试
 */

import type { LLMService } from '../llm/LLMService';
import type { TestSuite } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ExpressTestContext {
  filePath: string;
  routeType?: 'router' | 'middleware' | 'controller' | 'app';
  framework?: 'vitest' | 'jest';
}

interface ExpressFileAnalysis {
  type: 'router' | 'middleware' | 'controller' | 'app';
  routes: Array<{
    method: string;
    path: string;
  }>;
  hasErrorHandling: boolean;
  usesAuth: boolean;
  usesValidation: boolean;
  middleware: string[];
}

export class ExpressTestSkill {
  private logger = createComponentLogger('ExpressTestSkill');

  constructor(private llm: LLMService) {
    this.logger.debug('ExpressTestSkill initialized');
  }

  /**
   * 生成 Express 测试
   */
  async generateTest(context: ExpressTestContext): Promise<TestSuite> {
    const startTime = Date.now();
    this.logger.info('Generating Express test', { filePath: context.filePath });

    try {
      // 1. 分析文件
      const analysis = await this.analyzeExpressFile(context.filePath);
      
      // 2. 生成测试
      const testCode = await this.generateExpressTest(context, analysis);

      // 3. 创建测试套件
      const testSuite: TestSuite = {
        id: generateUUID(),
        projectId: 'express-project',
        targetEntityId: generateUUID(),
        testType: 'api',
        framework: context.framework || 'vitest',
        code: testCode,
        filePath: this.generateTestFilePath(context.filePath),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          expressType: analysis.type,
          routesCount: analysis.routes.length,
          hasAuth: analysis.usesAuth,
          duration: Date.now() - startTime,
        },
      };

      this.logger.info('Express test generation complete', {
        type: analysis.type,
        duration: Date.now() - startTime,
      });

      return testSuite;
    } catch (error) {
      this.logger.error('Failed to generate Express test', { error });
      throw error;
    }
  }

  /**
   * 分析 Express 文件
   */
  private async analyzeExpressFile(filePath: string): Promise<ExpressFileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 检测类型
    let type: ExpressFileAnalysis['type'] = 'router';
    
    if (content.includes('export function') || content.includes('export const') && content.includes('(req, res')) {
      type = 'controller';
    } else if (content.includes('function(err') || content.includes('(err, req, res, next)')) {
      type = 'middleware';
    } else if (content.includes('express()')) {
      type = 'app';
    }

    // 提取路由
    const routes: Array<{ method: string; path: string }> = [];
    const routePatterns = [
      /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g,
      /app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g,
    ];

    for (const pattern of routePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
        });
      }
    }

    // 检测特性
    const hasErrorHandling = content.includes('(err, req, res, next)') || 
                            content.includes('res.status(') && content.includes('error');
    const usesAuth = content.includes('authenticate') || 
                     content.includes('passport') ||
                     content.includes('jwt') ||
                     content.includes('req.user');
    const usesValidation = content.includes('validator') ||
                          content.includes('express-validator') ||
                          content.includes('.body()') ||
                          content.includes('.param()');

    // 提取中间件
    const middleware: string[] = [];
    const middlewareMatches = content.matchAll(/router\.use\(([^)]+)\)/g);
    for (const match of middlewareMatches) {
      middleware.push(match[1].trim());
    }

    return {
      type,
      routes,
      hasErrorHandling,
      usesAuth,
      usesValidation,
      middleware,
    };
  }

  /**
   * 生成 Express 测试代码
   */
  private async generateExpressTest(
    context: ExpressTestContext,
    analysis: ExpressFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const prompt = `Generate comprehensive tests for an Express.js ${analysis.type}.

# Express Code Analysis

File: ${context.filePath}
Type: ${analysis.type}
Routes: ${analysis.routes.length > 0 ? '\n' + analysis.routes.map(r => `- ${r.method} ${r.path}`).join('\n') : 'None'}
Has Error Handling: ${analysis.hasErrorHandling}
Uses Authentication: ${analysis.usesAuth}
Uses Validation: ${analysis.usesValidation}
Middleware: ${analysis.middleware.join(', ') || 'None'}

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. **Test Setup**: Use ${framework} and supertest for HTTP assertions
2. **Route Testing** (for each route):
   - Test successful responses
   - Test different HTTP methods (GET, POST, PUT, DELETE, PATCH)
   - Test route parameters (if dynamic routes)
   - Test query parameters
   - Test request body (for POST/PUT)
   - Test response status codes
   - Test response body structure
3. **Middleware Testing**:
   ${analysis.middleware.length > 0 ? analysis.middleware.map(m => `- Test ${m}`).join('\n   ') : '- Test middleware execution order'}
4. **Error Handling**:
   - Test 404 for non-existent routes
   - Test 400 for invalid input
   - Test 500 for server errors
   ${analysis.hasErrorHandling ? '- Test custom error handler' : ''}
5. **Authentication** (if present):
   - Test with valid token
   - Test with invalid token
   - Test without token
6. **Validation** (if present):
   - Test with valid data
   - Test with invalid data
   - Test validation error messages
7. **Best Practices**:
   - Mock database calls
   - Mock external services
   - Use beforeEach for setup
   - Use afterEach for cleanup
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

