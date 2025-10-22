/**
 * BoundaryConditionDetector - 智能边界条件检测引擎
 * 
 * 功能：
 * - 自动识别 20+ 边界条件类型
 * - 基于函数签名和逻辑分析
 * - 生成边界条件测试用例
 */

import type { FunctionContext } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

export interface BoundaryCondition {
  type: string;
  description: string;
  testCases: Array<{
    value: any;
    description: string;
    expected?: 'pass' | 'fail' | 'throw';
  }>;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class BoundaryConditionDetector {
  private logger = createComponentLogger('BoundaryConditionDetector');

  /**
   * 检测函数的边界条件
   */
  detectConditions(functionContext: FunctionContext): BoundaryCondition[] {
    this.logger.debug('Detecting boundary conditions', { 
      function: functionContext.signature.name 
    });

    const conditions: BoundaryCondition[] = [];
    const params = functionContext.signature.params;
    const code = functionContext.code;

    // 1. 数值边界
    conditions.push(...this.detectNumericBoundaries(params, code));

    // 2. 字符串边界
    conditions.push(...this.detectStringBoundaries(params, code));

    // 3. 数组边界
    conditions.push(...this.detectArrayBoundaries(params, code));

    // 4. 对象边界
    conditions.push(...this.detectObjectBoundaries(params, code));

    // 5. 布尔边界
    conditions.push(...this.detectBooleanBoundaries(params, code));

    // 6. 日期边界
    conditions.push(...this.detectDateBoundaries(params, code));

    // 7. 正则表达式边界
    conditions.push(...this.detectRegexBoundaries(params, code));

    // 8. 异步超时边界
    conditions.push(...this.detectAsyncBoundaries(functionContext));

    // 9. 文件大小边界
    conditions.push(...this.detectFileSizeBoundaries(params, code));

    // 10. 并发边界
    conditions.push(...this.detectConcurrencyBoundaries(code));

    // 11. Null/Undefined 边界
    conditions.push(...this.detectNullBoundaries(params, code));

    // 12. 类型边界
    conditions.push(...this.detectTypeBoundaries(params, code));

    // 13. 范围边界
    conditions.push(...this.detectRangeBoundaries(params, code));

    // 14. 精度边界
    conditions.push(...this.detectPrecisionBoundaries(params, code));

    // 15. 循环边界
    conditions.push(...this.detectLoopBoundaries(code));

    this.logger.info('Boundary conditions detected', { 
      count: conditions.length,
      types: conditions.map(c => c.type)
    });

    return conditions;
  }

  /**
   * 1. 数值边界检测
   */
  private detectNumericBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    const numericParams = params.filter(p => 
      p.type === 'number' || 
      p.name.includes('count') || 
      p.name.includes('age') ||
      p.name.includes('index')
    );

    if (numericParams.length > 0) {
      conditions.push({
        type: 'numeric',
        description: '数值边界测试',
        testCases: [
          { value: 0, description: '零值', expected: 'pass' },
          { value: -1, description: '负数', expected: 'fail' },
          { value: 1, description: '正数', expected: 'pass' },
          { value: Number.MAX_SAFE_INTEGER, description: '最大安全整数', expected: 'pass' },
          { value: Number.MIN_SAFE_INTEGER, description: '最小安全整数', expected: 'pass' },
          { value: Number.MAX_VALUE, description: '最大值', expected: 'pass' },
          { value: Number.MIN_VALUE, description: '最小正值', expected: 'pass' },
          { value: Infinity, description: '无穷大', expected: 'fail' },
          { value: -Infinity, description: '负无穷大', expected: 'fail' },
          { value: NaN, description: 'NaN', expected: 'fail' },
          { value: 0.1 + 0.2, description: '浮点精度问题', expected: 'pass' },
        ],
        priority: 'high',
      });
    }

    return conditions;
  }

  /**
   * 2. 字符串边界检测
   */
  private detectStringBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    const stringParams = params.filter(p => 
      p.type === 'string' || 
      p.name.includes('name') || 
      p.name.includes('text') ||
      p.name.includes('message')
    );

    if (stringParams.length > 0) {
      conditions.push({
        type: 'string',
        description: '字符串边界测试',
        testCases: [
          { value: '', description: '空字符串', expected: 'fail' },
          { value: ' ', description: '单个空格', expected: 'fail' },
          { value: '  ', description: '多个空格', expected: 'fail' },
          { value: '\n', description: '换行符', expected: 'fail' },
          { value: '\t', description: '制表符', expected: 'fail' },
          { value: 'a', description: '单字符', expected: 'pass' },
          { value: 'A'.repeat(1000), description: '1000字符', expected: 'pass' },
          { value: 'A'.repeat(10000), description: '10000字符（长字符串）', expected: 'pass' },
          { value: 'A'.repeat(1000000), description: '100万字符（超长）', expected: 'fail' },
          { value: '你好', description: 'Unicode字符', expected: 'pass' },
          { value: '😀🎉', description: 'Emoji', expected: 'pass' },
          { value: '<script>alert("xss")</script>', description: 'HTML/XSS', expected: 'fail' },
          { value: "'; DROP TABLE users;--", description: 'SQL注入', expected: 'fail' },
        ],
        priority: 'critical',
      });
    }

