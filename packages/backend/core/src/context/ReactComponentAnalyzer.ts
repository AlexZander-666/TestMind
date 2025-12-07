import { createComponentLogger } from '../utils/logger';

export interface ReactComponentAnalysis {
  name: string;
  props: string[];
  hooks: string[];
  hasChildren: boolean;
  placeholder: boolean;
  planRef: string;
}

const logger = createComponentLogger('ReactComponentAnalyzer');

export class ReactComponentAnalyzer {
  analyze(filePath: string, fileContents: string): ReactComponentAnalysis {
    logger.warn('ReactComponentAnalyzer placeholder invoked', {
      filePath,
      length: fileContents.length,
    });

    return {
      name: this.deriveComponentName(filePath),
      props: [],
      hooks: [],
      hasChildren: fileContents.includes('children'),
      placeholder: true,
      planRef: 'plan.md §2.4.2 · ReactComponentAnalyzer placeholder',
    };
  }

  private deriveComponentName(filePath: string): string {
    const match = filePath.split(/[\\/]/).pop();
    return match?.replace(/\.[tj]sx?$/, '') ?? 'UnnamedComponent';
  }
}
