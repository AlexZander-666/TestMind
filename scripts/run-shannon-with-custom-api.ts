/**
 * Shannon测试生成 - 使用自定义API配置
 * 配置：Gemini 2.5 Pro via custom endpoint
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

async function runWithCustomAPI() {
  console.log(chalk.bold.cyan('\n🔧 配置自定义LLM API\n'));

  // 配置信息
  const config = {
    apiUrl: 'https://metahk.zenymes.com/v1',
    apiKey: 'sk-8ZP1cge3SxPFY5nwKB6poOWxDLJczqzk4vZ1LnryW0WjZCPh',
    model: 'gemini-2.5-pro',
  };

  console.log(chalk.green('✓ API配置：'));
  console.log(chalk.gray(`  URL: ${config.apiUrl}`));
  console.log(chalk.gray(`  Model: ${config.model}`));
  console.log(chalk.gray(`  Key: ${config.apiKey.slice(0, 10)}...`));
  console.log();

  console.log(chalk.yellow('⚠️  准备运行Shannon测试生成...\n'));

  // 设置环境变量并运行测试生成脚本
  const env = {
    ...process.env,
    OPENAI_API_KEY: config.apiKey,
    OPENAI_API_BASE: config.apiUrl,
    OPENAI_MODEL: config.model,
  };

  return new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      ['tsx', 'scripts/shannon-test-generator.ts'],
      {
        env,
        stdio: 'inherit',
        shell: true,
      }
    );

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// 运行
runWithCustomAPI()
  .then(() => {
    console.log(chalk.green.bold('\n✅ Shannon验证完成！\n'));
    console.log(chalk.cyan('查看结果：'));
    console.log(chalk.gray('  - shannon-validation-output/GENERATION_REPORT.md'));
    console.log(chalk.gray('  - shannon-validation-output/generated-tests/\n'));
  })
  .catch((error) => {
    console.error(chalk.red('\n❌ 运行失败:'), error);
    process.exit(1);
  });










