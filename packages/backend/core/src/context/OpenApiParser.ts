import { createComponentLogger } from '../utils/logger';

export interface OpenApiParseOptions {
  sourcePath?: string;
  fallbackTitle?: string;
}

export interface OpenApiParseResult {
  title: string;
  version: string;
  operations: Array<{ method: string; path: string }>;
  warnings: string[];
  placeholder: boolean;
  planRef: string;
}

const logger = createComponentLogger('OpenApiParser');

/**
 * Placeholder parser that keeps plan.md §2.4.2 from shipping 0-byte files.
 * Real parsing logic will be implemented once the API skill is green-lit.
 */
export class OpenApiParser {
  parse(spec: string, options: OpenApiParseOptions = {}): OpenApiParseResult {
    const trimmed = spec.trim();
    const isYaml = trimmed.startsWith('openapi:');

    logger.warn('OpenAPI parser invoked in placeholder mode', {
      sourcePath: options.sourcePath,
      isYaml,
      length: spec.length,
    });

    return {
      title: options.fallbackTitle ?? this.detectTitle(trimmed),
      version: this.detectVersion(trimmed),
      operations: [],
      warnings: [
        'OpenAPI parsing has not been implemented yet.',
        'Follow plan.md §2.4.2 and ADR-0006 for the delivery timeline.',
      ],
      placeholder: true,
      planRef: 'plan.md §2.4.2 · OpenApiParser placeholder',
    };
  }

  private detectTitle(spec: string): string {
    const titleMatch = spec.match(/title:\s*(.+)/i);
    return titleMatch?.[1]?.trim() ?? 'Unnamed API';
  }

  private detectVersion(spec: string): string {
    const versionMatch = spec.match(/openapi:\s*([\d.]+)/i) ?? spec.match(/version:\s*([\d.]+)/i);
    return versionMatch?.[1]?.trim() ?? '0.0.0';
  }
}
