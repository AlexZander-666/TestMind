/**
 * VueTestSkill - Vue 组件测试生成技能
 * 
 * 功能：
 * - 支持 Vue 2 和 Vue 3
 * - 支持 Composition API 和 Options API
 * - 生成 @vue/test-utils + Vitest 测试
 * - 支持 Pinia/Vuex 状态管理 mock
 * - 智能生成用户交互测试
 */

import type { LLMService } from '../llm/LLMService';
import type { TestSuite } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { VueComponentAnalyzer, type VueComponentMetadata } from './VueComponentAnalyzer';
import { createComponentLogger } from '../utils/logger';
import * as path from 'path';

export interface VueTestContext {
  componentPath: string;
  vueVersion?: 2 | 3;
  testingLibrary?: '@vue/test-utils' | 'vue-testing-library';
  framework?: 'vitest' | 'jest';
}

export class VueTestSkill {
  private analyzer: VueComponentAnalyzer;
  private logger = createComponentLogger('VueTestSkill');

  constructor(private llm: LLMService) {
    this.analyzer = new VueComponentAnalyzer();
    this.logger.debug('VueTestSkill initialized');
  }

  /**
   * 生成 Vue 组件测试
   */
  async generateTest(context: VueTestContext): Promise<TestSuite> {
    const startTime = Date.now();
    this.logger.info('Generating Vue component test', { 
      componentPath: context.componentPath 
    });

    try {
      // 1. 分析组件
      const metadata = await this.analyzer.analyzeComponent(context.componentPath);
      
      // 2. 构建 Prompt
      const prompt = this.buildPrompt(metadata, context);
      
      // 3. 调用 LLM 生成测试
      const response = await this.llm.generate({
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        prompt,
        temperature: 0.2,
        maxTokens: 3000,
      });

      // 4. 提取测试代码
      const testCode = this.extractCodeFromResponse(response.content);
      
      // 5. 优化测试代码
      const optimizedCode = this.optimizeTestCode(testCode, metadata, context);

      // 6. 创建测试套件
      const testSuite: TestSuite = {
        id: generateUUID(),
        projectId: 'vue-project',
        targetEntityId: generateUUID(),
        testType: 'component',
        framework: context.framework || 'vitest',
        code: optimizedCode,
        filePath: this.generateTestFilePath(context.componentPath),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          componentName: metadata.name,
          apiStyle: metadata.apiStyle,
          vueVersion: context.vueVersion || 3,
          propsCount: metadata.props.length,
          emitsCount: metadata.emits.length,
          duration: Date.now() - startTime,
        },
      };

      this.logger.info('Vue test generation complete', {
        componentName: metadata.name,
        duration: Date.now() - startTime,
      });

      return testSuite;
    } catch (error) {
      this.logger.error('Failed to generate Vue test', { error });
      throw error;
    }
  }

  /**
   * 构建 LLM Prompt
   */
  private buildPrompt(metadata: VueComponentMetadata, context: VueTestContext): string {
    const vueVersion = context.vueVersion || 3;
    const framework = context.framework || 'vitest';

    return `You are an expert Vue.js test engineer. Generate comprehensive tests for a Vue ${vueVersion} component using @vue/test-utils and ${framework}.

# Component Information

**Name**: ${metadata.name}
**API Style**: ${metadata.apiStyle}
**File**: ${metadata.filePath}

## Props (${metadata.props.length})
${metadata.props.map(p => `- ${p.name}: ${Array.isArray(p.type) ? p.type.join(' | ') : p.type}${p.required ? ' (required)' : ' (optional)'}${p.default ? ` = ${p.default}` : ''}`).join('\n')}

## Emits (${metadata.emits.length})
${metadata.emits.map(e => `- ${e.name}${e.payload ? `: ${e.payload}` : ''}`).join('\n')}

## Slots (${metadata.slots.length})
${metadata.slots.map(s => `- ${s.name}`).join('\n')}

## Composables (${metadata.composables.length})
${metadata.composables.map(c => `- ${c.name} (${c.source})`).join('\n')}

## Refs (${metadata.refs.length})
${metadata.refs.join(', ')}

## Computed (${metadata.computed.length})
${metadata.computed.join(', ')}

## Lifecycle Hooks
${metadata.lifecycle.join(', ')}

## Store Usage
${metadata.storeUsage.pinia ? `Pinia: ${metadata.storeUsage.pinia.join(', ')}` : ''}
${metadata.storeUsage.vuex ? 'Vuex: Yes' : ''}

## Template
\`\`\`html
${metadata.template}
\`\`\`

## Script
\`\`\`typescript
${metadata.script}
\`\`\`

# Requirements

1. **Import statements**: Use \`@vue/test-utils\` for mounting and \`${framework}\` for test framework
2. **Test structure**: Follow AAA pattern (Arrange, Act, Assert)
3. **Coverage**: Generate tests for:
   - Component rendering with default props
   - Each prop variation (required props, optional props, prop validation)
   - All emitted events
   - User interactions (clicks, inputs, etc.)
   - Computed properties behavior
   - Watchers and reactive updates
   ${metadata.slots.length > 0 ? '   - Slot content rendering' : ''}
   ${metadata.storeUsage.pinia || metadata.storeUsage.vuex ? '   - Store integration (with mocks)' : ''}
   ${metadata.lifecycle.length > 0 ? '   - Lifecycle hooks' : ''}
4. **Best practices**:
   - Use \`await nextTick()\` for reactive updates
   - Use \`getByRole\`, \`getByText\`, \`getByTestId\` for queries
   - Mock external dependencies (stores, composables, API calls)
   - Use descriptive test names
   - Group related tests with \`describe\`
5. **Vue ${vueVersion} specific**:
   ${vueVersion === 3 ? '- Use Composition API test patterns\n   - Test refs, computed, and reactive properly' : '- Use Options API test patterns\n   - Test data, methods, and computed properly'}

# Output Format

Generate ONLY the test code, no explanations. Start with imports and end with the last closing brace.

\`\`\`typescript
// Your test code here
\`\`\`
`;
  }

  /**
   * 从 LLM 响应中提取代码
   */
  private extractCodeFromResponse(content: string): string {
    // 提取 ```typescript 代码块
    const codeBlockMatch = content.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // 如果没有代码块，返回全部内容
    return content.trim();
  }

  /**
   * 优化测试代码
   */
  private optimizeTestCode(
    testCode: string, 
    metadata: VueComponentMetadata,
    context: VueTestContext
  ): string {
    let optimized = testCode;

    // 1. 确保正确的导入语句
    if (!optimized.includes('@vue/test-utils')) {
      const framework = context.framework || 'vitest';
      const imports = `import { describe, it, expect, beforeEach } from '${framework}';\n` +
                     `import { mount } from '@vue/test-utils';\n` +
                     `import ${metadata.name} from '${this.getRelativeImportPath(context.componentPath)}';\n\n`;
      optimized = imports + optimized;
    }

    // 2. 添加必要的 mock
    if (metadata.storeUsage.pinia && metadata.storeUsage.pinia.length > 0) {
      // 确保 Pinia stores 被 mock
      if (!optimized.includes('vi.mock') && !optimized.includes('jest.mock')) {
        const storeMocks = metadata.storeUsage.pinia.map(store => 
          `vi.mock('@/stores/${store.toLowerCase()}', () => ({
  ${store}: () => ({
    // Add mock store state and actions here
  })
}));`
        ).join('\n\n');
        
        optimized = storeMocks + '\n\n' + optimized;
      }
    }

    // 3. 添加 nextTick import（如果需要）
    if (optimized.includes('nextTick') && !optimized.includes('import') && !optimized.includes('nextTick')) {
      optimized = `import { nextTick } from 'vue';\n` + optimized;
    }

    return optimized;
  }

  /**
   * 生成测试文件路径
   */
  private generateTestFilePath(componentPath: string): string {
    const dir = path.dirname(componentPath);
    const baseName = path.basename(componentPath, '.vue');
    return path.join(dir, `${baseName}.test.ts`);
  }

  /**
   * 获取相对导入路径
   */
  private getRelativeImportPath(componentPath: string): string {
    const baseName = path.basename(componentPath, '.vue');
    return `./${baseName}.vue`;
  }

  /**
   * 生成模板模式的测试（无 LLM）
   */
  async generateTemplateTest(context: VueTestContext): Promise<TestSuite> {
    this.logger.info('Generating template-based Vue test', { 
      componentPath: context.componentPath 
    });

    const metadata = await this.analyzer.analyzeComponent(context.componentPath);
    const framework = context.framework || 'vitest';
    
    const testCode = `import { describe, it, expect, beforeEach } from '${framework}';
import { mount } from '@vue/test-utils';
import ${metadata.name} from './${metadata.name}.vue';

describe('${metadata.name}', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(${metadata.name}${metadata.props.length > 0 ? `, {
      props: {
        ${metadata.props.filter(p => p.required).map(p => `${p.name}: ${this.getDefaultValue(p.type)}`).join(',\n        ')}
      }
    }` : ''});
  });

  it('should render correctly', () => {
    expect(wrapper.exists()).toBe(true);
  });

${metadata.props.map(prop => `  it('should render with ${prop.name} prop', async () => {
    await wrapper.setProps({ ${prop.name}: ${this.getDefaultValue(prop.type)} });
    expect(wrapper.props('${prop.name}')).toBeDefined();
  });`).join('\n\n')}

${metadata.emits.map(emit => `  it('should emit ${emit.name} event', async () => {
    // TODO: Trigger the event
    expect(wrapper.emitted('${emit.name}')).toBeTruthy();
  });`).join('\n\n')}
});
`;

    return {
      id: generateUUID(),
      projectId: 'vue-project',
      targetEntityId: generateUUID(),
      testType: 'component',
      framework,
      code: testCode,
      filePath: this.generateTestFilePath(context.componentPath),
      generatedAt: new Date(),
      generatedBy: 'template',
      metadata: {
        componentName: metadata.name,
        mode: 'template',
      },
    };
  }

  /**
   * 获取类型的默认值
   */
  private getDefaultValue(type: string | string[]): string {
    const typeStr = Array.isArray(type) ? type[0] : type;
    
    switch (typeStr.toLowerCase()) {
      case 'string':
        return "'test'";
      case 'number':
        return '42';
      case 'boolean':
        return 'true';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return 'null';
    }
  }
}

