# Globalization Audit Playwright Plugin

A Playwright plugin for auditing web applications for globalization and internationalization issues.
Detects RTL layout problems, encoding issues, layout stability problems, IME input handling, and
language/collation mismatches across single or multiple pages.

## Installation

Install the package from the monorepo workspace:

```bash
npm install @pangaea-g11n/playwright
```

or with yarn:

```bash
yarn add @pangaea-g11n/playwright
```

## Core Function

The plugin exports one primary function:

1. **`runAudit()`** — Execute a single-page audit in legacy or structured mode

## Single-Page Audit

### Basic Example

Import `runAudit` and execute a globalization audit on a single page:

```typescript
import { test, expect } from '@playwright/test';
import { runAudit } from '@pangaea-g11n/playwright';
import { join } from 'path';

test('should pass globalization audit', async ({ page }) => {
  await page.goto('https://example.com');

  const result = await runAudit({
    page,
    target: { name: 'Homepage', path: '/' },
    thresholds: {
      RTLAnalyzer: 70,
      EncodingAnalyzer: 70,
      LayoutStabilityAnalyzer: 60,
      IMEAnalyzer: 60,
      LanguageAnalyzer: 70,
      globalizationScore: 70,
    },
    resultArtifactsDir: join(process.cwd(), 'reports'),
  });

  // Verify audit passed
  expect(result.audited).toBe(true);
  expect(result.globalScore).toBeGreaterThanOrEqual(70);
  const thresholdFailures = [
    ...(result.thresholdFailures ?? []),
    ...(result.analyzerThresholdFailures ?? []),
  ];
  expect(thresholdFailures.length).toBe(0);
});
```

### `runAudit(options)` Configuration

**Required Parameters:**

- `page` (Playwright Page) — The page to audit
- `thresholds` (object) — Score thresholds for pass/fail evaluation
  - `RTLAnalyzer` (number, 0-100, optional) — Right-to-left layout support
  - `EncodingAnalyzer` (number, 0-100, optional) — Text encoding compatibility
  - `LayoutStabilityAnalyzer` (number, 0-100, optional) — Layout stability (overflow detection)
  - `IMEAnalyzer` (number, 0-100, optional) — Input Method Editor support
  - `LanguageAnalyzer` (number, 0-100, optional) — Language mismatch detection
  - `CollationAnalyzer` (number, 0-100, optional) — Collation/sorting detection
  - `globalizationScore` (number, 0-100, optional) — Overall globalization score threshold
  - **Set any threshold to 0 to disable that analyzer entirely**

**Structured Mode Parameters:**

- `target` (object) — Page identity for artifact naming and reporting
  - `name` (string) — Human-readable page label (e.g., "Homepage", "Billing")
  - `path` (string) — Route path relative to app root (e.g., "/", "/billing")
- `resultArtifactsDir` (string, optional) — Directory to write JSON and text report artifacts

**Optional Parameters:**

- `analyzerWeights` (object) — Custom weights for overall score calculation
  - Keys are analyzer names, values are numeric weights (default: 1 for each)
- `errorSensitivity` (number, default: 5) — Sensitivity threshold for detecting issues
- `languageTarget` (string, default: "en") — Locale code for language-dependent analyzers (e.g.,
  "ja", "fr-FR")
- `defaultThreshold` (number, default: 50) — Fallback threshold for analyzers not explicitly
  configured
- `suppressReportIfPerfect` (boolean, default: true) — Skip formatted report if all analyzer scores
  are 100
- `timeoutMs` (number, optional) — Timeout (in milliseconds) for the entire audit operation
- `retryOnTransientContextError` (boolean, default: true) — Retry once if a transient Playwright
  execution context error occurs
- `beforeAudit` (async function, optional) — Pre-audit hook; useful for navigation and setup
- `beforeRetry` (async function, optional) — Hook invoked before retry attempt (e.g., to wait for
  recovery)
- `changeLang` (async function, optional) — Callback to switch application locale before
  language-dependent analyzers run
  - Only invoked if `revertLang` is also provided
- `revertLang` (async function, optional) — Callback to restore original locale after
  language-dependent analyzers complete
  - Only invoked if `changeLang` is also provided
- `localeDependentAnalyzerNames` (string[], optional) — Override the default list of
  locale-dependent analyzers
  - Default: `['LanguageAnalyzer', 'CollationAnalyzer']`

**Returns:**

`runAudit()` supports two modes:

- Legacy mode: omit `target` and receive the raw `AuditReport`. Threshold failures throw.
- Structured mode: provide `target` and receive `MenuAuditResult`. Threshold failures are returned
  in the result.

