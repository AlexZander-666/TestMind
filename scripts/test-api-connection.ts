/**
 * API连接测试
 * 快速验证API配置是否正确
 */

import { LLMService } from '../packages/core/src/llm/LLMService';

async function testAPIConnection() {
  console.log('\n🔧 测试API连接...\n');
  console.log('配置信息:');
  console.log(`  API Base: ${process.env.OPENAI_API_BASE || 'default'}`);
  console.log(`  Model: ${process.env.OPENAI_MODEL || 'default'}`);
  console.log(`  API Key: ***${process.env.OPENAI_API_KEY?.substring(process.env.OPENAI_API_KEY.length - 8) || 'not set'}\n`);

  try {
    const llmService = new LLMService();

    console.log('📤 发送测试请求...');
    const startTime = Date.now();

    const response = await llmService.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      prompt: 'Say "Hello TestMind!" in exactly 3 words.',
      temperature: 0.1,
      maxTokens: 10000
    });

    const duration = Date.now() - startTime;

    console.log('\n✅ API连接成功!\n');
    console.log('响应信息:');
    console.log(`  内容: "${response.content}"`);
    console.log(`  耗时: ${duration}ms`);
    console.log(`  Token使用: ${response.usage?.totalTokens || 'N/A'}`);

    return true;

  } catch (error) {
    console.error('\n❌ API连接失败:\n');
    console.error(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      console.error('\n调试信息:');
      console.error(error.stack);
    }

    return false;
  }
}

// 运行测试
testAPIConnection().then(success => {
  if (success) {
    console.log('\n🎉 API配置正确，可以开始Shannon验证！\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  请检查API配置后重试\n');
    process.exit(1);
  }
});

