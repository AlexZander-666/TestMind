/**
 * NextJsTestSkill - Next.js 全栈测试生成技能
 * 
 * 功能：
 * - 支持 App Router 和 Pages Router
 * - Server Components 测试
 * - API Routes 测试（Route Handlers）
 * - Middleware 测试
 * - getServerSideProps/getStaticProps 测试
 * - Client Components 测试
 */

import type { LLMService } from '../llm/LLMService';
import type { TestSuite } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface NextJsTestContext {
  filePath: string;
  routerType?: 'app' | 'pages';
  componentType?: 'server' | 'client' | 'api' | 'middleware';
  framework?: 'vitest' | 'jest';
}

interface NextJsFileAnalysis {
  type: 'server-component' | 'client-component' | 'api-route' | 'middleware' | 'page-props';
  routerType: 'app' | 'pages';
  hasServerActions: boolean;
  hasDataFetching: boolean;
  imports: string[];
  exports: string[];
}

export class NextJsTestSkill {
  private logger = createComponentLogger('NextJsTestSkill');

  constructor(private llm: LLMService) {
    this.logger.debug('NextJsTestSkill initialized');
  }

  /**
   * 生成 Next.js 测试
   */
  async generateTest(context: NextJsTestContext): Promise<TestSuite> {
    const startTime = Date.now();
    this.logger.info('Generating Next.js test', { filePath: context.filePath });

    try {
      // 1. 分析文件类型
      const analysis = await this.analyzeNextJsFile(context.filePath);
      
      // 2. 根据类型生成不同的测试
      let testCode: string;
      
      switch (analysis.type) {
        case 'server-component':
          testCode = await this.generateServerComponentTest(context, analysis);
          break;
        case 'client-component':
          testCode = await this.generateClientComponentTest(context, analysis);
          break;
        case 'api-route':
          testCode = await this.generateApiRouteTest(context, analysis);
          break;
        case 'middleware':
          testCode = await this.generateMiddlewareTest(context, analysis);
          break;
        case 'page-props':
          testCode = await this.generatePagePropsTest(context, analysis);
          break;
        default:
          throw new Error(`Unknown Next.js file type: ${analysis.type}`);
      }

      // 3. 创建测试套件
      const testSuite: TestSuite = {
        id: generateUUID(),
        projectId: 'nextjs-project',
        targetEntityId: generateUUID(),
        testType: analysis.type === 'api-route' ? 'api' : 'component',
        framework: context.framework || 'vitest',
        code: testCode,
        filePath: this.generateTestFilePath(context.filePath),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          nextjsType: analysis.type,
          routerType: analysis.routerType,
          hasServerActions: analysis.hasServerActions,
          duration: Date.now() - startTime,
        },
      };

      this.logger.info('Next.js test generation complete', {
        type: analysis.type,
        duration: Date.now() - startTime,
      });

      return testSuite;
    } catch (error) {
      this.logger.error('Failed to generate Next.js test', { error });
      throw error;
    }
  }

  /**
   * 分析 Next.js 文件
   */
  private async analyzeNextJsFile(filePath: string): Promise<NextJsFileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 检测 Router 类型
    const isAppRouter = filePath.includes('/app/') || filePath.includes('\\app\\');
    const routerType: 'app' | 'pages' = isAppRouter ? 'app' : 'pages';
    
    // 检测组件类型
    let type: NextJsFileAnalysis['type'] = 'client-component';
    
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      type = 'api-route';
    } else if (filePath.includes('middleware.')) {
      type = 'middleware';
    } else if (content.includes('getServerSideProps') || content.includes('getStaticProps')) {
      type = 'page-props';
    } else if (!content.includes("'use client'") && !content.includes('"use client"')) {
      // App Router 默认是 Server Component
      if (isAppRouter) {
        type = 'server-component';
      }
    }

    // 检测特性
    const hasServerActions = content.includes("'use server'") || content.includes('"use server"');
    const hasDataFetching = content.includes('fetch(') || 
                           content.includes('useQuery') ||
                           content.includes('getServerSideProps') ||
                           content.includes('getStaticProps');

    // 提取 imports
    const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    const imports = Array.from(importMatches, m => m[1]);

    // 提取 exports
    const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g);
    const exports = Array.from(exportMatches, m => m[1]);

    return {
      type,
      routerType,
      hasServerActions,
      hasDataFetching,
      imports,
      exports,
    };
  }

  /**
   * 生成 Server Component 测试
   */
  private async generateServerComponentTest(
    context: NextJsTestContext,
    analysis: NextJsFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const prompt = `Generate comprehensive tests for a Next.js Server Component.

# Component Analysis

File: ${context.filePath}
Router: App Router
Type: Server Component
Has Data Fetching: ${analysis.hasDataFetching}
Has Server Actions: ${analysis.hasServerActions}

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. **Test Setup**: Use ${framework} and @testing-library/react
2. **Server Component Testing**:
   - Mock fetch() for data fetching
   - Test async component rendering
   - Test with different data scenarios
   - Test error states
   - Test loading states (if using Suspense)
3. **Server Actions** (if present):
   - Mock server actions
   - Test form submissions
   - Test action results
4. **Best Practices**:
   - Use React Server Components test patterns
   - Mock all external data sources
   - Test SSR behavior
   - Use proper assertions

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
      maxTokens: 3000,
    });

    return this.extractCodeFromResponse(response.content);
  }

  /**
   * 生成 Client Component 测试
   */
  private async generateClientComponentTest(
    context: NextJsTestContext,
    analysis: NextJsFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const prompt = `Generate comprehensive tests for a Next.js Client Component.

# Component Analysis

File: ${context.filePath}
Type: Client Component ('use client')

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. **Test Setup**: Use ${framework} and @testing-library/react
2. **Client Component Testing**:
   - Test component rendering
   - Test user interactions (onClick, onChange, etc.)
   - Test state updates
   - Test hooks (useState, useEffect, etc.)
   - Mock Next.js router (useRouter, usePathname, etc.)
   - Mock Next.js navigation
3. **Next.js Specifics**:
   - Mock next/link
   - Mock next/navigation hooks
   - Mock next/image if used
4. **Best Practices**:
   - Use userEvent for interactions
   - Test accessibility
   - Use proper assertions

Generate ONLY the test code. No explanations.
`;

    const response = await this.llm.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt,
      temperature: 0.2,
      maxTokens: 3000,
    });

    return this.extractCodeFromResponse(response.content);
  }

  /**
   * 生成 API Route 测试
   */
  private async generateApiRouteTest(
    context: NextJsTestContext,
    analysis: NextJsFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const isAppRouter = analysis.routerType === 'app';

    const prompt = `Generate comprehensive tests for a Next.js API Route.

# API Route Analysis

File: ${context.filePath}
Router: ${analysis.routerType === 'app' ? 'App Router (Route Handlers)' : 'Pages Router'}

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. **Test Setup**: Use ${framework} and node-mocks-http or create Request/Response mocks
2. **API Route Testing**:
   ${isAppRouter ? `
   - Test GET, POST, PUT, DELETE, PATCH handlers
   - Mock NextRequest and NextResponse
   - Test request body parsing
   - Test query parameters
   - Test dynamic route parameters
   - Test error responses
   - Test status codes
   - Test response headers
   ` : `
   - Test req.method handling
   - Test req.body, req.query
   - Test res.status() and res.json()
   - Test error handling
   - Test different HTTP methods
   `}
3. **Security & Validation**:
   - Test authentication (if present)
   - Test input validation
   - Test error cases
4. **Best Practices**:
   - Mock external services (database, APIs)
   - Test edge cases
   - Use proper assertions

Generate ONLY the test code. No explanations.
`;

    const response = await this.llm.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt,
      temperature: 0.2,
      maxTokens: 3000,
    });

    return this.extractCodeFromResponse(response.content);
  }

  /**
   * 生成 Middleware 测试
   */
  private async generateMiddlewareTest(
    context: NextJsTestContext,
    analysis: NextJsFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');

    const prompt = `Generate tests for Next.js Middleware.

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. Mock NextRequest and NextResponse
2. Test middleware logic
3. Test request modifications
4. Test redirects
5. Test rewrites
6. Test response modifications
7. Test matcher patterns

Generate ONLY the test code.
`;

    const response = await this.llm.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt,
      temperature: 0.2,
      maxTokens: 2000,
    });

    return this.extractCodeFromResponse(response.content);
  }

  /**
   * 生成 getServerSideProps/getStaticProps 测试
   */
  private async generatePagePropsTest(
    context: NextJsTestContext,
    analysis: NextJsFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');

    const prompt = `Generate tests for Next.js Page with getServerSideProps or getStaticProps.

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. Test the page component separately
2. Test getServerSideProps/getStaticProps separately
3. Mock context (params, query, req, res)
4. Test data fetching
5. Test error handling
6. Test redirects and notFound

Generate ONLY the test code.
`;

    const response = await this.llm.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt,
      temperature: 0.2,
      maxTokens: 3000,
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
    
    // API routes 通常在 __tests__ 目录
    if (filePath.includes('/api/')) {
      return path.join(dir, '__tests__', `${baseName}.test.ts`);
    }
    
    // 组件测试在同级目录
    return path.join(dir, `${baseName}.test.tsx`);
  }
}

