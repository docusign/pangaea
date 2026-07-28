// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi } from 'vitest';
import { AuditRunner } from './auditRunner.js';
import type { Analyzer, Issue } from './types/types.js';

// Type declaration for HTMLElement in test environment
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface HTMLElement {}
}

describe('AuditRunner', () => {
  // Mock HTMLElement
  const mockRootElement = {} as HTMLElement;
  const testUrl = 'https://example.com/test';

  // Helper to create mock analyzer
  const createMockAnalyzer = (name: string, issues: Issue[]): Analyzer => ({
    name,
    run: vi.fn().mockResolvedValue(issues),
  });

  // Helper to create mock issue
  const createMockIssue = (
    severity: 'critical' | 'serious' | 'moderate' | 'minor' | 'info',
    id = 'issue-1',
    type = 'issue-type',
  ): Issue => ({
    id: id,
    type: type,
    severity,
    message: 'Test issue',
    elementSelector: '.test-element',
    remediation: {
      docsUrl: 'https://docs.example.com',
      suggestion: 'Fix the issue',
    },
  });

  describe('runAudit', () => {
    it('should run all analyzers and return a complete audit report', async () => {
      const issue1 = createMockIssue('serious', '1', 'rtl-hardcoded-margin-left');
      const issue2 = createMockIssue('moderate', '2', 'encoding-possible-mojibake');
      const analyzer1 = createMockAnalyzer('Analyzer1', [issue1]);
      const analyzer2 = createMockAnalyzer('Analyzer2', [issue2]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer1, analyzer2]);

      expect(report).toMatchObject({
        url: testUrl,
        issues: [issue1, issue2],
      });
      expect(report.analyzerScores).toHaveProperty('Analyzer1');
      expect(report.analyzerScores).toHaveProperty('Analyzer2');
      expect(report.globalizationScore).toBeGreaterThan(0);
      expect(report.globalizationScore).toBeLessThanOrEqual(100);
      expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 format
      expect(analyzer1.run).toHaveBeenCalledExactlyOnceWith(mockRootElement);
      expect(analyzer2.run).toHaveBeenCalledExactlyOnceWith(mockRootElement);
    });

    it('should return perfect score with no issues', async () => {
      const analyzer = createMockAnalyzer('PerfectAnalyzer', []);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      expect(report.analyzerScores.PerfectAnalyzer).toBe(100);
      expect(report.globalizationScore).toBe(100);
      expect(report.issues).toHaveLength(0);
    });

    it('should handle empty analyzer array', async () => {
      const report = await AuditRunner.runAudit(mockRootElement, testUrl, []);

      expect(report.analyzerScores).toEqual({});
      expect(report.globalizationScore).toBe(100);
      expect(report.issues).toHaveLength(0);
    });
  });

  describe('Score calculation with different severities', () => {
    it('should calculate lower score for critical issues', async () => {
      const criticalIssue = createMockIssue('critical');
      const analyzer = createMockAnalyzer('CriticalAnalyzer', [criticalIssue]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      // New rule: any critical issue zeros the analyzer score
      expect(report.analyzerScores.CriticalAnalyzer).toBe(0);
    });

    it('should calculate higher score for info issues', async () => {
      const infoIssue = createMockIssue('info');
      const analyzer = createMockAnalyzer('InfoAnalyzer', [infoIssue]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      // Tiered scoring: 1 info = 0pts, score = 100 (info issues don't affect score)
      expect(report.analyzerScores.InfoAnalyzer).toBe(100);
    });

    it('should properly weight serious issues', async () => {
      const seriousIssue = createMockIssue('serious');
      const analyzer = createMockAnalyzer('SeriousAnalyzer', [seriousIssue]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      // Serious issues have linear deductions (no diminishing returns)
      // SERIOUS_BASE_DEDUCTION=5 * 1 with sensitivity=5 (neutral) => 5 deduction, score = 95
      expect(report.analyzerScores.SeriousAnalyzer).toBe(95);
    });

    it('should treat minor issues with pooled diminishing returns', async () => {
      const minorIssue = createMockIssue('minor');
      const analyzer = createMockAnalyzer('MinorAnalyzer', [minorIssue]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      // Minor issues have pooled diminishing returns.
      // MINOR_BASE_DEDUCTION=2 * sqrt(1) with sensitivity=5 (neutral) => 2 deduction, score = 98
      expect(report.analyzerScores.MinorAnalyzer).toBe(98);
    });

    it('should calculate cumulative penalty for multiple issues', async () => {
      const issues = [
        createMockIssue('critical', '1', 'RTL'),
        createMockIssue('serious', '2', 'Encoding'),
        createMockIssue('minor', '3', 'Layout'),
      ];
      const analyzer = createMockAnalyzer('MultiIssueAnalyzer', issues);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      // Critical issue zeros the score
      expect(report.analyzerScores.MultiIssueAnalyzer).toBe(0);
    });
  });

  describe('Error sensitivity', () => {
    it('should be more lenient with low error sensitivity', async () => {
      const criticalIssue = createMockIssue('critical');
      const analyzer = createMockAnalyzer('LenientAnalyzer', [criticalIssue]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer], undefined, {
        LenientAnalyzer: 1,
      });

      // New rule: critical issue zeros the score regardless of sensitivity
      expect(report.analyzerScores.LenientAnalyzer).toBe(0);
    });

    it('should be stricter with high error sensitivity', async () => {
      const criticalIssue = createMockIssue('critical');
      const analyzer = createMockAnalyzer('StrictAnalyzer', [criticalIssue]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer], undefined, {
        StrictAnalyzer: 10,
      });

      // New rule: critical issue zeros the score regardless of sensitivity
      expect(report.analyzerScores.StrictAnalyzer).toBe(0);
    });
  });

  describe('Analyzer weights', () => {
    it('should use simple average when no weights provided', async () => {
      const analyzer1 = createMockAnalyzer('Analyzer1', []); // Score: 100
      const analyzer2 = createMockAnalyzer('Analyzer2', [createMockIssue('critical', '1', 'RTL')]); // Score: 92

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer1, analyzer2]);

      // New rule: Analyzer2 has a critical issue -> score 0; average (100 + 0) / 2 = 50
      expect(report.globalizationScore).toBe(50);
    });

    it('should apply custom weights to calculate overall score', async () => {
      const analyzer1 = createMockAnalyzer('Analyzer1', []); // Score: 100
      const analyzer2 = createMockAnalyzer('Analyzer2', [
        createMockIssue('critical', '1', 'Encoding'),
      ]); // Score: 92

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer1, analyzer2], {
        Analyzer1: 3,
        Analyzer2: 1,
      });

      // New rule: Analyzer2 is 0 due to critical; weighted average: (100*3 + 0*1) / 4 = 75
      expect(report.globalizationScore).toBe(75);
    });

    it('should use default weight of 1 for unspecified analyzers', async () => {
      const analyzer1 = createMockAnalyzer('Analyzer1', []); // Score: 100
      const analyzer2 = createMockAnalyzer('Analyzer2', [
        createMockIssue('critical', '1', 'Layout'),
      ]); // Score: 92

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer1, analyzer2], {
        Analyzer1: 2, // Only specify weight for Analyzer1
        // Analyzer2 defaults to weight 1
      });

      // New rule: Analyzer2 is 0 due to critical; weighted average: (100*2 + 0*1) / 3 = 67
      expect(report.globalizationScore).toBe(67);
    });

    it('should handle fractional weights', async () => {
      const analyzer1 = createMockAnalyzer('Analyzer1', []); // Score: 100
      const analyzer2 = createMockAnalyzer('Analyzer2', [createMockIssue('critical', '1', 'i18n')]); // Score: 92

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer1, analyzer2], {
        Analyzer1: 1.5,
        Analyzer2: 0.5,
      });

      // New rule: Analyzer2 is 0 due to critical; weighted average: (100*1.5 + 0*0.5) / 2 = 75
      expect(report.globalizationScore).toBe(75);
    });

    it('should return 100 when all weights are 0', async () => {
      const analyzer1 = createMockAnalyzer('Analyzer1', [createMockIssue('critical', '1', 'RTL')]);
      const analyzer2 = createMockAnalyzer('Analyzer2', [
        createMockIssue('critical', '2', 'Encoding'),
      ]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer1, analyzer2], {
        Analyzer1: 0,
        Analyzer2: 0,
      });

      expect(report.globalizationScore).toBe(100);
    });
  });

  describe('Per-analyzer sensitivity', () => {
    it('should apply analyzer-specific sensitivity when provided', async () => {
      const criticalIssue = createMockIssue('critical');
      const seriousIssue = createMockIssue('serious');

      const analyzer1 = createMockAnalyzer('CriticalAnalyzer', [criticalIssue]);
      const analyzer2 = createMockAnalyzer('SeriousAnalyzer', [seriousIssue]);

      // Global sensitivity = 5 (neutral), but override CriticalAnalyzer to 10 (strict) and SeriousAnalyzer to 1 (lenient)
      const report = await AuditRunner.runAudit(
        mockRootElement,
        testUrl,
        [analyzer1, analyzer2],
        undefined,
        {
          CriticalAnalyzer: 10,
          SeriousAnalyzer: 1,
        },
      );

      // New rule: critical issue zeros the score
      expect(report.analyzerScores.CriticalAnalyzer).toBe(0);
      // SeriousAnalyzer: 4pts * 0.2x = 0.8 -> rounds to 1 -> 99
      expect(report.analyzerScores.SeriousAnalyzer).toBeGreaterThanOrEqual(99);
    });

    it('should fall back to global sensitivity when analyzer-specific not provided', async () => {
      const criticalIssue = createMockIssue('critical');
      const analyzer = createMockAnalyzer('CriticalAnalyzer', [criticalIssue]);

      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      // New rule: critical issue zeros the score
      expect(report.analyzerScores.CriticalAnalyzer).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle real-world scenario with multiple analyzers and mixed issues', async () => {
      const rtlAnalyzer = createMockAnalyzer('RTL', [
        createMockIssue('critical', 'rtl-1'),
        createMockIssue('minor', 'rtl-2'),
      ]);

      const encodingAnalyzer = createMockAnalyzer('Encoding', [createMockIssue('info', 'enc-1')]);

      const layoutAnalyzer = createMockAnalyzer('Layout', []);

      const report = await AuditRunner.runAudit(
        mockRootElement,
        testUrl,
        [rtlAnalyzer, encodingAnalyzer, layoutAnalyzer],
        {
          RTL: 2,
          Encoding: 1,
          Layout: 1,
        },
      );

      expect(report.issues).toHaveLength(3);
      expect(report.analyzerScores.RTL).toBeLessThan(report.analyzerScores.Encoding);
      expect(report.analyzerScores.Layout).toBe(100);
      expect(report.globalizationScore).toBeGreaterThan(0);
      expect(report.globalizationScore).toBeLessThan(100);
    });

    it('should preserve issue details in final report', async () => {
      const specificIssue: Issue = {
        id: 'specific-123',
        type: 'rtl-margin-issue',
        severity: 'serious',
        message: 'Hardcoded left margin detected',
        elementSelector: '.header > .nav',
        remediation: {
          docsUrl: 'https://docs.example.com/rtl-guide',
          suggestion: 'Use margin-inline-start instead of margin-left',
        },
      };

      const analyzer = createMockAnalyzer('RTL', [specificIssue]);
      const report = await AuditRunner.runAudit(mockRootElement, testUrl, [analyzer]);

      expect(report.issues[0]).toEqual(specificIssue);
    });
  });
});