Structured mode returns a `MenuAuditResult` object:

```typescript
{
  // Audit metadata
  name: string;                           // From target.name
  path: string;                           // From target.path
  audited: boolean;                       // true if audit completed successfully
  error?: string;                         // Error message if audit failed or thresholds unmet

  // Scores
  globalScore: number | null;             // Overall globalization score (0-100)
  analyzerScores: Record<string, number>; // Scores per analyzer (0-100)

  // Issues and failures
  criticalIssues: AuditIssue[];          // Critical-severity issues only
  totalIssues: number;

  // Threshold evaluation
  analyzerThresholdFailures: string[];   // Which analyzers fell below threshold
  thresholdFailures: string[];           // Human-readable summary of all threshold misses

  // Artifact files (populated after audit completes)
  artifactFilePaths?: {
    resultFilePath: string;              // Path to JSON result file
    outputFilePath: string;              // Path to formatted text report
  };
}
```

## Multi-Page Audit Workflow

For auditing multiple pages in one run, call `runAudit()` per target page and assert each result
directly:

```typescript
import { runAudit } from '@pangaea-g11n/playwright';
import { join } from 'path';

const pages = [
  { name: 'Homepage', path: '/' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Docs', path: '/docs' },
];

const thresholds = {
  RTLAnalyzer: 70,
  EncodingAnalyzer: 70,
  LayoutStabilityAnalyzer: 60,
  IMEAnalyzer: 60,
  LanguageAnalyzer: 70,
  globalizationScore: 70,
};

const resultDir = join(process.cwd(), 'reports', 'globalization');
const results = [];

for (const target of pages) {
  const result = await runAudit({
    page: testPage,
    target,
    thresholds,
    resultArtifactsDir: resultDir,
    timeoutMs: 150000,
    beforeAudit: async () => {
      await testPage.goto(`https://example.com${target.path}`);
    },
  });

  results.push(result);
}

expect(results.every((r) => r.audited)).toBe(true);
expect(
  results.every((r) => {
    const thresholdFailures = [
      ...(r.thresholdFailures ?? []),
      ...(r.analyzerThresholdFailures ?? []),
    ];
    return thresholdFailures.length === 0;
  }),
).toBe(true);
```

Use the per-page text artifacts and/or the `@pangaea-g11n/playwright/pangea-reporter` reporter for
human-readable output in CI.

### Handling Audit Failures

Legacy mode throws an error if thresholds are not met:

```typescript
test('audit with threshold enforcement', async ({ page }) => {
  await page.goto('https://example.com');

  try {
    await runAudit({
      page,
      thresholds: {
        globalizationScore: 95,
      },
    });
  } catch (error) {
    console.log(`Audit failed: ${error.message}`);
    // Contains details about scores and issues found
  }
});
```

Structured mode returns a result with `error`, `thresholdFailures`, and `audited` populated instead
of throwing.

## Locale Switching with Callbacks

By default, the plugin runs all analyzers in an English-only context. To test language-dependent
behavior (e.g., text mismatches in different locales), provide `changeLang` and `revertLang`
callbacks that orchestrate locale switching via your application's UI. Both callbacks must be
provided together — `changeLang` is only invoked if `revertLang` is also supplied, and vice versa.

```typescript
const changeLang = async (): Promise<void> => {
  // Click the footer locale selector
  const langButton = page.locator('[data-qa="footer-link-LANGUAGE_SELECTOR"]');
  await langButton.click();

  // Select the target locale (e.g., Japanese)
  const jaOption = page.locator('[data-qa="language-selection-ja"]');
  await jaOption.click();

  // Wait for locale to settle
  await page.waitForLoadState('networkidle');
};

const revertLang = async (): Promise<void> => {
  // Switch back to English
  const langButton = page.locator('[data-qa="footer-link-LANGUAGE_SELECTOR"]');
  await langButton.click();

  const enOption = page.locator('[data-qa="language-selection-en"]');
  await enOption.click();

  await page.waitForLoadState('networkidle');
};

