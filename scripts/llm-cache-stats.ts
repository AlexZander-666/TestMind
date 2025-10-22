/**
 * LLM缓存统计查看工具
 * 显示缓存命中率、大小、节省的API调用次数等
 */

import { llmCache } from '../packages/core/src/llm/LLMCache';

function displayCacheStats() {
  console.log('\n📊 LLM缓存统计\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const stats = llmCache.getStats();
  
  console.log(`\n🗄️  缓存大小: ${stats.size} 条目`);
  console.log(`\n📈 使用统计:`);
  console.log(`   命中: ${stats.hits} 次`);
  console.log(`   未命中: ${stats.misses} 次`);
  console.log(`   总计: ${stats.hits + stats.misses} 次`);
  
  const hitRatePercent = (stats.hitRate * 100).toFixed(2);
  console.log(`\n✨ 命中率: ${hitRatePercent}%`);
  
  console.log(`\n💰 节省的API调用: ${stats.totalSaved} 次`);
  
  // 估算节省的成本（基于Gemini 2.5 Pro平均成本）
  const avgCostPerCall = 0.0085; // 基于测试结果
  const savedCost = stats.totalSaved * avgCostPerCall;
  console.log(`   估算节省成本: $${savedCost.toFixed(4)}`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 性能建议
  if (stats.hitRate < 0.3 && stats.hits + stats.misses > 10) {
    console.log('💡 建议: 缓存命中率较低，考虑增加缓存大小或调整TTL');
  } else if (stats.hitRate > 0.5) {
    console.log('🎉 很好！缓存命中率超过50%，性能优化效果显著！');
  }
  
  console.log('');
}

// 命令行参数
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'clear':
    llmCache.clear();
    console.log('✅ 缓存已清除');
    break;
    
  case 'reset':
    llmCache.resetStats();
    console.log('✅ 统计数据已重置');
    break;
    
  case 'export':
    const data = llmCache.export();
    console.log(data);
    break;
    
  default:
    displayCacheStats();
}





























