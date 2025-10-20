/**
 * DiffReviewer单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffReviewer } from '../DiffReviewer';
import { DiffGenerator } from '../DiffGenerator';
import type { FileDiff } from '../DiffGenerator';

describe('DiffReviewer', () => {
  let reviewer: DiffReviewer;
  let generator: DiffGenerator;

  beforeEach(() => {
    reviewer = new DiffReviewer({ colorOutput: false });
    generator = new DiffGenerator();
  });

  describe('reviewNonInteractive', () => {
    it('should auto-accept all diffs when specified', async () => {
      const diff1 = generator.generateFileDiff('file1.ts', 'old1', 'new1');
      const diff2 = generator.generateFileDiff('file2.ts', 'old2', 'new2');

      const result = await reviewer.reviewNonInteractive([diff1, diff2], true);

      expect(result.totalReviewed).toBe(2);
      expect(result.totalAccepted).toBe(2);
      expect(result.totalRejected).toBe(0);
      expect(result.acceptedDiffs).toHaveLength(2);
    });

    it('should auto-reject all diffs when not auto-accepting', async () => {
      const diff = generator.generateFileDiff('file.ts', 'old', 'new');

      const result = await reviewer.reviewNonInteractive([diff], false);

      expect(result.totalReviewed).toBe(1);
      expect(result.totalAccepted).toBe(0);
      expect(result.totalRejected).toBe(1);
    });
  });

  describe('reviewWithConfidence', () => {
    it('should auto-accept high confidence diffs', async () => {
      const reviewerWithThreshold = new DiffReviewer({
        autoAcceptHighConfidence: true,
        autoAcceptThreshold: 0.9
      });

      const highConfidenceDiff = {
        ...generator.generateFileDiff('file1.ts', 'old', 'new'),
        confidence: 0.95
      };

      const lowConfidenceDiff = {
        ...generator.generateFileDiff('file2.ts', 'old', 'new'),
        confidence: 0.7
      };

      // Mock交互式审查（低置信度的）
      vi.spyOn(reviewerWithThreshold as any, 'review').mockResolvedValue({
        decisions: [{ action: 'accept', filePath: 'file2.ts' }],
        acceptedDiffs: [lowConfidenceDiff],
        rejectedDiffs: [],
        totalReviewed: 1,
        totalAccepted: 1,
        totalRejected: 0
      });

      const result = await reviewerWithThreshold.reviewWithConfidence([
        highConfidenceDiff,
        lowConfidenceDiff
      ]);

      expect(result.totalAccepted).toBe(2);
      // 高置信度应该自动接受
    });
  });

  describe('generateReviewReport', () => {
    it('should generate comprehensive review report', async () => {
      const diff1 = generator.generateFileDiff('accepted.ts', 'old', 'new');
      const diff2 = generator.generateFileDiff('rejected.ts', 'old', 'new');

      const result = await reviewer.reviewNonInteractive([diff1], true);
      result.rejectedDiffs = [diff2];
      result.totalRejected = 1;
      result.totalReviewed = 2;

      const report = reviewer.generateReviewReport(result);

      expect(report).toContain('Diff Review Report');
      expect(report).toContain('Total Reviewed: 2');
      expect(report).toContain('Accepted: 1');
      expect(report).toContain('Rejected: 1');
      expect(report).toContain('accepted.ts');
      expect(report).toContain('rejected.ts');
    });

    it('should calculate acceptance rate correctly', async () => {
      const diffs = [
        generator.generateFileDiff('f1.ts', '', 'new1'),
        generator.generateFileDiff('f2.ts', '', 'new2'),
        generator.generateFileDiff('f3.ts', '', 'new3')
      ];

      const result = await reviewer.reviewNonInteractive(diffs, true);
      const report = reviewer.generateReviewReport(result);

      expect(report).toContain('100.0%'); // 100% acceptance rate
    });
  });

  describe('exportDecisions and applyDecisions', () => {
    it('should export decisions to JSON', async () => {
      const diff = generator.generateFileDiff('file.ts', 'old', 'new');
      const result = await reviewer.reviewNonInteractive([diff], true);

      const exported = reviewer.exportDecisions(result);

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].action).toBe('accept');
      expect(parsed[0].filePath).toBe('file.ts');
    });

    it('should apply previously saved decisions', async () => {
      const diff1 = generator.generateFileDiff('file1.ts', '', 'new1');
      const diff2 = generator.generateFileDiff('file2.ts', '', 'new2');

      const decisionsJson = JSON.stringify([
        { action: 'accept', filePath: 'file1.ts' },
        { action: 'reject', filePath: 'file2.ts' }
      ]);

      const result = await reviewer.applyDecisions([diff1, diff2], decisionsJson);

      expect(result.totalAccepted).toBe(1);
      expect(result.totalRejected).toBe(1);
      expect(result.acceptedDiffs[0].filePath).toBe('file1.ts');
    });
  });

  describe('edge cases', () => {
    it('should handle empty diff list', async () => {
      const result = await reviewer.reviewNonInteractive([], true);

      expect(result.totalReviewed).toBe(0);
      expect(result.acceptedDiffs).toHaveLength(0);
    });

    it('should handle invalid decisions JSON gracefully', async () => {
      const diff = generator.generateFileDiff('file.ts', '', 'new');

      await expect(
        reviewer.applyDecisions([diff], 'invalid json')
      ).rejects.toThrow();
    });
  });
});

 * DiffReviewer单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffReviewer } from '../DiffReviewer';
import { DiffGenerator } from '../DiffGenerator';
import type { FileDiff } from '../DiffGenerator';

describe('DiffReviewer', () => {
  let reviewer: DiffReviewer;
  let generator: DiffGenerator;

  beforeEach(() => {
    reviewer = new DiffReviewer({ colorOutput: false });
    generator = new DiffGenerator();
  });

  describe('reviewNonInteractive', () => {
    it('should auto-accept all diffs when specified', async () => {
      const diff1 = generator.generateFileDiff('file1.ts', 'old1', 'new1');
      const diff2 = generator.generateFileDiff('file2.ts', 'old2', 'new2');

      const result = await reviewer.reviewNonInteractive([diff1, diff2], true);

      expect(result.totalReviewed).toBe(2);
      expect(result.totalAccepted).toBe(2);
      expect(result.totalRejected).toBe(0);
      expect(result.acceptedDiffs).toHaveLength(2);
    });

    it('should auto-reject all diffs when not auto-accepting', async () => {
      const diff = generator.generateFileDiff('file.ts', 'old', 'new');

      const result = await reviewer.reviewNonInteractive([diff], false);

      expect(result.totalReviewed).toBe(1);
      expect(result.totalAccepted).toBe(0);
      expect(result.totalRejected).toBe(1);
    });
  });

  describe('reviewWithConfidence', () => {
    it('should auto-accept high confidence diffs', async () => {
      const reviewerWithThreshold = new DiffReviewer({
        autoAcceptHighConfidence: true,
        autoAcceptThreshold: 0.9
      });

      const highConfidenceDiff = {
        ...generator.generateFileDiff('file1.ts', 'old', 'new'),
        confidence: 0.95
      };

      const lowConfidenceDiff = {
        ...generator.generateFileDiff('file2.ts', 'old', 'new'),
        confidence: 0.7
      };

      // Mock交互式审查（低置信度的）
      vi.spyOn(reviewerWithThreshold as any, 'review').mockResolvedValue({
        decisions: [{ action: 'accept', filePath: 'file2.ts' }],
        acceptedDiffs: [lowConfidenceDiff],
        rejectedDiffs: [],
        totalReviewed: 1,
        totalAccepted: 1,
        totalRejected: 0
      });

      const result = await reviewerWithThreshold.reviewWithConfidence([
        highConfidenceDiff,
        lowConfidenceDiff
      ]);

      expect(result.totalAccepted).toBe(2);
      // 高置信度应该自动接受
    });
  });

  describe('generateReviewReport', () => {
    it('should generate comprehensive review report', async () => {
      const diff1 = generator.generateFileDiff('accepted.ts', 'old', 'new');
      const diff2 = generator.generateFileDiff('rejected.ts', 'old', 'new');

      const result = await reviewer.reviewNonInteractive([diff1], true);
      result.rejectedDiffs = [diff2];
      result.totalRejected = 1;
      result.totalReviewed = 2;

      const report = reviewer.generateReviewReport(result);

      expect(report).toContain('Diff Review Report');
      expect(report).toContain('Total Reviewed: 2');
      expect(report).toContain('Accepted: 1');
      expect(report).toContain('Rejected: 1');
      expect(report).toContain('accepted.ts');
      expect(report).toContain('rejected.ts');
    });

    it('should calculate acceptance rate correctly', async () => {
      const diffs = [
        generator.generateFileDiff('f1.ts', '', 'new1'),
        generator.generateFileDiff('f2.ts', '', 'new2'),
        generator.generateFileDiff('f3.ts', '', 'new3')
      ];

      const result = await reviewer.reviewNonInteractive(diffs, true);
      const report = reviewer.generateReviewReport(result);

      expect(report).toContain('100.0%'); // 100% acceptance rate
    });
  });

  describe('exportDecisions and applyDecisions', () => {
    it('should export decisions to JSON', async () => {
      const diff = generator.generateFileDiff('file.ts', 'old', 'new');
      const result = await reviewer.reviewNonInteractive([diff], true);

      const exported = reviewer.exportDecisions(result);

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].action).toBe('accept');
      expect(parsed[0].filePath).toBe('file.ts');
    });

    it('should apply previously saved decisions', async () => {
      const diff1 = generator.generateFileDiff('file1.ts', '', 'new1');
      const diff2 = generator.generateFileDiff('file2.ts', '', 'new2');

      const decisionsJson = JSON.stringify([
        { action: 'accept', filePath: 'file1.ts' },
        { action: 'reject', filePath: 'file2.ts' }
      ]);

      const result = await reviewer.applyDecisions([diff1, diff2], decisionsJson);

      expect(result.totalAccepted).toBe(1);
      expect(result.totalRejected).toBe(1);
      expect(result.acceptedDiffs[0].filePath).toBe('file1.ts');
    });
  });

  describe('edge cases', () => {
    it('should handle empty diff list', async () => {
      const result = await reviewer.reviewNonInteractive([], true);

      expect(result.totalReviewed).toBe(0);
      expect(result.acceptedDiffs).toHaveLength(0);
    });

    it('should handle invalid decisions JSON gracefully', async () => {
      const diff = generator.generateFileDiff('file.ts', '', 'new');

      await expect(
        reviewer.applyDecisions([diff], 'invalid json')
      ).rejects.toThrow();
    });
  });
});

 * DiffReviewer单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffReviewer } from '../DiffReviewer';
import { DiffGenerator } from '../DiffGenerator';
import type { FileDiff } from '../DiffGenerator';

describe('DiffReviewer', () => {
  let reviewer: DiffReviewer;
  let generator: DiffGenerator;

  beforeEach(() => {
    reviewer = new DiffReviewer({ colorOutput: false });
    generator = new DiffGenerator();
  });

  describe('reviewNonInteractive', () => {
    it('should auto-accept all diffs when specified', async () => {
      const diff1 = generator.generateFileDiff('file1.ts', 'old1', 'new1');
      const diff2 = generator.generateFileDiff('file2.ts', 'old2', 'new2');

      const result = await reviewer.reviewNonInteractive([diff1, diff2], true);

      expect(result.totalReviewed).toBe(2);
      expect(result.totalAccepted).toBe(2);
      expect(result.totalRejected).toBe(0);
      expect(result.acceptedDiffs).toHaveLength(2);
    });

    it('should auto-reject all diffs when not auto-accepting', async () => {
      const diff = generator.generateFileDiff('file.ts', 'old', 'new');

      const result = await reviewer.reviewNonInteractive([diff], false);

      expect(result.totalReviewed).toBe(1);
      expect(result.totalAccepted).toBe(0);
      expect(result.totalRejected).toBe(1);
    });
  });

  describe('reviewWithConfidence', () => {
    it('should auto-accept high confidence diffs', async () => {
      const reviewerWithThreshold = new DiffReviewer({
        autoAcceptHighConfidence: true,
        autoAcceptThreshold: 0.9
      });

      const highConfidenceDiff = {
        ...generator.generateFileDiff('file1.ts', 'old', 'new'),
        confidence: 0.95
      };

      const lowConfidenceDiff = {
        ...generator.generateFileDiff('file2.ts', 'old', 'new'),
        confidence: 0.7
      };

      // Mock交互式审查（低置信度的）
      vi.spyOn(reviewerWithThreshold as any, 'review').mockResolvedValue({
        decisions: [{ action: 'accept', filePath: 'file2.ts' }],
        acceptedDiffs: [lowConfidenceDiff],
        rejectedDiffs: [],
        totalReviewed: 1,
        totalAccepted: 1,
        totalRejected: 0
      });

      const result = await reviewerWithThreshold.reviewWithConfidence([
        highConfidenceDiff,
        lowConfidenceDiff
      ]);

      expect(result.totalAccepted).toBe(2);
      // 高置信度应该自动接受
    });
  });

  describe('generateReviewReport', () => {
    it('should generate comprehensive review report', async () => {
      const diff1 = generator.generateFileDiff('accepted.ts', 'old', 'new');
      const diff2 = generator.generateFileDiff('rejected.ts', 'old', 'new');

      const result = await reviewer.reviewNonInteractive([diff1], true);
      result.rejectedDiffs = [diff2];
      result.totalRejected = 1;
      result.totalReviewed = 2;

      const report = reviewer.generateReviewReport(result);

      expect(report).toContain('Diff Review Report');
      expect(report).toContain('Total Reviewed: 2');
      expect(report).toContain('Accepted: 1');
      expect(report).toContain('Rejected: 1');
      expect(report).toContain('accepted.ts');
      expect(report).toContain('rejected.ts');
    });

    it('should calculate acceptance rate correctly', async () => {
      const diffs = [
        generator.generateFileDiff('f1.ts', '', 'new1'),
        generator.generateFileDiff('f2.ts', '', 'new2'),
        generator.generateFileDiff('f3.ts', '', 'new3')
      ];

      const result = await reviewer.reviewNonInteractive(diffs, true);
      const report = reviewer.generateReviewReport(result);

      expect(report).toContain('100.0%'); // 100% acceptance rate
    });
  });

  describe('exportDecisions and applyDecisions', () => {
    it('should export decisions to JSON', async () => {
      const diff = generator.generateFileDiff('file.ts', 'old', 'new');
      const result = await reviewer.reviewNonInteractive([diff], true);

      const exported = reviewer.exportDecisions(result);

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].action).toBe('accept');
      expect(parsed[0].filePath).toBe('file.ts');
    });

    it('should apply previously saved decisions', async () => {
      const diff1 = generator.generateFileDiff('file1.ts', '', 'new1');
      const diff2 = generator.generateFileDiff('file2.ts', '', 'new2');

      const decisionsJson = JSON.stringify([
        { action: 'accept', filePath: 'file1.ts' },
        { action: 'reject', filePath: 'file2.ts' }
      ]);

      const result = await reviewer.applyDecisions([diff1, diff2], decisionsJson);

      expect(result.totalAccepted).toBe(1);
      expect(result.totalRejected).toBe(1);
      expect(result.acceptedDiffs[0].filePath).toBe('file1.ts');
    });
  });

  describe('edge cases', () => {
    it('should handle empty diff list', async () => {
      const result = await reviewer.reviewNonInteractive([], true);

      expect(result.totalReviewed).toBe(0);
      expect(result.acceptedDiffs).toHaveLength(0);
    });

    it('should handle invalid decisions JSON gracefully', async () => {
      const diff = generator.generateFileDiff('file.ts', '', 'new');

      await expect(
        reviewer.applyDecisions([diff], 'invalid json')
      ).rejects.toThrow();
    });
  });
});

