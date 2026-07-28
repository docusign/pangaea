// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { test, expect } from '@playwright/test';
import { runAudit } from '@pangaea/playwright';

test.describe('CollationAnalyzer E2E', () => {
  test('should detect unsorted lists on test page', async ({ page }) => {
    await page.goto('http://localhost:3000/collation-demos.html');

    const report = await runAudit({
      page,
      thresholds: {
        CollationAnalyzer: 0,
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
        LanguageAnalyzer: 0,
      },
    });

    expect(report).toBeDefined();
    expect(report.analyzerScores.CollationAnalyzer).toBeDefined();

    const listIssues = report.issues.filter(
      (issue: { type: string }) => issue.type === 'collation-unsorted-list',
    );

    // Should detect at least 3 unsorted lists: Country List (ol), Spanish Names (ol), Notification Categories (ul)
    expect(listIssues.length).toBeGreaterThanOrEqual(3);

    // All list issues should have minor severity
    for (const issue of listIssues) {
      expect(issue.severity).toBe('minor');
    }
  });

  test('should detect unsorted selects on test page', async ({ page }) => {
    await page.goto('http://localhost:3000/collation-demos.html');

    const report = await runAudit({
      page,
      thresholds: {
        CollationAnalyzer: 0,
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
        LanguageAnalyzer: 0,
      },
    });

    const selectIssues = report.issues.filter(
      (issue: { type: string }) => issue.type === 'collation-unsorted-select',
    );

    // Should detect at least 2 unsorted selects: Country Selector, French Cities
    expect(selectIssues.length).toBeGreaterThanOrEqual(2);

    for (const issue of selectIssues) {
      expect(issue.severity).toBe('minor');
    }
  });

  test('should detect unsorted table columns on test page', async ({ page }) => {
    await page.goto('http://localhost:3000/collation-demos.html');

    const report = await runAudit({
      page,
      thresholds: {
        CollationAnalyzer: 0,
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
        LanguageAnalyzer: 0,
      },
    });

    const tableIssues = report.issues.filter(
      (issue: { type: string }) => issue.type === 'collation-unsorted-table',
    );

    // Should detect at least 2 unsorted table columns: Employee Directory (Name), Product Catalog (Product)
    expect(tableIssues.length).toBeGreaterThanOrEqual(2);

    for (const issue of tableIssues) {
      expect(issue.severity).toBe('minor');
    }
  });

  test('should not flag correctly sorted elements', async ({ page }) => {
    await page.goto('http://localhost:3000/collation-demos.html');

    const report = await runAudit({
      page,
      thresholds: {
        CollationAnalyzer: 0,
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
        LanguageAnalyzer: 0,
      },
    });

    const collationIssues = report.issues.filter((issue: { type: string }) =>
      issue.type.startsWith('collation-'),
    );

    // The correctly sorted elements (Fruit List, Language Selector, Team Roster)
    // should not appear in the issues
    for (const issue of collationIssues) {
      const selector = issue.elementSelector ?? '';
      expect(selector).not.toContain('lang-select');
    }
  });

  test('good page should have high collation score', async ({ page }) => {
    await page.goto('http://localhost:3000/good-page.html');

    const report = await runAudit({
      page,
      thresholds: {
        CollationAnalyzer: 80,
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
        LanguageAnalyzer: 0,
      },
    });

    expect(report.analyzerScores.CollationAnalyzer).toBeGreaterThanOrEqual(80);
  });
});
