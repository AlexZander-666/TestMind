import { createSpinner } from '../ui/spinner';
import { createStdoutPrinter } from '../ui/stdoutPrinter';
import { loadConfig } from '../utils/config';
import { CICDManager, type CIPlatform, type SetupResult } from '@testmind/core';

const VALID_PLATFORMS: CIPlatform[] = ['github', 'gitlab', 'jenkins', 'circleci', 'unknown'];

const parsePlatformInput = (value?: string) => {
  if (!value) {
    return { valid: [], invalid: [] };
  }

  const tokens = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  const valid: CIPlatform[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    if (VALID_PLATFORMS.includes(token as CIPlatform)) {
      valid.push(token as CIPlatform);
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
};

const formatResult = (result: SetupResult): string => {
  const status = result.success ? 'success' : 'failed';
  const details: string[] = [];

  if (result.configPath) {
    details.push(`config: ${result.configPath}`);
  }

  if (result.error) {
    details.push(`error: ${result.error}`);
  }

  const detailString = details.length > 0 ? ` (${details.join('; ')})` : '';
  return `${result.platform}: ${status}${detailString}`;
};

export interface CiOptions {
  platform?: string;
  json?: boolean;
}

export const ciCommand = async (options: CiOptions) => {
  const printer = createStdoutPrinter();
  const jsonMode = options.json === true;
  const parsed = parsePlatformInput(options.platform);

  if (!jsonMode) {
    printer.header('ci', 'CI/CD automation');
  }

  const config = await loadConfig();
  if (!config) {
    const message = 'TestMind is not initialized in this project.';
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify(
          {
            command: 'ci',
            success: false,
            error: message,
            hint: 'Run "testmind init" first.',
          },
          null,
          2,
        )}\n`,
      );
    } else {
      printer.error(message, 'Run "testmind init" first.');
    }
    process.exit(1);
  }

  if (parsed.invalid.length > 0 && !jsonMode) {
    printer.warn(
      `Ignored unknown platform values: ${parsed.invalid.join(', ')}. Supported: github, gitlab, jenkins, circleci.`,
    );
  }

  const manager = new CICDManager({ repoPath: config.repoPath });

  let spinner: ReturnType<typeof createSpinner> | null = null;
  if (!jsonMode) {
    spinner = createSpinner('Configuring CI/CD...');
    spinner.start();
  }

  try {
    const targets = parsed.valid.length > 0 ? parsed.valid : undefined;
    const results = await manager.setup(targets);

    if (spinner) {
      if (results.every((result) => result.success) && results.length > 0) {
        spinner.succeed('CI/CD configuration complete');
      } else if (results.length === 0) {
        spinner.warn('No CI/CD platforms were configured');
      } else {
        spinner.warn('CI/CD setup finished with warnings');
      }
    }

    if (jsonMode) {
      const payload = {
        command: 'ci',
        requestedPlatforms: parsed.valid,
        invalidPlatforms: parsed.invalid,
        results,
      };
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    if (results.length === 0) {
      printer.warn('No CI/CD platforms were targeted. Supply --platform or add workflow files first.');
    } else {
      printer.section(
        'Results',
        results.map(answer => formatResult(answer)),
      );
    }

    printer.nextSteps([
      { label: 'Inspect generated files', command: 'git status' },
      { label: 'Run test suites', command: 'pnpm test' },
    ]);
  } catch (error: unknown) {
    spinner?.fail('CI/CD setup failed');
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify(
          {
            command: 'ci',
            success: false,
            error: message,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      printer.error('CI/CD automation failed.', message);
    }
    process.exit(1);
  }
};
