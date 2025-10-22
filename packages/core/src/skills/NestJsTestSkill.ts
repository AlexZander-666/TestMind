/**
 * NestJsTestSkill - NestJS 测试生成技能
 * 
 * 功能：
 * - Controller 单元测试
 * - Service 单元测试（含依赖注入）
 * - E2E 测试（含 TestingModule）
 * - Guards、Interceptors、Pipes 测试
 * - 自动识别装饰器
 */

import type { LLMService } from '../llm/LLMService';
import type { TestSuite } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface NestJsTestContext {
  filePath: string;
  testType?: 'unit' | 'e2e';
  fileType?: 'controller' | 'service' | 'guard' | 'interceptor' | 'pipe' | 'module';
  framework?: 'jest'; // NestJS 默认使用 Jest
}

interface NestJsFileAnalysis {
  type: 'controller' | 'service' | 'guard' | 'interceptor' | 'pipe' | 'module' | 'dto';
  className: string;
  decorators: string[];
  dependencies: string[];
  methods: Array<{
    name: string;
    decorators: string[];
    params: string[];
  }>;
  imports: string[];
}

export class NestJsTestSkill {
  private logger = createComponentLogger('NestJsTestSkill');

  constructor(private llm: LLMService) {
    this.logger.debug('NestJsTestSkill initialized');
  }

