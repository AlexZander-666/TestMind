import { createComponentLogger } from '../utils/logger';

export interface GitCloneOptions {
  branch?: string;
  depth?: number;
}

const logger = createComponentLogger('GitService');

/**
 * Placeholder Git service used while the real implementation is scheduled for plan.md §2.3.
 */
export class GitService {
  async clone(_repo: string, _destination: string, _options: GitCloneOptions = {}): Promise<void> {
    logger.warn('GitService.clone is a placeholder. See plan.md §2.4.2.');
  }

  async checkout(_branch: string): Promise<void> {
    logger.warn('GitService.checkout is a placeholder. See plan.md §2.3.');
  }

  async currentBranch(): Promise<string> {
    logger.warn('GitService.currentBranch is a placeholder. Returning `main`.');
    return 'main';
  }

  async applyPatch(_patch: string): Promise<void> {
    logger.warn('GitService.applyPatch is a placeholder. Patches are not executed.');
  }
}
