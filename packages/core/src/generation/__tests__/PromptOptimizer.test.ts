/**
 * PromptOptimizer 单元测试
 */

import { describe, it, expect } from 'vitest';
import { PromptOptimizer } from '../PromptOptimizer';
import type { CodeChunk } from '@testmind/shared';

describe('PromptOptimizer', () => {
  let optimizer: PromptOptimizer;
  
  beforeEach(() => {
    optimizer = new PromptOptimizer();
  });
  
  describe('optimize', () => {
    it('should optimize prompt and save tokens', async () => {
      const prompt = `Generate tests.


Please generate comprehensive tests.

Make sure to include edge cases.`;
      
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'file.ts',
          content: `// This is a comment
function add(a, b) {
  // Add two numbers
  return a + b;
}`,
          startLine: 1,
          endLine: 5,
        },
      ];
      
      const result = await optimizer.optimize(prompt, chunks, {
        keepComments: false,
        keepEmptyLines: false,
      });
      
      expect(result.optimizedTokens).toBeLessThan(result.originalTokens);
      expect(result.savedPercentage).toBeGreaterThan(0);
      expect(result.appliedOptimizations.length).toBeGreaterThan(0);
    });
    
    it('should preserve comments when keepComments is true', async () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'file.ts',
          content: `// Important comment
function test() {}`,
          startLine: 1,
          endLine: 2,
        },
      ];
      
      const result = await optimizer.optimize('prompt', chunks, {
        keepComments: true,
      });
      
      expect(result.optimizedPrompt).toContain('// Important comment');
      expect(result.appliedOptimizations).not.toContain('remove-comments');
    });
    
    it('should apply more aggressive optimizations when aggressiveness is high', async () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'file.ts',
          content: 'const userRepository = new UserRepository();',
          startLine: 1,
          endLine: 1,
        },
      ];
      
      const result = await optimizer.optimize('prompt', chunks, {
        aggressiveness: 0.9,
        maxTokens: 100,
      });
      
      expect(result.appliedOptimizations.length).toBeGreaterThan(2);
    });
  });
  
  describe('compressPromptTemplate', () => {
    it('should remove unnecessary words', () => {
      const template = `Please kindly generate tests.
      
Important: Make sure to follow best practices.

Note: Include edge cases.`;
      
      const compressed = optimizer.compressPromptTemplate(template);
      
      expect(compressed).not.toContain('Please');
      expect(compressed).not.toContain('kindly');
      expect(compressed.length).toBeLessThan(template.length);
    });
    
    it('should compress whitespace', () => {
      const template = `Generate    tests.


Please    use    best    practices.`;
      
      const compressed = optimizer.compressPromptTemplate(template);
      
      expect(compressed).not.toContain('    ');
      expect(compressed).not.toContain('\n\n\n');
    });
  });
});

