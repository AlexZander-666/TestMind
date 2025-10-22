/**
 * VueComponentAnalyzer - Vue 组件智能分析器
 * 
 * 功能：
 * - 解析 Vue SFC（Single File Component）
 * - 提取组件元数据（props、emits、slots、refs）
 * - 识别 Composition API 和 Options API
 * - 分析 composables 和依赖注入
 * - 分析响应式引用和计算属性
 */

import * as fs from 'fs-extra';
import { createComponentLogger } from '../utils/logger';

export interface VueProp {
  name: string;
  type: string | string[];
  required: boolean;
  default?: any;
  validator?: string;
}

export interface VueEmit {
  name: string;
  payload?: string;
}

export interface VueSlot {
  name: string;
  props?: Record<string, string>;
}

export interface VueComposable {
  name: string;
  source: string;
  usage: string;
}

export interface VueComponentMetadata {
  name: string;
  filePath: string;
  apiStyle: 'composition' | 'options' | 'mixed';
  props: VueProp[];
  emits: VueEmit[];
  slots: VueSlot[];
  composables: VueComposable[];
  refs: string[];
  computed: string[];
  watchers: string[];
  lifecycle: string[];
  storeUsage: {
    pinia?: string[];
    vuex?: boolean;
  };
  template: string;
  script: string;
  scriptSetup: boolean;
}

export class VueComponentAnalyzer {
  private logger = createComponentLogger('VueComponentAnalyzer');

  /**
   * 分析 Vue 组件文件
   */
  async analyzeComponent(filePath: string): Promise<VueComponentMetadata> {
    this.logger.info('Analyzing Vue component', { filePath });

    const source = await fs.readFile(filePath, 'utf-8');
    
    // 解析 SFC 结构
    const descriptor = this.parseSFC(source);
    
    // 检测 API 风格
    const apiStyle = this.detectAPIStyle(descriptor);
    
    // 提取元数据
    const metadata: VueComponentMetadata = {
      name: this.extractComponentName(filePath, descriptor),
      filePath,
      apiStyle,
      props: this.extractProps(descriptor, apiStyle),
      emits: this.extractEmits(descriptor, apiStyle),
      slots: this.extractSlots(descriptor),
      composables: this.extractComposables(descriptor),
      refs: this.extractRefs(descriptor),
      computed: this.extractComputed(descriptor, apiStyle),
      watchers: this.extractWatchers(descriptor, apiStyle),
      lifecycle: this.extractLifecycle(descriptor, apiStyle),
      storeUsage: this.extractStoreUsage(descriptor),
      template: descriptor.template || '',
      script: descriptor.script || '',
      scriptSetup: descriptor.scriptSetup || false,
    };

    this.logger.debug('Component analysis complete', {
      name: metadata.name,
      apiStyle: metadata.apiStyle,
      propsCount: metadata.props.length,
      emitsCount: metadata.emits.length
    });

    return metadata;
  }

  /**
   * 解析 SFC 结构（简化版，生产环境应使用 @vue/compiler-sfc）
   */
  private parseSFC(source: string): {
    template?: string;
    script?: string;
    scriptSetup?: boolean;
  } {
    const templateMatch = source.match(/<template>([\s\S]*?)<\/template>/);
    const scriptMatch = source.match(/<script(?: setup)?>([\s\S]*?)<\/script>/);
    const scriptSetup = /<script setup>/.test(source);

    return {
      template: templateMatch ? templateMatch[1] : undefined,
      script: scriptMatch ? scriptMatch[1] : undefined,
      scriptSetup,
    };
  }

