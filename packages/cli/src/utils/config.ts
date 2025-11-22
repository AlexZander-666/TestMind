/**
 * Configuration utilities
 */

import path from 'path';
import type { ProjectConfig } from '@testmind/shared';

export const loadConfig = async (): Promise<ProjectConfig | null> => {
  try {
    const fs = await import('fs/promises');
    const configPath = path.join(process.cwd(), '.testmind', 'config.json');
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
};

export const saveConfig = async (config: ProjectConfig): Promise<boolean> => {
  try {
    const fs = await import('fs/promises');
    const configPath = path.join(process.cwd(), '.testmind', 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
};



























