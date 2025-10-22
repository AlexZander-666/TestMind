/**
 * MonorepoDetector - Monorepo 和多框架项目智能支持
 * 
 * 功能：
 * - 识别 monorepo 结构（pnpm, yarn, npm workspaces, Nx, Turborepo）
 * - 检测每个包使用的框架
 * - 智能推荐框架组合配置
 * - 生成统一测试配置
 */

import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as glob from 'fast-glob';

export interface WorkspacePackage {
  name: string;
  path: string;
  frameworks: string[];
  testFramework?: string;
  packageJson: any;
}

export interface MonorepoInfo {
  type: 'pnpm' | 'yarn' | 'npm' | 'nx' | 'turborepo' | 'lerna' | 'none';
  rootPath: string;
  packages: WorkspacePackage[];
  pattern: string;
  recommendations: {
    unified: boolean;
    testFramework: string;
    sharedConfig: any;
  };
}

export class MonorepoDetector {
  private logger = createComponentLogger('MonorepoDetector');

  /**
   * 检测多框架项目
   */
  async detectMultiFramework(projectPath: string): Promise<MonorepoInfo> {
    this.logger.info('Detecting monorepo structure', { projectPath });

    // 1. 检测 monorepo 类型
    const type = await this.detectMonorepoType(projectPath);

    // 2. 查找所有 workspace 包
    const packages = await this.findWorkspaces(projectPath, type);

    // 3. 检测每个包的框架
    for (const pkg of packages) {
      pkg.frameworks = await this.detectFrameworks(pkg.path);
      pkg.testFramework = await this.detectTestFramework(pkg.path);
    }

    // 4. 识别框架组合模式
    const pattern = this.identifyPattern(packages);

    // 5. 生成推荐配置
    const recommendations = this.recommendSetup(packages, pattern);

    this.logger.info('Monorepo detection complete', {
      type,
      packagesCount: packages.length,
      pattern,
    });

    return {
      type,
      rootPath: projectPath,
      packages,
      pattern,
      recommendations,
    };
  }

  /**
   * 检测 monorepo 类型
   */
  private async detectMonorepoType(projectPath: string): Promise<MonorepoInfo['type']> {
    const rootPackageJson = path.join(projectPath, 'package.json');
    
    if (!await fs.pathExists(rootPackageJson)) {
      return 'none';
    }

    const packageJson = await fs.readJSON(rootPackageJson);

    // pnpm workspace
    if (await fs.pathExists(path.join(projectPath, 'pnpm-workspace.yaml'))) {
      return 'pnpm';
    }

    // Nx
    if (await fs.pathExists(path.join(projectPath, 'nx.json'))) {
      return 'nx';
    }

    // Turborepo
    if (await fs.pathExists(path.join(projectPath, 'turbo.json'))) {
      return 'turborepo';
    }

    // Lerna
    if (await fs.pathExists(path.join(projectPath, 'lerna.json'))) {
      return 'lerna';
    }

    // Yarn workspaces
    if (packageJson.workspaces && await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
      return 'yarn';
    }

    // npm workspaces
    if (packageJson.workspaces) {
      return 'npm';
    }

    return 'none';
  }

  /**
   * 查找所有 workspace 包
   */
  private async findWorkspaces(projectPath: string, type: MonorepoInfo['type']): Promise<WorkspacePackage[]> {
    const packages: WorkspacePackage[] = [];

    if (type === 'none') {
      // 单包项目
      const packageJson = await fs.readJSON(path.join(projectPath, 'package.json'));
      packages.push({
        name: packageJson.name || 'root',
        path: projectPath,
        frameworks: [],
        packageJson,
      });
      return packages;
    }

    // 读取 workspace 配置
    let workspaceGlobs: string[] = [];

    if (type === 'pnpm') {
      const yaml = await import('js-yaml');
      const workspaceYaml = await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf-8');
      const config = yaml.load(workspaceYaml) as any;
      workspaceGlobs = config.packages || [];
    } else if (type === 'yarn' || type === 'npm') {
      const packageJson = await fs.readJSON(path.join(projectPath, 'package.json'));
      workspaceGlobs = Array.isArray(packageJson.workspaces) 
        ? packageJson.workspaces 
        : packageJson.workspaces?.packages || [];
    } else if (type === 'nx') {
      // Nx 通常使用 apps/ 和 libs/
      workspaceGlobs = ['apps/*', 'libs/*'];
    } else if (type === 'turborepo') {
      const turboJson = await fs.readJSON(path.join(projectPath, 'turbo.json'));
      // Turborepo 通常也使用 package.json workspaces
      const packageJson = await fs.readJSON(path.join(projectPath, 'package.json'));
      workspaceGlobs = Array.isArray(packageJson.workspaces)
        ? packageJson.workspaces
        : packageJson.workspaces?.packages || [];
    }

    // 查找所有包
    const packagePaths = await glob(workspaceGlobs.map(g => path.join(g, 'package.json')), {
      cwd: projectPath,
      absolute: false,
    });

    for (const pkgPath of packagePaths) {
      const fullPath = path.join(projectPath, path.dirname(pkgPath));
      const packageJson = await fs.readJSON(path.join(projectPath, pkgPath));
      
      packages.push({
        name: packageJson.name,
        path: fullPath,
        frameworks: [],
        packageJson,
      });
    }

    return packages;
  }