  /**
   * 生成 NestJS 测试
   */
  async generateTest(context: NestJsTestContext): Promise<TestSuite> {
    const startTime = Date.now();
    this.logger.info('Generating NestJS test', { filePath: context.filePath });

    try {
      // 1. 分析文件
      const analysis = await this.analyzeNestJsFile(context.filePath);
      
      // 2. 根据类型和测试类型生成测试
      const testCode = context.testType === 'e2e' 
        ? await this.generateE2ETest(context, analysis)
        : await this.generateUnitTest(context, analysis);

      // 3. 创建测试套件
      const testSuite: TestSuite = {
        id: generateUUID(),
        projectId: 'nestjs-project',
        targetEntityId: generateUUID(),
        testType: context.testType === 'e2e' ? 'e2e' : 'unit',
        framework: 'jest',
        code: testCode,
        filePath: this.generateTestFilePath(context.filePath, context.testType || 'unit'),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          nestjsType: analysis.type,
          className: analysis.className,
          methodsCount: analysis.methods.length,
          duration: Date.now() - startTime,
        },
      };

      this.logger.info('NestJS test generation complete', {
        type: analysis.type,
        testType: context.testType || 'unit',
        duration: Date.now() - startTime,
      });

      return testSuite;
    } catch (error) {
      this.logger.error('Failed to generate NestJS test', { error });
      throw error;
    }
  }

  /**
   * 分析 NestJS 文件
   */
  private async analyzeNestJsFile(filePath: string): Promise<NestJsFileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 检测类型（通过装饰器）
    let type: NestJsFileAnalysis['type'] = 'service';
    
    if (content.includes('@Controller')) type = 'controller';
    else if (content.includes('@Injectable') && content.includes('Service')) type = 'service';
    else if (content.includes('@Injectable') && content.includes('Guard')) type = 'guard';
    else if (content.includes('@Injectable') && content.includes('Interceptor')) type = 'interceptor';
    else if (content.includes('@Injectable') && content.includes('Pipe')) type = 'pipe';
    else if (content.includes('@Module')) type = 'module';

    // 提取类名
    const classNameMatch = content.match(/export\s+class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : 'Unknown';

    // 提取类装饰器
    const decorators: string[] = [];
    const decoratorMatches = content.matchAll(/@(\w+)\(/g);
    for (const match of decoratorMatches) {
      if (!decorators.includes(match[1])) {
        decorators.push(match[1]);
      }
    }

    // 提取依赖注入（构造函数参数）
    const dependencies: string[] = [];
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)/);
    if (constructorMatch) {
      const params = constructorMatch[1];
      const depMatches = params.matchAll(/(?:private|public|protected)\s+(?:readonly\s+)?(\w+):\s*(\w+)/g);
      for (const match of depMatches) {
        dependencies.push(match[2]); // 类型名
      }
    }

    // 提取方法
    const methods: Array<{ name: string; decorators: string[]; params: string[] }> = [];
    const methodMatches = content.matchAll(/(?:@(\w+)\([^)]*\)\s+)?(?:async\s+)?(\w+)\(([\s\S]*?)\)\s*(?::\s*\w+\s*)?{/g);
    for (const match of methodMatches) {
      const decoratorName = match[1];
      const methodName = match[2];
      const params = match[3];
      
      if (methodName !== 'constructor' && methodName !== className) {
        methods.push({
          name: methodName,
          decorators: decoratorName ? [decoratorName] : [],
          params: params.split(',').map(p => p.trim()).filter(Boolean),
        });
      }
    }

    // 提取 imports
    const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    const imports = Array.from(importMatches, m => m[1]);

    return {
      type,
      className,
      decorators,
      dependencies,
      methods,
      imports,
    };
  }

  /**
   * 生成单元测试
   */
  private async generateUnitTest(
    context: NestJsTestContext,
    analysis: NestJsFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');

    const prompt = `Generate comprehensive unit tests for a NestJS ${analysis.type}.

# NestJS ${analysis.type} Analysis

Class: ${analysis.className}
Type: ${analysis.type}
Decorators: ${analysis.decorators.join(', ')}
Dependencies: ${analysis.dependencies.join(', ') || 'None'}
Methods: ${analysis.methods.length > 0 ? '\n' + analysis.methods.map(m => `- ${m.name}${m.decorators.length > 0 ? ' (@' + m.decorators.join(', @') + ')' : ''}`).join('\n') : 'None'}

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. **Test Setup**: Use @nestjs/testing and Jest
2. **TestingModule Setup**:
   - Create TestingModule with providers
   - Mock all dependencies
   - Use \`Test.createTestingModule()\`
   - Compile and get service/controller instance
3. **Dependency Mocking**:
   ${analysis.dependencies.map(dep => `- Mock ${dep} with jest.fn() or custom mock`).join('\n   ')}
4. **Method Testing** (for each method):
   - Test successful execution
   - Test with different inputs
   - Test error scenarios
   - Mock dependency return values
   - Verify dependency method calls
   ${analysis.type === 'controller' ? '- Test HTTP decorators behavior (@Get, @Post, etc.)' : ''}
   ${analysis.type === 'service' ? '- Test business logic' : ''}
5. **Guard/Interceptor/Pipe Testing** (if applicable):
   - Mock ExecutionContext
   - Test canActivate/intercept/transform logic
   - Test error cases
6. **Best Practices**:
   - Use beforeEach for setup
   - Use afterEach for cleanup
   - Clear all mocks
   - Use descriptive test names
   - Follow AAA pattern (Arrange-Act-Assert)

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
   * 生成 E2E 测试
   */
  private async generateE2ETest(
    context: NestJsTestContext,
    analysis: NestJsFileAnalysis
  ): Promise<string> {
    const sourceCode = await fs.readFile(context.filePath, 'utf-8');

    const prompt = `Generate E2E tests for a NestJS ${analysis.type}.

# Source Code

\`\`\`typescript
${sourceCode}
\`\`\`

# Requirements

1. Use @nestjs/testing and supertest
2. Create full application instance
3. Test HTTP endpoints end-to-end
4. Test request/response cycle
5. Test authentication/authorization (if present)
6. Test database integration (mock if needed)
7. Clean up after tests

Generate ONLY the test code.
`;

    const response = await this.llm.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt,
      temperature: 0.2,
      maxTokens: 3500,
    });

    return this.extractCodeFromResponse(response.content);
  }

  /**
   * 从响应中提取代码
   */
  private extractCodeFromResponse(content: string): string {
    const codeBlockMatch = content.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return content.trim();
  }

  /**
   * 生成测试文件路径
   */
  private generateTestFilePath(filePath: string, testType: 'unit' | 'e2e'): string {
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    
    if (testType === 'e2e') {
      // E2E 测试通常在 test 目录
      return path.join(process.cwd(), 'test', `${baseName}.e2e-spec.ts`);
    }
    
    // 单元测试在同级目录
    return path.join(dir, `${baseName}.spec.ts`);
  }
}

