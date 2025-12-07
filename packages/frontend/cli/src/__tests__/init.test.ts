import { afterEach, describe, expect, it, vi } from 'vitest';

const { ensureDirMock, safeWriteFileMock, promptMock } = vi.hoisted(() => ({
  ensureDirMock: vi.fn(),
  safeWriteFileMock: vi.fn(),
  promptMock: vi.fn(),
}));

vi.mock('@testmind/core', () => ({
  createComponentLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../utils/file', () => ({
  ensureDir: ensureDirMock,
  safeWriteFile: safeWriteFileMock,
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: promptMock,
  },
}));

vi.mock('fs/promises', () => ({
  access: vi.fn().mockRejectedValue(new Error('not found')),
  readFile: vi.fn().mockResolvedValue(''),
  appendFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Import after mocks
import { initCommand } from '../commands/init';

describe('init command language guard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('blocks unsupported languages and avoids writing files', async () => {
    promptMock.mockResolvedValueOnce({
      language: 'python',
      testFramework: 'pytest',
      testDirectory: '__tests__',
      coverageThreshold: 80,
      llmProvider: 'openai',
      llmModel: 'gpt-4',
    });

    await initCommand({ force: false });

    expect(promptMock).toHaveBeenCalled();
    expect(ensureDirMock).not.toHaveBeenCalled();
    expect(safeWriteFileMock).not.toHaveBeenCalled();
  });
});
