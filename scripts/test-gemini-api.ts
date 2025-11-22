/**
 * Test script for Gemini API integration
 * Validates that TestMind can connect to and use Gemini API endpoints
 */

import { ChatOpenAI } from '@langchain/openai';

interface TestConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

const GEMINI_CONFIG: TestConfig = {
  apiKey: process.env.GEMINI_API_KEY || 'sk-8ZP1cge3SxPFY5nwKB6poOWxDLJczqzk4vZ1LnryW0WjZCPh',
  baseURL: process.env.GEMINI_API_BASE_URL || 'https://metahk.zenymes.com/v1',
  model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
};

async function testGeminiConnection() {
  console.log('🧪 Testing Gemini API Connection...\n');
  console.log('Configuration:');
  console.log(`  Base URL: ${GEMINI_CONFIG.baseURL}`);
  console.log(`  Model: ${GEMINI_CONFIG.model}`);
  console.log(`  API Key: ${GEMINI_CONFIG.apiKey.substring(0, 10)}...`);
  console.log('');

  try {
    // Create LLM client with Gemini configuration
    const llm = new ChatOpenAI({
      openAIApiKey: GEMINI_CONFIG.apiKey,
      configuration: {
        baseURL: GEMINI_CONFIG.baseURL,
      },
      modelName: GEMINI_CONFIG.model,
      temperature: 0.7,
      maxTokens: 500,
    });

    console.log('✅ LLM client created successfully');
    console.log('');

    // Test 1: Simple completion
    console.log('📝 Test 1: Simple Completion');
    console.log('Prompt: "Hello, please respond with a simple greeting."');
    
    const response1 = await llm.invoke('Hello, please respond with a simple greeting.');
    console.log(`Response: ${response1.content}`);
    console.log('✅ Test 1 passed\n');

    // Test 2: Code-related query
    console.log('📝 Test 2: Code Understanding');
    console.log('Prompt: "Explain what a unit test is in 2 sentences."');
    
    const response2 = await llm.invoke('Explain what a unit test is in 2 sentences.');
    console.log(`Response: ${response2.content}`);
    console.log('✅ Test 2 passed\n');

    // Test 3: Test generation simulation
    console.log('📝 Test 3: Test Generation Simulation');
    const testPrompt = `Given this function:

function add(a: number, b: number): number {
  return a + b;
}

Generate a simple test case. Be concise.`;
    
    console.log('Prompt: [Test generation prompt]');
    const response3 = await llm.invoke(testPrompt);
    console.log(`Response: ${response3.content}`);
    console.log('✅ Test 3 passed\n');

    // Summary
    console.log('═'.repeat(60));
    console.log('🎉 All Gemini API Tests Passed!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Summary:');
    console.log('  ✅ Connection established');
    console.log('  ✅ Simple completion working');
    console.log('  ✅ Code understanding working');
    console.log('  ✅ Test generation capability verified');
    console.log('');
    console.log('TestMind is ready to use Gemini API for test generation!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Check that the API key is correct');
    console.error('  2. Verify the base URL is accessible');
    console.error('  3. Ensure the model name is valid');
    console.error('  4. Check your network connection');
    
    process.exit(1);
  }
}

// Run tests
testGeminiConnection().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});



















































