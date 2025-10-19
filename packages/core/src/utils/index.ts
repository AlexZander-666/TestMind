/**
 * Core utilities
 */

export * from '@testmind/shared';
export { GitAutomation } from './GitAutomation';
export { FileCache } from './FileCache';

/**
 * Parse file content safely
 */
export const safeParseFile = async (filePath: string): Promise<string | null> => {
  try {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Failed to read file: ${filePath}`, error);
    return null;
  }
};

/**
 * Ensure directory exists
 */
export const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory: ${dirPath}`, error);
  }
};

/**
 * Write file safely
 */
export const safeWriteFile = async (filePath: string, content: string): Promise<boolean> => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Ensure directory exists
    await ensureDir(path.dirname(filePath));
    
    // Write file
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write file: ${filePath}`, error);
    return false;
  }
};



