const result = await runAudit({
  page,
  target: { name: 'Homepage', path: '/' },
  thresholds: {
    RTLAnalyzer: 70,
    EncodingAnalyzer: 70,
    LayoutStabilityAnalyzer: 60,
    IMEAnalyzer: 60,
    LanguageAnalyzer: 70,
    CollationAnalyzer: 70,
    globalizationScore: 70,
  },
  resultArtifactsDir: join(process.cwd(), 'reports'),
  languageTarget: 'ja',
  changeLang,
  revertLang,
});
```

**Audit Flow with Locale Callbacks:**

1. Non-locale-dependent analyzers (RTL, Encoding, LayoutStability, IME by default) run in the
   current locale state
2. `changeLang()` callback is invoked to switch application locale via UI
3. Locale-dependent analyzers (Language, Collation by default — override with
   `localeDependentAnalyzerNames`) run in the target locale
4. `revertLang()` callback is invoked to restore original locale
5. All phase results are merged into a single report

**Important Notes:**

- If `changeLang` throws an error, the audit fails and `revertLang` is still attempted for cleanup.
- If `revertLang` throws an error after a successful audit, the audit result captures the error.
- If callbacks are not provided, locale-dependent analyzers run against the page's existing locale
  state.
- The plugin does not set the `lang` attribute for you; locale switching is owned by the callbacks.
- `changeLang` and `revertLang` should not resolve until the UI has fully settled.

## Artifact Management

When `resultArtifactsDir` is provided, `runAudit()` writes two files per page:

1. **JSON result file** — `audit-result-{page-slug}.json`
   - Machine-readable audit result (MenuAuditResult)
   - Includes scores, issues, threshold failures

2. **Text report file** — `globalization-audit-output-{page-slug}.txt`
   - Human-readable formatted report
   - Shows analyzer scores, issues by severity, remediation suggestions

File paths are returned in the `artifactFilePaths` property of the `runAudit()` result for test
reporting.

## Advanced Configuration

### Custom Analyzer Weights

Override the default equal weighting for analyzers:

```typescript
const result = await runAudit({
  page,
  target: { name: 'Homepage', path: '/' },
  thresholds: { globalizationScore: 70 },
  resultArtifactsDir,
  analyzerWeights: {
    RTLAnalyzer: 2, // Double importance for RTL issues
    EncodingAnalyzer: 0.5, // Lower importance for encoding
    LayoutStabilityAnalyzer: 1,
    IMEAnalyzer: 1,
    LanguageAnalyzer: 1.5,
    CollationAnalyzer: 1,
  },
});
```

### Error Sensitivity

Adjust how aggressively issues are detected:

```typescript
const result = await runAudit({
  page,
  target: { name: 'Homepage', path: '/' },
  thresholds: { globalizationScore: 70 },
  resultArtifactsDir,
  errorSensitivity: 8, // Higher = more sensitive, stricter scoring
});
```

### Custom Default Threshold

Set a fallback score for analyzers not explicitly configured:

```typescript
const result = await runAudit({
  page,
  target: { name: 'Homepage', path: '/' },
  thresholds: {
    RTLAnalyzer: 80,
    // Other analyzers will use defaultThreshold
  },
  resultArtifactsDir,
  defaultThreshold: 70,
});
```

### Disabling Specific Analyzers

Set an analyzer's threshold to 0 to skip it entirely:

```typescript
const result = await runAudit({
  page,
  target: { name: 'Homepage', path: '/' },
  thresholds: {
    RTLAnalyzer: 0, // Disabled, won't run
    EncodingAnalyzer: 70,
    LayoutStabilityAnalyzer: 70,
    IMEAnalyzer: 70,
    LanguageAnalyzer: 70,
  },
  resultArtifactsDir,
});
```

## Best Practices

1. **Pre-audit setup** — Use `beforeAudit` to navigate and set up the page in a consistent state
2. **Timeout management** — Set `timeoutMs` generously for CI environments (150000 ms = 2.5 minutes
   recommended)
3. **Retry resilience** — Keep `retryOnTransientContextError: true` to handle flaky Playwright
   contexts
4. **Artifact organization** — Store results in versioned directories (e.g.,
   `reports/v1.0/globalization`) for easy comparison
5. **Locale isolation** — Use dedicated test accounts for each locale test to avoid contaminating
   other workers' state

## What Gets Audited

- **RTL Support**: Detects missing `dir` attributes, hardcoded text directions, and improper RTL
  styling
- **Text Encoding**: Finds encoding issues and problematic character usage
- **Layout Stability**: Detects content that overflows containers (self-overflow and
  parent-overflow)
- **IME Support**: Identifies input fields that may not handle IME composition correctly

## Integration with CI/CD

Use in your CI pipeline to prevent globalization regressions:

```bash
# In package.json scripts
"test": "playwright test",
"test:glob": "playwright test --grep @glob"
```

```typescript
// Mark specific tests for globalization auditing
test('@glob should audit homepage', async ({ page }) => {
  // ... audit code
});
```

## See Also

- [Globalization Audit DevTools Extension](../devtools-extension) - Interactive browser extension
  for manual auditing
- [Core Analyzers](../core) - Detailed documentation of RTL, Encoding, Layout Stability, and IME
  analyzers
