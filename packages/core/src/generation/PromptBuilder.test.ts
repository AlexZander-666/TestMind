import { buildUnitTestPrompt } from '../../src/generation/PromptBuilder';
import { PromptContext } from '../../src/types'; // Assuming PromptContext is defined in a types file

describe('buildUnitTestPrompt', () => {
    // Arrange: Define a base prompt context to be used and extended in tests
    const basePromptContext: PromptContext = {
        codeToTest: `function add(a: number, b: number): number {\n  return a + b;\n}`,
        filePath: 'src/utils/math.ts',
        languageId: 'typescript',
        testFramework: 'jest',
    };

    /**
     * Test case for the most common scenario: a simple TypeScript function
     * with Jest as the testing framework.
     */
    test('should generate a basic prompt for a TypeScript function with Jest', () => {
        // Arrange
        const promptContext = { ...basePromptContext };

        // Act
        const result = buildUnitTestPrompt(promptContext);

        // Assert
        // Check for the core instruction
        expect(result).toContain('You are an expert test engineer. Your task is to write a comprehensive unit test suite for the following code.');
        // Check for language and framework specification
        expect(result).toContain('Language: typescript');
        expect(result).toContain('Test Framework: jest');
        // Check for file path inclusion
        expect(result).toContain(`File Path: ${promptContext.filePath}`);
        // Check for the code to be tested, correctly formatted in a markdown block
        expect(result).toContain('### Code to Test');
        expect(result).toContain('```typescript');
        expect(result).toContain('function add');
    });
});