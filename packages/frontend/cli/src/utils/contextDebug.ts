import chalk from 'chalk';
import { ContextManager, createComponentLogger } from '@testmind/core';
import type { ProjectConfig } from '@testmind/shared';

const logger = createComponentLogger('context-debug');

export interface ContextDebugOptions {
  query: string;
  projectPath: string;
}

export const printContextDiagnostics = async (
  config: ProjectConfig,
  { query, projectPath }: ContextDebugOptions
): Promise<void> => {
  const manager = new ContextManager(config, projectPath);
  try {
    const hybrid = await manager.buildHybridContext(query, {
      includeExplicit: true,
      includeAutomatic: true,
    });

    logger.info(chalk.bold('\n🔍 Context Diagnostics\n'));
    logger.info(chalk.gray(`Query: ${query}`));
    logger.info(
      chalk.gray(
        `Tokens: ${hybrid.totalTokens.toLocaleString()} (budget ${hybrid.contextSize}) | truncated: ${
          hybrid.truncated ? 'yes' : 'no'
        }\n`
      )
    );

    if (hybrid.ranked.length === 0) {
      logger.info(chalk.yellow('No ranked context available. Use `testmind context add <file>` to seed explicit files.\n'));
      return;
    }

    const rows = hybrid.ranked.slice(0, 5).map((entry, index) => {
      const score = entry.score.toFixed(3);
      const file = entry.chunk.filePath || entry.chunk.id;
      const factors = `sem:${entry.factors.semantic.toFixed(2)} dep:${entry.factors.dependency.toFixed(
        2
      )} rec:${entry.factors.recency.toFixed(2)}`;
      const strategies = entry.matchedStrategies.length > 0 ? entry.matchedStrategies.join(',') : entry.source;
      return `${index + 1}. ${file}  [${score}] (${strategies}) ${factors}`;
    });

    rows.forEach(row => logger.info(row));

    if (hybrid.diagnostics?.dependencyStats) {
      const stats = hybrid.diagnostics.dependencyStats;
      logger.info(
        chalk.gray(
          `\nDependency edges: ${stats.edgesTraversed} | reverse hits: ${stats.reverseHits} | cycles: ${stats.cyclesDetected}`
        )
      );
      logger.info(chalk.gray(`Top files: ${(hybrid.diagnostics.topFiles ?? []).join(', ') || 'n/a'}`));
    } else if (hybrid.diagnostics?.topFiles) {
      logger.info(chalk.gray(`Top files: ${hybrid.diagnostics.topFiles.join(', ') || 'n/a'}`));
    }

    logger.info('');
  } finally {
    await manager.dispose();
  }
};
