/**
 * NuxtTestSkill - Nuxt.js 全栈测试生成技能
 * 
 * 功能：
 * - 支持 Nuxt 3 Composition API
 * - Server API routes 测试
 * - Nitro 中间件测试
 * - useFetch/useAsyncData 模拟
 * - Composables 测试
 * - Pages 测试
 */

import type { LLMService } from '../llm/LLMService';
import type { TestSuite } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface NuxtTestContext {
  filePath: string;
  fileType?: 'component' | 'composable' | 'api' | 'middleware' | 'page';
  framework?: 'vitest' | 'jest';
}

interface NuxtFileAnalysis {
  type: 'component' | 'composable' | 'server-api' | 'server-middleware' | 'page';
  usesNuxtComposables: string[];
  usesFetch: boolean;
  usesAsyncData: boolean;
  imports: string[];
}

export class NuxtTestSkill {
  private logger = createComponentLogger('NuxtTestSkill');

  constructor(private llm: LLMService) {
    this.logger.debug('NuxtTestSkill initialized');
  }

  /**
   * 生成 Nuxt.js 测试
   */
  async generateTest(context: NuxtTestContext): Promise<TestSuite> {
    const startTime = Date.now();
    this.logger.info('Generating Nuxt.js test', { filePath: context.filePath });

    try {
      // 1. 分析文件类型
      const analysis = await this.analyzeNuxtFile(context.filePath);
      
      // 2. 根据类型生成测试
      let testCode: string;
      
      switch (analysis.type) {
        case 'component':
          testCode = await this.generateComponentTest(context, analysis);
          break;
        case 'composable':
          testCode = await this.generateComposableTest(context, analysis);
          break;
        case 'server-api':
          testCode = await this.generateServerApiTest(context, analysis);
          break;
        case 'server-middleware':
          testCode = await this.generateServerMiddlewareTest(context, analysis);
          break;
        case 'page':
          testCode = await this.generatePageTest(context, analysis);
          break;
        default:
          throw new Error(`Unknown Nuxt file type: ${analysis.type}`);
      }

      // 3. 创建测试套件
      const testSuite: TestSuite = {
        id: generateUUID(),
        projectId: 'nuxt-project',
        targetEntityId: generateUUID(),
        testType: analysis.type === 'server-api' ? 'api' : 'component',
        framework: context.framework || 'vitest',
        code: testCode,
        filePath: this.generateTestFilePath(context.filePath),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          nuxtType: analysis.type,
          usesFetch: analysis.usesFetch,
          usesAsyncData: analysis.usesAsyncData,
          duration: Date.now() - startTime,
        },
      };

      this.logger.info('Nuxt test generation complete', {
        type: analysis.type,
        duration: Date.now() - startTime,
      });

      return testSuite;
    } catch (error) {
      this.logger.error('Failed to generate Nuxt test', { error });
      throw error;
    }
  }

  /**
   * 分析 Nuxt 文件
   */
  private async analyzeNuxtFile(filePath: string): Promise<NuxtFileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 检测文件类型
    let type: NuxtFileAnalysis['type'] = 'component';
    
    if (filePath.includes('/server/api/') || filePath.includes('\\server\\api\\')) {
      type = 'server-api';
    } else if (filePath.includes('/server/middleware/') || filePath.includes('\\server\\middleware\\')) {
      type = 'server-middleware';
    } else if (filePath.includes('/composables/') || filePath.includes('\\composables\\')) {
      type = 'composable';
    } else if (filePath.includes('/pages/') || filePath.includes('\\pages\\')) {
      type = 'page';
    }

    // 检测 Nuxt composables 使用
    const nuxtComposables = [
      'useNuxtApp', 'useState', 'useFetch', 'useAsyncData', 'useLazyFetch',
      'useLazyAsyncData', 'useRoute', 'useRouter', 'useHead', 'useSeoMeta',
      'useRuntimeConfig', 'useCookie', 'useRequestHeaders', 'useRequestEvent',
      'navigateTo', 'abortNavigation'
    ];
    
    const usesNuxtComposables = nuxtComposables.filter(comp => 
      content.includes(comp)
    );

    const usesFetch = content.includes('useFetch') || content.includes('useLazyFetch');
    const usesAsyncData = content.includes('useAsyncData') || content.includes('useLazyAsyncData');

    // 提取 imports
    const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    const imports = Array.from(importMatches, m => m[1]);

    return {
      type,
      usesNuxtComposables,
      usesFetch,
      usesAsyncData,
      imports,
    };
  }

  /**
   * 生成 Component 测试
   */
  private async generateComponentTest(
    context: NuxtTestContext,
    analysis: NuxtFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const prompt = `Generate comprehensive tests for a Nuxt 3 component.

# Component Analysis

File: ${context.filePath}
Uses Fetch: ${analysis.usesFetch}
Uses AsyncData: ${analysis.usesAsyncData}
Nuxt Composables: ${analysis.usesNuxtComposables.join(', ')}

# Source Code

\`\`\`vue
${sourceCode}
\`\`\`

# Requirements

1. **Test Setup**: Use ${framework}, @vue/test-utils, and @nuxt/test-utils
2. **Nuxt Component Testing**:
   - Use mountSuspended() for components with async data
   - Mock useFetch() and useAsyncData() if used
   - Mock useRoute() and useRouter() if used
   - Test component rendering
   - Test user interactions
   - Test data fetching states (loading, success, error)
3. **Nuxt-Specific Mocks**:
   ${analysis.usesNuxtComposables.map(c => `- Mock ${c}()`).join('\n   ')}
4. **Best Practices**:
   - Use mockNuxtImport() to mock composables
   - Test SSR behavior if applicable
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
   * 生成 Composable 测试
   */
  private async generateComposableTest(
    context: NuxtTestContext,
    analysis: NuxtFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const prompt = `Generate tests for a Nuxt 3 composable.

# Composable Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. Use ${framework} and @nuxt/test-utils
2. Test composable in isolation
3. Mock Nuxt runtime if needed
4. Test return values
5. Test state management
6. Test side effects

Generate ONLY the test code.
`;

    const response = await this.llm.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt,
      temperature: 0.2,
      maxTokens: 2500,
    });

    return this.extractCodeFromResponse(response.content);
  }

  /**
   * 生成 Server API 测试
   */
  private async generateServerApiTest(
    context: NuxtTestContext,
    analysis: NuxtFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');
    const framework = context.framework || 'vitest';

    const prompt = `Generate tests for a Nuxt 3 Server API route.

# API Route Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. Use ${framework} and h3 testing utilities
2. Test event handlers (GET, POST, PUT, DELETE)
3. Mock H3Event
4. Test request body parsing (readBody)
5. Test query parameters (getQuery)
6. Test route parameters
7. Test error responses
8. Test status codes
9. Mock external dependencies

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
   * 生成 Server Middleware 测试
   */
  private async generateServerMiddlewareTest(
    context: NuxtTestContext,
    analysis: NuxtFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');

    const prompt = `Generate tests for Nuxt 3 Server Middleware.

# Middleware Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. Mock H3Event
2. Test middleware logic
3. Test request/response modifications
4. Test error handling

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
   * 生成 Page 测试
   */
  private async generatePageTest(
    context: NuxtTestContext,
    analysis: NuxtFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');

    const prompt = `Generate tests for a Nuxt 3 Page component.

# Page Code

\`\`\`vue
${sourceCode}
\`\`\`

# Requirements

1. Use mountSuspended() from @nuxt/test-utils
2. Mock route params if dynamic route
3. Test page rendering
4. Test data fetching (if present)
5. Test navigation guards (if present)
6. Test SEO meta (if useHead is used)

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
    const codeBlockMatch = content.match(/```(?:typescript|ts|javascript|js|vue)?\n([\s\S]*?)```/);
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
    
    if (filePath.includes('/server/')) {
      return path.join(dir, `${baseName}.test.ts`);
    }
    
    return path.join(dir, `${baseName}.test.ts`);
  }
}

