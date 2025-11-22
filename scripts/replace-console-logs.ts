#!/usr/bin/env tsx
/**
 * Script to replace all console.log statements with proper logger calls
 * This will help clean up the 441 console.log statements found in the codebase
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as glob from 'glob';

// Statistics
let totalFiles = 0;
let filesModified = 0;
let totalReplacements = 0;
let errors: string[] = [];

// Patterns to match different console methods
const consolePatterns = [
  { pattern: /console\.log\(/g, replacement: 'logger.info(' },
  { pattern: /console\.error\(/g, replacement: 'logger.error(' },
  { pattern: /console\.warn\(/g, replacement: 'logger.warn(' },
  { pattern: /console\.debug\(/g, replacement: 'logger.debug(' },
];

// Files to exclude
const excludePatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/test/**',
  '**/__tests__/**',
  '**/scripts/replace-console-logs.ts', // Don't modify this script
];

/**
 * Check if a file should be processed
 */
function shouldProcessFile(filePath: string): boolean {
  // Skip test files
  if (filePath.includes('.test.') || filePath.includes('.spec.')) {
    return false;
  }

  // Skip demo files
  if (filePath.includes('/demo.ts') || filePath.includes('demo/')) {
    return false;
  }

  // Skip script files that might be one-off utilities
  if (filePath.includes('/scripts/') && !filePath.includes('/src/')) {
    return false;
  }

  return true;
}

/**
 * Add logger import to a file if not already present
 */
function addLoggerImport(content: string, filePath: string): string {
  // Check if logger is already imported
  if (
    content.includes('import { createComponentLogger') ||
    content.includes('from \'../utils/logger\'') ||
    content.includes('from \'./utils/logger\'') ||
    content.includes('from \'@/utils/logger\'')
  ) {
    return content;
  }

  // Calculate relative path to logger
  const fileDir = path.dirname(filePath);
  const loggerPath = path.join(__dirname, '../packages/core/src/utils/logger');
  let relativePath = path.relative(fileDir, loggerPath).replace(/\\/g, '/');
  
  // Adjust for monorepo structure
  if (filePath.includes('packages/cli')) {
    relativePath = '@testmind/core/dist/utils/logger';
  } else if (filePath.includes('packages/core')) {
    const depth = filePath.split('/src/')[1]?.split('/').length - 1 || 0;
    relativePath = '../'.repeat(depth) + 'utils/logger';
  }

  // Add import statement
  const importStatement = `import { createComponentLogger } from '${relativePath}';\n`;
  
  // Find where to insert the import (after other imports)
  const importMatch = content.match(/^(import .+\n)+/m);
  if (importMatch) {
    const lastImportIndex = importMatch.index! + importMatch[0].length;
    return (
      content.slice(0, lastImportIndex) +
      importStatement +
      content.slice(lastImportIndex)
    );
  }

  // If no imports, add at the beginning
  return importStatement + '\n' + content;
}

/**
 * Extract component name from file path
 */
function getComponentName(filePath: string): string {
  const fileName = path.basename(filePath, path.extname(filePath));
  return fileName.replace(/[.-]/g, '_');
}

/**
 * Process a single file
 */
async function processFile(filePath: string): Promise<void> {
  if (!shouldProcessFile(filePath)) {
    return;
  }

  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    let fileModified = false;
    let replacements = 0;

    // Check if file has console statements
    const hasConsoleStatements = consolePatterns.some(p => 
      p.pattern.test(content)
    );

    if (!hasConsoleStatements) {
      return;
    }

    // Add logger import and initialization
    content = addLoggerImport(content, filePath);
    
    // Add logger initialization after imports
    const componentName = getComponentName(filePath);
    const loggerInit = `\nconst logger = createComponentLogger('${componentName}');\n`;
    
    // Check if logger is already initialized
    if (!content.includes('const logger = createComponentLogger')) {
      // Find position after imports
      const lastImportMatch = content.match(/^(import .+\n)+/m);
      if (lastImportMatch) {
        const insertIndex = lastImportMatch.index! + lastImportMatch[0].length;
        content = 
          content.slice(0, insertIndex) +
          loggerInit +
          content.slice(insertIndex);
      }
    }

    // Replace console statements
    for (const { pattern, replacement } of consolePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        replacements += matches.length;
        content = content.replace(pattern, replacement);
        fileModified = true;
      }
    }

    // Save modified file
    if (fileModified && content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf-8');
      filesModified++;
      totalReplacements += replacements;
      console.log(`✅ Modified ${filePath} (${replacements} replacements)`);
    }

  } catch (error: any) {
    errors.push(`Error processing ${filePath}: ${error.message}`);
  }

  totalFiles++;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Starting console.log replacement...\n');

  // Find all TypeScript files
  const files = glob.sync('packages/**/*.ts', {
    ignore: excludePatterns,
  });

  console.log(`Found ${files.length} TypeScript files to process\n`);

  // Process files
  for (const file of files) {
    await processFile(file);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total files scanned: ${totalFiles}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total replacements: ${totalReplacements}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log('\n✨ Console.log replacement complete!');
  console.log('⚠️  Please review the changes and run tests to ensure everything works correctly.');
}

// Run the script
main().catch(console.error);