    return conditions;
  }

  /**
   * 3. 数组边界检测
   */
  private detectArrayBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    const arrayParams = params.filter(p => 
      p.type?.includes('[]') || 
      p.type?.includes('Array') ||
      p.name.includes('list') ||
      p.name.includes('items')
    );

    if (arrayParams.length > 0) {
      conditions.push({
        type: 'array',
        description: '数组边界测试',
        testCases: [
          { value: [], description: '空数组', expected: 'fail' },
          { value: [1], description: '单元素数组', expected: 'pass' },
          { value: [1, 2, 3], description: '多元素数组', expected: 'pass' },
          { value: new Array(1000).fill(0), description: '1000元素数组', expected: 'pass' },
          { value: new Array(100000).fill(0), description: '10万元素数组（大数组）', expected: 'pass' },
          { value: [null], description: '包含null的数组', expected: 'fail' },
          { value: [undefined], description: '包含undefined的数组', expected: 'fail' },
          { value: [null, undefined, 1], description: '混合类型数组', expected: 'fail' },
          { value: [[1, 2], [3, 4]], description: '嵌套数组', expected: 'pass' },
        ],
        priority: 'high',
      });
    }

    return conditions;
  }

  /**
   * 4. 对象边界检测
   */
  private detectObjectBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    const objectParams = params.filter(p => 
      p.type === 'object' || 
      p.type?.includes('{') ||
      p.name.includes('data') ||
      p.name.includes('config')
    );

    if (objectParams.length > 0) {
      conditions.push({
        type: 'object',
        description: '对象边界测试',
        testCases: [
          { value: {}, description: '空对象', expected: 'fail' },
          { value: { a: 1 }, description: '单属性对象', expected: 'pass' },
          { value: null, description: 'null', expected: 'fail' },
          { value: undefined, description: 'undefined', expected: 'fail' },
          { value: { a: null }, description: '属性为null', expected: 'fail' },
          { value: { a: undefined }, description: '属性为undefined', expected: 'fail' },
          { value: { a: { b: { c: 1 } } }, description: '深层嵌套对象', expected: 'pass' },
          { value: Object.create(null), description: '无原型对象', expected: 'pass' },
        ],
        priority: 'high',
      });
    }

    return conditions;
  }

  /**
   * 5. 布尔边界检测
   */
  private detectBooleanBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    const booleanParams = params.filter(p => p.type === 'boolean');

    if (booleanParams.length > 0) {
      conditions.push({
        type: 'boolean',
        description: '布尔边界测试',
        testCases: [
          { value: true, description: 'true', expected: 'pass' },
          { value: false, description: 'false', expected: 'pass' },
          { value: 1, description: 'Truthy (1)', expected: 'fail' },
          { value: 0, description: 'Falsy (0)', expected: 'fail' },
          { value: 'true', description: '字符串"true"', expected: 'fail' },
          { value: null, description: 'null', expected: 'fail' },
        ],
        priority: 'medium',
      });
    }

    return conditions;
  }

  /**
   * 6. 日期边界检测
   */
  private detectDateBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    const dateParams = params.filter(p => 
      p.type === 'Date' || 
      p.name.includes('date') ||
      p.name.includes('time')
    );

    if (dateParams.length > 0) {
      conditions.push({
        type: 'date',
        description: '日期边界测试',
        testCases: [
          { value: new Date('1970-01-01'), description: 'Unix纪元', expected: 'pass' },
          { value: new Date('2000-01-01'), description: '千禧年', expected: 'pass' },
          { value: new Date('2038-01-19'), description: 'Unix时间戳溢出前', expected: 'pass' },
          { value: new Date('1900-01-01'), description: '历史日期', expected: 'pass' },
          { value: new Date('2100-01-01'), description: '未来日期', expected: 'pass' },
          { value: new Date('invalid'), description: '无效日期', expected: 'fail' },
          { value: new Date(NaN), description: 'Invalid Date对象', expected: 'fail' },
        ],
        priority: 'medium',
      });
    }

    return conditions;
  }

  /**
   * 7. 正则表达式边界检测
   */
  private detectRegexBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (code.includes('RegExp') || code.includes('/[')) {
      conditions.push({
        type: 'regex',
        description: '正则表达式边界测试',
        testCases: [
          { value: '', description: '空字符串与正则', expected: 'fail' },
          { value: 'a'.repeat(10000), description: '长字符串与复杂正则（ReDoS风险）', expected: 'pass' },
        ],
        priority: 'medium',
      });
    }

    return conditions;
  }

  /**
   * 8. 异步超时边界检测
   */
  private detectAsyncBoundaries(functionContext: FunctionContext): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (functionContext.signature.async || functionContext.code.includes('await') || functionContext.code.includes('Promise')) {
      conditions.push({
        type: 'async-timeout',
        description: '异步超时边界测试',
        testCases: [
          { value: 0, description: '立即完成', expected: 'pass' },
          { value: 1000, description: '1秒超时', expected: 'pass' },
          { value: 30000, description: '30秒超时（长时间）', expected: 'pass' },
          { value: Infinity, description: '无限等待', expected: 'fail' },
        ],
        priority: 'high',
      });
    }

    return conditions;
  }

  /**
   * 9. 文件大小边界检测
   */
  private detectFileSizeBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (code.includes('file') || code.includes('upload') || code.includes('Buffer')) {
      conditions.push({
        type: 'file-size',
        description: '文件大小边界测试',
        testCases: [
          { value: 0, description: '0字节文件', expected: 'fail' },
          { value: 1, description: '1字节文件', expected: 'pass' },
          { value: 1024, description: '1KB文件', expected: 'pass' },
          { value: 1024 * 1024, description: '1MB文件', expected: 'pass' },
          { value: 1024 * 1024 * 10, description: '10MB文件', expected: 'pass' },
          { value: 1024 * 1024 * 100, description: '100MB文件（大文件）', expected: 'fail' },
        ],
        priority: 'medium',
      });
    }

    return conditions;
  }

  /**
   * 10. 并发边界检测
   */
  private detectConcurrencyBoundaries(code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (code.includes('Promise.all') || code.includes('concurrent') || code.includes('parallel')) {
      conditions.push({
        type: 'concurrency',
        description: '并发边界测试',
        testCases: [
          { value: 1, description: '单个并发', expected: 'pass' },
          { value: 10, description: '10个并发', expected: 'pass' },
          { value: 100, description: '100个并发', expected: 'pass' },
          { value: 1000, description: '1000个并发（高并发）', expected: 'pass' },
          { value: 10000, description: '10000个并发（超高并发）', expected: 'fail' },
        ],
        priority: 'high',
      });
    }

    return conditions;
  }

  /**
   * 11. Null/Undefined 边界检测
   */
  private detectNullBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (params.length > 0) {
      conditions.push({
        type: 'null-undefined',
        description: 'Null/Undefined边界测试',
        testCases: [
          { value: null, description: 'null值', expected: 'fail' },
          { value: undefined, description: 'undefined值', expected: 'fail' },
        ],
        priority: 'critical',
      });
    }

    return conditions;
  }

  /**
   * 12. 类型边界检测
   */
  private detectTypeBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (params.length > 0) {
      conditions.push({
        type: 'type-mismatch',
        description: '类型不匹配边界测试',
        testCases: [
          { value: '123', description: '字符串代替数字', expected: 'fail' },
          { value: 123, description: '数字代替字符串', expected: 'fail' },
          { value: [], description: '数组代替对象', expected: 'fail' },
          { value: {}, description: '对象代替数组', expected: 'fail' },
        ],
        priority: 'high',
      });
    }

    return conditions;
  }

  /**
   * 13. 范围边界检测
   */
  private detectRangeBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    // 检测代码中的范围检查（如 if (x > 0 && x < 100)）
    const rangePatterns = [
      />\s*(-?\d+)/g,
      /<\s*(-?\d+)/g,
      />=\s*(-?\d+)/g,
      /<=\s*(-?\d+)/g,
    ];

    for (const pattern of rangePatterns) {
      const matches = code.matchAll(pattern);
      for (const match of matches) {
        const value = parseInt(match[1]);
        conditions.push({
          type: 'range',
          description: `范围边界测试（around ${value}）`,
          testCases: [
            { value: value - 1, description: `边界值-1 (${value - 1})`, expected: 'pass' },
            { value: value, description: `边界值 (${value})`, expected: 'pass' },
            { value: value + 1, description: `边界值+1 (${value + 1})`, expected: 'pass' },
          ],
          priority: 'high',
        });
        break; // 只取第一个范围
      }
    }

    return conditions;
  }

  /**
   * 14. 精度边界检测
   */
  private detectPrecisionBoundaries(params: any[], code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (code.includes('toFixed') || code.includes('toPrecision') || code.includes('Math.round')) {
      conditions.push({
        type: 'precision',
        description: '浮点精度边界测试',
        testCases: [
          { value: 0.1 + 0.2, description: '浮点精度问题 (0.1 + 0.2)', expected: 'pass' },
          { value: 1.0000000000000001, description: '极小精度差异', expected: 'pass' },
          { value: 0.999999999999999, description: '接近1的值', expected: 'pass' },
        ],
        priority: 'medium',
      });
    }

    return conditions;
  }

  /**
   * 15. 循环边界检测
   */
  private detectLoopBoundaries(code: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];

    if (code.includes('for') || code.includes('while') || code.includes('forEach') || code.includes('map')) {
      conditions.push({
        type: 'loop',
        description: '循环边界测试',
        testCases: [
          { value: 0, description: '0次迭代', expected: 'pass' },
          { value: 1, description: '1次迭代', expected: 'pass' },
          { value: 2, description: '2次迭代', expected: 'pass' },
          { value: 100, description: '100次迭代', expected: 'pass' },
          { value: 10000, description: '10000次迭代（大循环）', expected: 'pass' },
        ],
        priority: 'medium',
      });
    }

    return conditions;
  }
}