  /**
   * 检测包使用的框架
   */
  private async detectFrameworks(packagePath: string): Promise<string[]> {
    const frameworks: string[] = [];
    const packageJsonPath = path.join(packagePath, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return frameworks;
    }

    const packageJson = await fs.readJSON(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // 前端框架
    if (allDeps['react']) frameworks.push('React');
    if (allDeps['vue']) frameworks.push('Vue');
    if (allDeps['@angular/core']) frameworks.push('Angular');
    if (allDeps['svelte']) frameworks.push('Svelte');
    if (allDeps['solid-js']) frameworks.push('SolidJS');

    // 全栈框架
    if (allDeps['next']) frameworks.push('Next.js');
    if (allDeps['nuxt']) frameworks.push('Nuxt.js');
    if (allDeps['@remix-run/react']) frameworks.push('Remix');
    if (allDeps['astro']) frameworks.push('Astro');

    // 后端框架
    if (allDeps['express']) frameworks.push('Express');
    if (allDeps['fastify']) frameworks.push('Fastify');
    if (allDeps['@nestjs/core']) frameworks.push('NestJS');
    if (allDeps['koa']) frameworks.push('Koa');

    return frameworks;
  }

  /**
   * 检测测试框架
   */
  private async detectTestFramework(packagePath: string): Promise<string | undefined> {
    const packageJsonPath = path.join(packagePath, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return undefined;
    }

    const packageJson = await fs.readJSON(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (allDeps['vitest']) return 'vitest';
    if (allDeps['jest']) return 'jest';
    if (allDeps['@playwright/test']) return 'playwright';
    if (allDeps['cypress']) return 'cypress';
    if (allDeps['mocha']) return 'mocha';

    return undefined;
  }

  /**
   * 识别框架组合模式
   */
  private identifyPattern(packages: WorkspacePackage[]): string {
    const patterns: string[] = [];

    const hasReact = packages.some(p => p.frameworks.includes('React'));
    const hasVue = packages.some(p => p.frameworks.includes('Vue'));
    const hasBackend = packages.some(p => 
      p.frameworks.includes('Express') || 
      p.frameworks.includes('Fastify') ||
      p.frameworks.includes('NestJS')
    );

    if (hasReact && hasBackend) {
      patterns.push('Frontend (React) + Backend');
    } else if (hasVue && hasBackend) {
      patterns.push('Frontend (Vue) + Backend');
    } else if (hasReact || hasVue) {
      patterns.push('Frontend Only');
    } else if (hasBackend) {
      patterns.push('Backend Only');
    }

    const testFrameworks = packages
      .map(p => p.testFramework)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);

    if (testFrameworks.length > 1) {
      patterns.push(`Mixed Test Frameworks (${testFrameworks.join(', ')})`);
    }

    return patterns.join(' | ');
  }

  /**
   * 推荐配置
   */
  private recommendSetup(packages: WorkspacePackage[], pattern: string): {
    unified: boolean;
    testFramework: string;
    sharedConfig: any;
  } {
    // 检查是否可以使用统一的测试框架
    const testFrameworks = packages
      .map(p => p.testFramework)
      .filter(Boolean) as string[];

    const unified = testFrameworks.length === 0 || 
                    testFrameworks.every(f => f === testFrameworks[0]);

    // 推荐测试框架
    let recommendedFramework = 'vitest'; // 默认推荐 Vitest
    if (testFrameworks.length > 0) {
      // 使用最常见的框架
      const frameworkCounts = testFrameworks.reduce((acc, f) => {
        acc[f] = (acc[f] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      recommendedFramework = Object.entries(frameworkCounts)
        .sort(([, a], [, b]) => b - a)[0][0];
    }

    // 生成共享配置
    const sharedConfig = {
      testFramework: recommendedFramework,
      coverage: {
        enabled: true,
        threshold: {
          lines: 80,
          branches: 80,
          functions: 80,
          statements: 80,
        },
      },
      testMatch: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
    };

    return {
      unified,
      testFramework: recommendedFramework,
      sharedConfig,
    };
  }

  /**
   * 生成 monorepo 配置文件
   */
  async generateMonorepoConfig(info: MonorepoInfo): Promise<string> {
    const config = `# TestMind Monorepo Configuration

## Project Structure

- **Type**: ${info.type}
- **Packages**: ${info.packages.length}
- **Pattern**: ${info.pattern}

## Packages

${info.packages.map(pkg => `
### ${pkg.name}
- **Path**: \`${pkg.path}\`
- **Frameworks**: ${pkg.frameworks.join(', ') || 'None'}
- **Test Framework**: ${pkg.testFramework || 'Not configured'}
`).join('\n')}

## Recommendations

- **Unified Setup**: ${info.recommendations.unified ? '✅ Yes' : '❌ No'}
- **Recommended Test Framework**: ${info.recommendations.testFramework}

## Shared Test Configuration

\`\`\`json
${JSON.stringify(info.recommendations.sharedConfig, null, 2)}
\`\`\`

## Next Steps

1. ${info.recommendations.unified ? 'Use a single test configuration for all packages' : 'Configure each package independently'}
2. Run \`testmind init\` in each package directory
3. Configure shared test utilities in a shared package
`;

    return config;
  }
}

