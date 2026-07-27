// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { test, expect } from '@playwright/test';
import { runAudit } from '@pangaea/glob-audit-playwright';

test.describe('LanguageAnalyzer E2E', () => {
  test('should detect language mismatches on test page', async ({ page }) => {
    await page.goto('http://localhost:3000/language-demos.html');

    const report = await runAudit({
      page,
      languageTarget: 'en', // Required to run language analyzer phase
      thresholds: {
        LanguageAnalyzer: 1, // Don't disable — set a low threshold to allow issues
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
      },
    });

    expect(report).toBeDefined();
    expect(report.analyzerScores).toBeDefined();
    expect(report.analyzerScores.LanguageAnalyzer).toBeDefined();

    // Filter language issues
    const languageIssues = report.issues.filter((issue: { type: string }) =>
      issue.type.startsWith('language-'),
    );

    // Should detect text mismatch issues (French and German paragraphs)
    const textMismatchIssues = languageIssues.filter(
      (issue: { type: string }) => issue.type === 'language-text-mismatch',
    );
    expect(textMismatchIssues.length).toBeGreaterThanOrEqual(2);

    // Should detect link mismatch issues (/fr/about, /de/about, ?lang=es, hreflang=ja)
    const linkMismatchIssues = languageIssues.filter(
      (issue: { type: string }) => issue.type === 'language-link-mismatch',
    );
    expect(linkMismatchIssues.length).toBeGreaterThanOrEqual(3);

    // Text mismatch issues should have moderate severity
    for (const issue of textMismatchIssues) {
      expect(issue.severity).toBe('moderate');
    }

    // Link mismatch issues should have minor severity
    for (const issue of linkMismatchIssues) {
      expect(issue.severity).toBe('minor');
    }
  });

  test('should not flag text wrapped in correct lang attribute', async ({ page }) => {
    await page.goto('http://localhost:3000/language-demos.html');

    const report = await runAudit({
      page,
      languageTarget: 'en', // Required to run language analyzer phase
      thresholds: {
        LanguageAnalyzer: 1,
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
      },
    });

    // The French section with lang="fr" should NOT be flagged
    const textMismatchIssues = report.issues.filter(
      (issue: { type: string }) => issue.type === 'language-text-mismatch',
    );

    // None of the text mismatch issues should reference the lang="fr" wrapped content
    for (const issue of textMismatchIssues) {
      const snippet = (issue.issueMetadata?.textSnippet as string) ?? '';
      // The intentionally wrapped paragraph starts with "Ce paragraphe est en français mais il est enveloppé"
      expect(snippet).not.toContain('enveloppé');
    }
  });

  test('good page should have high language score', async ({ page }) => {
    await page.goto('http://localhost:3000/good-page.html');

    const report = await runAudit({
      page,
      languageTarget: 'en', // Required to run language analyzer phase
      thresholds: {
        LanguageAnalyzer: 70,
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
      },
    });

    expect(report.analyzerScores.LanguageAnalyzer).toBeGreaterThanOrEqual(70);
  });
});