  /**
   * 检测 API 风格
   */
  private detectAPIStyle(descriptor: any): 'composition' | 'options' | 'mixed' {
    const script = descriptor.script || '';
    
    const hasSetup = descriptor.scriptSetup || /setup\s*\(/.test(script);
    const hasOptions = /export\s+default\s*{/.test(script) && 
                       (/data\s*\(/.test(script) || /methods\s*:/.test(script));
    
    if (hasSetup && hasOptions) return 'mixed';
    if (hasSetup) return 'composition';
    return 'options';
  }

  /**
   * 提取组件名称
   */
  private extractComponentName(filePath: string, descriptor: any): string {
    // 1. 尝试从 script 中提取 name 属性
    const script = descriptor.script || '';
    const nameMatch = script.match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (nameMatch) return nameMatch[1];

    // 2. 从文件名推断
    const fileName = filePath.split('/').pop()?.replace('.vue', '') || 'Unknown';
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  /**
   * 提取 props 定义
   */
  private extractProps(descriptor: any, apiStyle: string): VueProp[] {
    const script = descriptor.script || '';
    const props: VueProp[] = [];

    if (apiStyle === 'composition' && descriptor.scriptSetup) {
      // Composition API with <script setup>
      // 查找 defineProps
      const definePropsMatch = script.match(/defineProps<{([\s\S]*?)}>\(\)/);
      if (definePropsMatch) {
        const propsType = definePropsMatch[1];
        const propMatches = propsType.matchAll(/(\w+)(\?)?:\s*([^;]+)/g);
        
        for (const match of propMatches) {
          props.push({
            name: match[1],
            type: match[3].trim(),
            required: !match[2], // 没有 ? 表示必需
          });
        }
      }

      // 查找 withDefaults
      const withDefaultsMatch = script.match(/withDefaults\(defineProps<[\s\S]*?>,\s*{([\s\S]*?)}\)/);
      if (withDefaultsMatch) {
        const defaults = withDefaultsMatch[1];
        const defaultMatches = defaults.matchAll(/(\w+):\s*([^,]+)/g);
        
        for (const match of defaultMatches) {
          const propName = match[1];
          const defaultValue = match[2].trim();
          const existingProp = props.find(p => p.name === propName);
          if (existingProp) {
            existingProp.default = defaultValue;
          }
        }
      }
    } else {
      // Options API
      const propsMatch = script.match(/props\s*:\s*{([\s\S]*?)}/);
      if (propsMatch) {
        const propsContent = propsMatch[1];
        const propMatches = propsContent.matchAll(/(\w+):\s*{([^}]+)}/g);
        
        for (const match of propMatches) {
          const propName = match[1];
          const propConfig = match[2];
          
          const typeMatch = propConfig.match(/type:\s*(\w+|\[[\s\S]*?\])/);
          const requiredMatch = propConfig.match(/required:\s*(true|false)/);
          const defaultMatch = propConfig.match(/default:\s*([^,]+)/);
          
          props.push({
            name: propName,
            type: typeMatch ? typeMatch[1] : 'any',
            required: requiredMatch ? requiredMatch[1] === 'true' : false,
            default: defaultMatch ? defaultMatch[1].trim() : undefined,
          });
        }
      }
    }

    return props;
  }

  /**
   * 提取 emits 定义
   */
  private extractEmits(descriptor: any, apiStyle: string): VueEmit[] {
    const script = descriptor.script || '';
    const emits: VueEmit[] = [];

    if (apiStyle === 'composition' && descriptor.scriptSetup) {
      // defineEmits
      const defineEmitsMatch = script.match(/defineEmits<{([\s\S]*?)}>\(\)/);
      if (defineEmitsMatch) {
        const emitsType = defineEmitsMatch[1];
        const emitMatches = emitsType.matchAll(/(\w+):\s*\[([^\]]*)\]/g);
        
        for (const match of emitMatches) {
          emits.push({
            name: match[1],
            payload: match[2].trim() || undefined,
          });
        }
      }

      // 简单数组形式
      const simpleEmitsMatch = script.match(/defineEmits\(\[([\s\S]*?)\]\)/);
      if (simpleEmitsMatch) {
        const emitNames = simpleEmitsMatch[1].match(/['"]([^'"]+)['"]/g);
        if (emitNames) {
          emitNames.forEach(name => {
            emits.push({
              name: name.replace(/['"]/g, ''),
            });
          });
        }
      }
    } else {
      // Options API
      const emitsMatch = script.match(/emits:\s*\[([\s\S]*?)\]/);
      if (emitsMatch) {
        const emitNames = emitsMatch[1].match(/['"]([^'"]+)['"]/g);
        if (emitNames) {
          emitNames.forEach(name => {
            emits.push({
              name: name.replace(/['"]/g, ''),
            });
          });
        }
      }
    }

    return emits;
  }

  /**
   * 提取 slots
   */
  private extractSlots(descriptor: any): VueSlot[] {
    const template = descriptor.template || '';
    const slots: VueSlot[] = [];

    // 查找 <slot> 标签
    const slotMatches = template.matchAll(/<slot\s+name=['"]([^'"]+)['"][^>]*>/g);
    for (const match of slotMatches) {
      slots.push({
        name: match[1],
      });
    }

    // 默认插槽
    if (/<slot\s*\/?>/.test(template) || /<slot>/.test(template)) {
      slots.push({
        name: 'default',
      });
    }

    return slots;
  }

  /**
   * 提取 composables
   */
  private extractComposables(descriptor: any): VueComposable[] {
    const script = descriptor.script || '';
    const composables: VueComposable[] = [];

    // 查找 use* 函数调用
    const useMatches = script.matchAll(/const\s+\{?([^}]+)\}?\s*=\s*(use\w+)\(/g);
    for (const match of useMatches) {
      composables.push({
        name: match[2],
        source: 'custom',
        usage: match[1].trim(),
      });
    }

    // Vue 内置 composables
    const vueComposables = ['useRoute', 'useRouter', 'useState', 'useFetch', 'useAsyncData'];
    vueComposables.forEach(name => {
      if (script.includes(name)) {
        composables.push({
          name,
          source: 'vue',
          usage: name,
        });
      }
    });

    return composables;
  }

  /**
   * 提取 refs
   */
  private extractRefs(descriptor: any): string[] {
    const script = descriptor.script || '';
    const refs: string[] = [];

    // ref() 调用
    const refMatches = script.matchAll(/const\s+(\w+)\s*=\s*ref\(/g);
    for (const match of refMatches) {
      refs.push(match[1]);
    }

    // template refs
    const template = descriptor.template || '';
    const templateRefMatches = template.matchAll(/ref=['"]([^'"]+)['"]/g);
    for (const match of templateRefMatches) {
      refs.push(match[1]);
    }

    return refs;
  }

  /**
   * 提取 computed 属性
   */
  private extractComputed(descriptor: any, apiStyle: string): string[] {
    const script = descriptor.script || '';
    const computed: string[] = [];

    if (apiStyle === 'composition') {
      // computed() 调用
      const computedMatches = script.matchAll(/const\s+(\w+)\s*=\s*computed\(/g);
      for (const match of computedMatches) {
        computed.push(match[1]);
      }
    } else {
      // Options API
      const computedMatch = script.match(/computed\s*:\s*{([\s\S]*?)}/);
      if (computedMatch) {
        const computedContent = computedMatch[1];
        const propMatches = computedContent.matchAll(/(\w+)\s*\(/g);
        for (const match of propMatches) {
          computed.push(match[1]);
        }
      }
    }

    return computed;
  }

  /**
   * 提取 watchers
   */
  private extractWatchers(descriptor: any, apiStyle: string): string[] {
    const script = descriptor.script || '';
    const watchers: string[] = [];

    if (apiStyle === 'composition') {
      // watch() 和 watchEffect() 调用
      const watchMatches = script.matchAll(/watch(?:Effect)?\((?:\(\)\s*=>)?\s*(\w+)/g);
      for (const match of watchMatches) {
        watchers.push(match[1]);
      }
    } else {
      // Options API
      const watchMatch = script.match(/watch\s*:\s*{([\s\S]*?)}/);
      if (watchMatch) {
        const watchContent = watchMatch[1];
        const propMatches = watchContent.matchAll(/['"]?(\w+)['"]?\s*[:(]/g);
        for (const match of propMatches) {
          watchers.push(match[1]);
        }
      }
    }

    return watchers;
  }

  /**
   * 提取生命周期钩子
   */
  private extractLifecycle(descriptor: any, apiStyle: string): string[] {
    const script = descriptor.script || '';
    const lifecycle: string[] = [];

    if (apiStyle === 'composition') {
      // Composition API 生命周期
      const hooks = ['onMounted', 'onUpdated', 'onUnmounted', 'onBeforeMount', 
                     'onBeforeUpdate', 'onBeforeUnmount', 'onActivated', 'onDeactivated'];
      hooks.forEach(hook => {
        if (script.includes(hook)) {
          lifecycle.push(hook);
        }
      });
    } else {
      // Options API 生命周期
      const hooks = ['mounted', 'updated', 'unmounted', 'beforeMount', 
                     'beforeUpdate', 'beforeUnmount', 'activated', 'deactivated'];
      hooks.forEach(hook => {
        const regex = new RegExp(`${hook}\\s*\\(`);
        if (regex.test(script)) {
          lifecycle.push(hook);
        }
      });
    }

    return lifecycle;
  }

  /**
   * 提取状态管理使用情况
   */
  private extractStoreUsage(descriptor: any): {
    pinia?: string[];
    vuex?: boolean;
  } {
    const script = descriptor.script || '';
    const storeUsage: { pinia?: string[]; vuex?: boolean } = {};

    // Pinia stores
    const piniaStores: string[] = [];
    const piniaMatches = script.matchAll(/use(\w+Store)\(/g);
    for (const match of piniaMatches) {
      piniaStores.push(match[1]);
    }
    if (piniaStores.length > 0) {
      storeUsage.pinia = piniaStores;
    }

    // Vuex
    if (script.includes('useStore()') || script.includes('this.$store')) {
      storeUsage.vuex = true;
    }

    return storeUsage;
  }
}

