// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { test, expect } from '@playwright/test';
import { runAudit } from '@pangaea/playwright';

test.describe('RTLAnalyzer E2E', () => {
  test('should pass audit for page with good globalization practices', async ({ page }) => {
    await page.goto('http://localhost:3000/good-page.html');

    const report = await runAudit({
      page,
      thresholds: {
        RTLAnalyzer: 70,
        EncodingAnalyzer: 70,
        LayoutStabilityAnalyzer: 60,
        IMEAnalyzer: 60,
        globalizationScore: 70,
      },
    });

    // Verify report structure
    expect(report).toBeDefined();
    expect(report.globalizationScore).toBeGreaterThanOrEqual(70);
    expect(report.analyzerScores).toBeDefined();
    expect(report.issues).toBeDefined();
    expect(report.url).toContain('good-page.html');
    expect(report.timestamp).toBeDefined();

    // Should have high scores
    expect(report.analyzerScores.RTLAnalyzer).toBeGreaterThanOrEqual(70);
    expect(report.analyzerScores.EncodingAnalyzer).toBeGreaterThanOrEqual(70);
    expect(report.analyzerScores.LayoutStabilityAnalyzer).toBeGreaterThanOrEqual(60);
    expect(report.analyzerScores.IMEAnalyzer).toBeGreaterThanOrEqual(60);
  });

  test('should return report with minimal issues on good page', async ({ page }) => {
    await page.goto('http://localhost:3000/good-page.html');

    const report = await runAudit({
      page,
      thresholds: {
        RTLAnalyzer: 50,
        EncodingAnalyzer: 50,
        LayoutStabilityAnalyzer: 50,
        IMEAnalyzer: 50,
      },
    });

    // Good page should have very few or no critical issues
    const criticalIssues = report.issues.filter(
      (issue: { severity?: string }) => issue.severity === 'critical',
    );
    expect(criticalIssues.length).toBeLessThan(5);
  });
});

test.describe('RTLAnalyzer E2E - Bad Page Tests', () => {
  test('should detect issues on page with poor globalization', async ({ page }) => {
    await page.goto('http://localhost:3000/bad-page.html');

    const report = await runAudit({
      page,
      thresholds: {
        RTLAnalyzer: 0,
        EncodingAnalyzer: 0,
        LayoutStabilityAnalyzer: 0,
        IMEAnalyzer: 0,
      },
    });

    // Bad page should have issues
    expect(report.issues.length).toBeGreaterThan(0);

    // Should have RTL issues due to hardcoded directional properties
    const rtlIssues = report.issues.filter((issue: { type: string }) => issue.type.includes('rtl'));
    expect(rtlIssues.length).toBeGreaterThan(0);
  });

  test('should fail when thresholds are not met', async ({ page }) => {
    await page.goto('http://localhost:3000/bad-page.html');

    await expect(
      runAudit({
        page,
        thresholds: {
          RTLAnalyzer: 95,
          EncodingAnalyzer: 95,
          LayoutStabilityAnalyzer: 95,
          IMEAnalyzer: 95,
          globalizationScore: 95,
        },
      }),
    ).rejects.toThrow('Globalization audit failed');
  });

  test('should provide detailed error message on failure', async ({ page }) => {
    await page.goto('http://localhost:3000/bad-page.html');

    try {
      await runAudit({
        page,
        thresholds: {
          RTLAnalyzer: 90,
        },
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain('Globalization audit failed');
      expect(errorMessage).toContain('Overall Score');
      expect(errorMessage).toContain('Issues Found');
    }
  });
});

test.describe('RTLAnalyzer E2E - Configuration Tests', () => {
  test('should accept custom analyzer weights', async ({ page }) => {
    await page.goto('http://localhost:3000/good-page.html');

    const report = await runAudit({
      page,
      thresholds: {
        RTLAnalyzer: 50,
      },
      analyzerWeights: {
        RTLAnalyzer: 3,
        EncodingAnalyzer: 1,
        LayoutStabilityAnalyzer: 1,
        IMEAnalyzer: 1,
      },
    });

    expect(report).toBeDefined();
    expect(report.globalizationScore).toBeGreaterThan(0);
  });

  test('should accept custom error sensitivity', async ({ page }) => {
    await page.goto('http://localhost:3000/good-page.html');

    const report = await runAudit({
      page,
      thresholds: {
        RTLAnalyzer: 50,
      },
      errorSensitivity: 8,
    });

    expect(report).toBeDefined();
    expect(report.globalizationScore).toBeGreaterThan(0);
  });

  test('should handle empty thresholds', async ({ page }) => {
    await page.goto('http://localhost:3000/good-page.html');

    const report = await runAudit({
      page,
      thresholds: {},
    });

    expect(report).toBeDefined();
    expect(report.globalizationScore).toBeDefined();
  });
});
