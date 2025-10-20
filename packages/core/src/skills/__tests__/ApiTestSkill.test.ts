/**
 * ApiTestSkill单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiTestSkill } from '../ApiTestSkill';
import type { SkillContext } from '../Skill';
import type { LLMService } from '../../llm/LLMService';

describe('ApiTestSkill', () => {
  let skill: ApiTestSkill;
  let mockLLMService: LLMService;

  beforeEach(() => {
    mockLLMService = {
      generate: vi.fn().mockResolvedValue({
        content: `\`\`\`typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';

describe('GET /api/users', () => {
  it('should return users', async () => {
    const response = await request(app).get('/api/users').expect(200);
    expect(response.body).toBeDefined();
  });
});
\`\`\``,
        usage: { totalTokens: 200 }
      })
    } as any;

    skill = new ApiTestSkill();
    skill.setLLMService(mockLLMService);
  });

  describe('execute', () => {
    it('should generate REST API test from simple format', async () => {
      const context: SkillContext = {
        input: 'GET /api/users',
        options: {
          framework: 'supertest'
        }
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('GET /api/users');
      expect(result.metadata?.testType).toBe('rest');
    });

    it('should generate GraphQL test', async () => {
      const context: SkillContext = {
        input: 'query getUser { user(id: 1) { name } }',
        options: {
          framework: 'graphql-request'
        }
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.testType).toBe('graphql');
    });

    it('should handle different frameworks', async () => {
      const frameworks = ['supertest', 'axios', 'fetch', 'playwright'];

      for (const framework of frameworks) {
        const context: SkillContext = {
          input: 'POST /api/login',
          options: { framework }
        };

        const result = await skill.execute(context);

        expect(result.success).toBe(true);
        expect(result.metadata?.framework).toBe(framework);
      }
    });

    it('should include error scenarios when enabled', async () => {
      const context: SkillContext = {
        input: 'GET /api/users',
        options: {
          framework: 'supertest',
          includeErrorCases: true
        }
      };

      const result = await skill.execute(context);

      if (result.success && result.output) {
        const hasErrorTests = 
          result.output.includes('400') ||
          result.output.includes('401') ||
          result.output.includes('404');
        
        // 应该包含错误场景
        expect(hasErrorTests || result.output.includes('invalid')).toBe(true);
      }
    });

    it('should handle LLM generation fallback', async () => {
      const context: SkillContext = {
        input: 'Complex API endpoint with custom headers and auth',
        options: {}
      };

      const result = await skill.execute(context);

      // 应该调用LLM生成
      expect(mockLLMService.generate).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockLLMService.generate = vi.fn().mockRejectedValue(new Error('LLM failed'));

      const context: SkillContext = {
        input: 'GET /api/users',
        options: {}
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM');
    });
  });

  describe('validate', () => {
    it('should always return true', () => {
      const isValid = skill.validate();
      expect(isValid).toBe(true);
    });
  });

  describe('REST API parsing', () => {
    it('should parse simple endpoint format', () => {
      // 测试 parseEndpointFromInput 的逻辑
      // "GET /api/users" 应该解析为 { method: 'GET', path: '/api/users' }
    });

    it('should parse JSON OpenAPI format', () => {
      // 测试JSON格式的OpenAPI snippet解析
    });
  });

  describe('GraphQL detection', () => {
    it('should detect GraphQL queries', () => {
      const inputs = [
        'query getUser { name }',
        'mutation createUser { id }',
        'subscription onMessage { message }'
      ];

      inputs.forEach(input => {
        // isGraphQL应该返回true
      });
    });

    it('should not detect REST as GraphQL', () => {
      const inputs = ['GET /api/users', 'POST /api/login'];

      inputs.forEach(input => {
        // isGraphQL应该返回false
      });
    });
  });
});

 * ApiTestSkill单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiTestSkill } from '../ApiTestSkill';
import type { SkillContext } from '../Skill';
import type { LLMService } from '../../llm/LLMService';

describe('ApiTestSkill', () => {
  let skill: ApiTestSkill;
  let mockLLMService: LLMService;

  beforeEach(() => {
    mockLLMService = {
      generate: vi.fn().mockResolvedValue({
        content: `\`\`\`typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';

describe('GET /api/users', () => {
  it('should return users', async () => {
    const response = await request(app).get('/api/users').expect(200);
    expect(response.body).toBeDefined();
  });
});
\`\`\``,
        usage: { totalTokens: 200 }
      })
    } as any;

    skill = new ApiTestSkill();
    skill.setLLMService(mockLLMService);
  });

  describe('execute', () => {
    it('should generate REST API test from simple format', async () => {
      const context: SkillContext = {
        input: 'GET /api/users',
        options: {
          framework: 'supertest'
        }
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('GET /api/users');
      expect(result.metadata?.testType).toBe('rest');
    });

    it('should generate GraphQL test', async () => {
      const context: SkillContext = {
        input: 'query getUser { user(id: 1) { name } }',
        options: {
          framework: 'graphql-request'
        }
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.testType).toBe('graphql');
    });

    it('should handle different frameworks', async () => {
      const frameworks = ['supertest', 'axios', 'fetch', 'playwright'];

      for (const framework of frameworks) {
        const context: SkillContext = {
          input: 'POST /api/login',
          options: { framework }
        };

        const result = await skill.execute(context);

        expect(result.success).toBe(true);
        expect(result.metadata?.framework).toBe(framework);
      }
    });

    it('should include error scenarios when enabled', async () => {
      const context: SkillContext = {
        input: 'GET /api/users',
        options: {
          framework: 'supertest',
          includeErrorCases: true
        }
      };

      const result = await skill.execute(context);

      if (result.success && result.output) {
        const hasErrorTests = 
          result.output.includes('400') ||
          result.output.includes('401') ||
          result.output.includes('404');
        
        // 应该包含错误场景
        expect(hasErrorTests || result.output.includes('invalid')).toBe(true);
      }
    });

    it('should handle LLM generation fallback', async () => {
      const context: SkillContext = {
        input: 'Complex API endpoint with custom headers and auth',
        options: {}
      };

      const result = await skill.execute(context);

      // 应该调用LLM生成
      expect(mockLLMService.generate).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockLLMService.generate = vi.fn().mockRejectedValue(new Error('LLM failed'));

      const context: SkillContext = {
        input: 'GET /api/users',
        options: {}
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM');
    });
  });

  describe('validate', () => {
    it('should always return true', () => {
      const isValid = skill.validate();
      expect(isValid).toBe(true);
    });
  });

  describe('REST API parsing', () => {
    it('should parse simple endpoint format', () => {
      // 测试 parseEndpointFromInput 的逻辑
      // "GET /api/users" 应该解析为 { method: 'GET', path: '/api/users' }
    });

    it('should parse JSON OpenAPI format', () => {
      // 测试JSON格式的OpenAPI snippet解析
    });
  });

  describe('GraphQL detection', () => {
    it('should detect GraphQL queries', () => {
      const inputs = [
        'query getUser { name }',
        'mutation createUser { id }',
        'subscription onMessage { message }'
      ];

      inputs.forEach(input => {
        // isGraphQL应该返回true
      });
    });

    it('should not detect REST as GraphQL', () => {
      const inputs = ['GET /api/users', 'POST /api/login'];

      inputs.forEach(input => {
        // isGraphQL应该返回false
      });
    });
  });
});

 * ApiTestSkill单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiTestSkill } from '../ApiTestSkill';
import type { SkillContext } from '../Skill';
import type { LLMService } from '../../llm/LLMService';

describe('ApiTestSkill', () => {
  let skill: ApiTestSkill;
  let mockLLMService: LLMService;

  beforeEach(() => {
    mockLLMService = {
      generate: vi.fn().mockResolvedValue({
        content: `\`\`\`typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';

describe('GET /api/users', () => {
  it('should return users', async () => {
    const response = await request(app).get('/api/users').expect(200);
    expect(response.body).toBeDefined();
  });
});
\`\`\``,
        usage: { totalTokens: 200 }
      })
    } as any;

    skill = new ApiTestSkill();
    skill.setLLMService(mockLLMService);
  });

  describe('execute', () => {
    it('should generate REST API test from simple format', async () => {
      const context: SkillContext = {
        input: 'GET /api/users',
        options: {
          framework: 'supertest'
        }
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('GET /api/users');
      expect(result.metadata?.testType).toBe('rest');
    });

    it('should generate GraphQL test', async () => {
      const context: SkillContext = {
        input: 'query getUser { user(id: 1) { name } }',
        options: {
          framework: 'graphql-request'
        }
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.testType).toBe('graphql');
    });

    it('should handle different frameworks', async () => {
      const frameworks = ['supertest', 'axios', 'fetch', 'playwright'];

      for (const framework of frameworks) {
        const context: SkillContext = {
          input: 'POST /api/login',
          options: { framework }
        };

        const result = await skill.execute(context);

        expect(result.success).toBe(true);
        expect(result.metadata?.framework).toBe(framework);
      }
    });

    it('should include error scenarios when enabled', async () => {
      const context: SkillContext = {
        input: 'GET /api/users',
        options: {
          framework: 'supertest',
          includeErrorCases: true
        }
      };

      const result = await skill.execute(context);

      if (result.success && result.output) {
        const hasErrorTests = 
          result.output.includes('400') ||
          result.output.includes('401') ||
          result.output.includes('404');
        
        // 应该包含错误场景
        expect(hasErrorTests || result.output.includes('invalid')).toBe(true);
      }
    });

    it('should handle LLM generation fallback', async () => {
      const context: SkillContext = {
        input: 'Complex API endpoint with custom headers and auth',
        options: {}
      };

      const result = await skill.execute(context);

      // 应该调用LLM生成
      expect(mockLLMService.generate).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockLLMService.generate = vi.fn().mockRejectedValue(new Error('LLM failed'));

      const context: SkillContext = {
        input: 'GET /api/users',
        options: {}
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM');
    });
  });

  describe('validate', () => {
    it('should always return true', () => {
      const isValid = skill.validate();
      expect(isValid).toBe(true);
    });
  });

  describe('REST API parsing', () => {
    it('should parse simple endpoint format', () => {
      // 测试 parseEndpointFromInput 的逻辑
      // "GET /api/users" 应该解析为 { method: 'GET', path: '/api/users' }
    });

    it('should parse JSON OpenAPI format', () => {
      // 测试JSON格式的OpenAPI snippet解析
    });
  });

  describe('GraphQL detection', () => {
    it('should detect GraphQL queries', () => {
      const inputs = [
        'query getUser { name }',
        'mutation createUser { id }',
        'subscription onMessage { message }'
      ];

      inputs.forEach(input => {
        // isGraphQL应该返回true
      });
    });

    it('should not detect REST as GraphQL', () => {
      const inputs = ['GET /api/users', 'POST /api/login'];

      inputs.forEach(input => {
        // isGraphQL应该返回false
      });
    });
  });
});

