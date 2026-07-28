// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { test, expect } from '@playwright/test';
import { runAudit } from '@pangaea/playwright';

test.describe('IMEAnalyzer E2E', () => {
  test('should detect IME issues on ime-demos page', async ({ page }) => {
    await page.goto('http://localhost:3000/ime-demos.html');

    const report = await runAudit({
      page,
      thresholds: {
        IMEAnalyzer: 0,
      },
    });

    expect(report).toBeDefined();
    expect(report.analyzerScores).toBeDefined();

    const imeIssues = report.issues.filter(
      (issue) => issue.type === 'ime-missing-isComposing-check',
    );

    // The page has multiple breaking examples with handlers missing isComposing checks
    expect(imeIssues.length).toBeGreaterThan(0);

    // Each issue should have the expected structure
    for (const issue of imeIssues) {
      expect(issue.severity).toBe('critical');
      expect(issue.elementSelector).toBeDefined();
      expect(issue.message).toContain('isComposing');
      expect(issue.remediation).toBeDefined();
      expect(issue.remediation?.docsUrl).toContain('isComposing');
    }
  });

  test('should report IME score for the page', async ({ page }) => {
    await page.goto('http://localhost:3000/ime-demos.html');

    const report = await runAudit({
      page,
      thresholds: {
        IMEAnalyzer: 0,
      },
    });

    expect(report.analyzerScores.IMEAnalyzer).toBeDefined();
    expect(typeof report.analyzerScores.IMEAnalyzer).toBe('number');
  });
});
