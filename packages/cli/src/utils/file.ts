/**
 * File utilities
 */

import path from 'path';

export const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory: ${dirPath}`, error);
    throw error;
  }
};

export const safeWriteFile = async (filePath: string, content: string): Promise<boolean> => {
  try {
    const fs = await import('fs/promises');
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write file: ${filePath}`, error);
    return false;
  }
};

export const safeReadFile = async (filePath: string): Promise<string | null> => {
  try {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
};



























