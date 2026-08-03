# @pangaea-g11n/core

Core library for Pangaea. Provides an AuditRunner class for running globalization analyzers and
generating comprehensive audit reports.

## Overview

The `AuditRunner` is a static class that orchestrates the execution of multiple analyzers to assess
the globalization readiness of web applications. It generates detailed reports with scores, issues,
and actionable recommendations.

## Installation

```bash
npm install @pangaea-g11n/core
```

## Basic Usage

```typescript
import { AuditRunner } from '@pangaea-g11n/core';
import type { Analyzer } from '@pangaea-g11n/core';

// Run the audit
const report = await AuditRunner.runAudit(document.body, window.location.href, [rtlAnalyzer]);

console.log(`Overall Score: ${report.globalizationScore}`);
console.log(`Issues Found: ${report.issues.length}`);
```

## Browser Testing

For testing the analyzers directly in the browser, you can use the IIFE (Immediately Invoked
Function Expression) build format.

### Building for Browser

First, configure your `tsup.config.ts` to generate an IIFE build:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'], // IIFE format for direct browser usage
  globalName: 'GlobalizationAudit', // Global variable name
  platform: 'browser',
  outDir: 'dist',
});
```

Build the library:

```bash
yarn run build
```

This generates `dist/index.global.js` that can be used directly in the browser.

### Browser Console Usage

1. Open a website in your browser
2. Open Developer Tools (F12)
3. Copy the index.global.js content to the console.
4. In the console, run:

```javascript
// create your own analyzer instance
const rtlAnalyzer = new window.GlobalizationAudit.RTLAnalyzer();

// Run on any element
const issues = await rtlAnalyzer.run(document.documentElement);
console.log('Issues found:', issues);
```

### Live Examples for Analyzer Testing

https://jbbs.shitaraba.net/bbs/read_archive.cgi/computer/6306/1181816058/  
This is a page using EUC-JP encoding with text that looks like mojibake.

## API Reference

### AuditRunner.runAudit()

```typescript
static async runAudit(
  rootElement: HTMLElement,
  url: string,
  analyzers: Analyzer[],
  analyzerWeights?: Record<string, number>,
  analyzerErrorSensitivity?: Record<string, number>,
  onProgress?: (progress: AuditProgress) => void
): Promise<AuditReport>
```

#### Parameters

- **`rootElement`** - The root DOM element to audit
- **`url`** - The URL of the audited page
- **`analyzers`** - Array of analyzer instances to run
- **`analyzerWeights`** _(optional)_ - Custom weights for each analyzer (defaults to equal weights)
- **`analyzerErrorSensitivity`** _(optional)_ - Per-analyzer error sensitivity for score
  calculation, keyed by analyzer name (defaults to 5 for any analyzer not present in the map, range
  1-10)
- **`onProgress`** _(optional)_ - Callback invoked before each analyzer runs, receiving the analyzer
  name and progress counts

#### Returns

An `AuditReport` object containing:

```typescript
{
  analyzerScores: Record<string, number>;  // Individual scores per analyzer (0-100)
  globalizationScore: number;              // Overall score (0-100)
  timestamp: string;                       // ISO 8601 timestamp
  url: string;                             // Audited page URL
  issues: Issue[];                         // All issues found
}
```

## Advanced Usage

### Complete Example

```typescript
import { AuditRunner } from '@pangaea-g11n/core';
import { rtlAnalyzer, encodingAnalyzer, layoutAnalyzer } from './analyzers';

async function auditCurrentPage() {
  const report = await AuditRunner.runAudit(
    document.body,
    window.location.href,
    [rtlAnalyzer, encodingAnalyzer, layoutAnalyzer],
    {
      RTL: 2, // RTL is most important
      Encoding: 1.5, // Encoding is moderately important
      Layout: 1, // Layout has default importance
    },
    { RTL: 5, Encoding: 5, Layout: 5 }, // Default error sensitivity per analyzer
  );

  // Display results
  console.log(`🌍 Globalization Score: ${report.globalizationScore}/100`);
  console.log('\n📊 Analyzer Scores:');
  Object.entries(report.analyzerScores).forEach(([name, score]) => {
    console.log(`  ${name}: ${score}/100`);
  });

  // Group issues by severity
  const bySeverity = report.issues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log('\n🔍 Issues Found:');
  console.log(`  Critical: ${bySeverity.critical || 0}`);
  console.log(`  Serious: ${bySeverity.serious || 0}`);
  console.log(`  Warning: ${bySeverity.warning || 0}`);
  console.log(`  Info: ${bySeverity.info || 0}`);

  return report;
}
```

## Scoring System

### Overall Score Calculation

The overall globalization score is calculated as:

- **Without weights**: Simple average of all analyzer scores
- **With weights**: Weighted average of analyzer scores

```
overallScore = (score₁×weight₁ + score₂×weight₂ + ...) / (weight₁ + weight₂ + ...)
```

### Custom Analyzer Weights for Overall Score

Prioritize certain analyzers by assigning them higher weights:

```typescript
const report = await AuditRunner.runAudit(
  document.body,
  window.location.href,
  [rtlAnalyzer, encodingAnalyzer, layoutAnalyzer],
  {
    RTL: 2, // RTL has 2x weight
    Encoding: 1.5, // Encoding has 1.5x weight
    Layout: 1, // Layout has normal weight
  },
);

// Overall score = (rtlScore×2 + encodingScore×1.5 + layoutScore×1) / 4.5
```

### Custom Error Sensitivity for Overall Score

Adjust how harshly issues affect the score, per analyzer:

```typescript
// Lenient scoring
const lenientReport = await AuditRunner.runAudit(
  document.body,
  window.location.href,
  [rtlAnalyzer],
  undefined, // no custom weights
  { RTLAnalyzer: 2 }, // very lenient
);

// Strict scoring
const strictReport = await AuditRunner.runAudit(
  document.body,
  window.location.href,
  [rtlAnalyzer],
  undefined,
  { RTLAnalyzer: 9 }, // very strict
);
```

### Severity Levels and Deductions for Analyzer Scores

Issues are grouped by severity when calculating an analyzer's score:

| Severity   | Effect on score                                                            |
| ---------- | -------------------------------------------------------------------------- |
| `critical` | Any single `critical` issue immediately drops the analyzer score to `0`    |
| `serious`  | Linear deduction — `5` points per issue, no diminishing returns            |
| `moderate` | Diminishing returns per issue type — `3 × sqrt(count)` for each issue type |
| `minor`    | Diminishing returns pooled across all types — `2 × sqrt(totalMinorCount)`  |
| `info`     | No effect on score                                                         |

### Analyzer Score Calculation Formula

Unless a `critical` issue is present (which forces the score to `0`), the score is:

```
totalDeduction = (5 × seriousCount)
               + Σ (3 × sqrt(countForType)) over each moderate issue type
               + (2 × sqrt(totalMinorCount))

adjustedDeduction = totalDeduction × (errorSensitivity / 5)

score = clamp(round(100 - adjustedDeduction), 0, 100)
```

Where `errorSensitivity` is the per-analyzer sensitivity value (default `5`, range 1-10). A value of
`5` is neutral (1x multiplier), `10` doubles the deduction, and `1` reduces it to 0.2x.

### Analyzer Score Calculation Examples

**With default errorSensitivity = 5:**

| Issues                 | Score |
| ---------------------- | ----- |
| No issues              | 100   |
| 1 info                 | 100   |
| 1 serious              | 95    |
| 1 moderate             | 97    |
| 1 minor                | 98    |
| 1 critical (any count) | 0     |
| 4 serious              | 80    |

**Same non-critical issue with different sensitivity (1 serious issue):**

| errorSensitivity | Score |
| ---------------- | ----- |
| 1 (lenient)      | 99    |
| 5 (default)      | 95    |
| 10 (strict)      | 90    |

## Type Definitions

### Analyzer

```typescript
interface Analyzer {
  name: string;
  run(rootElement: HTMLElement): Promise<Issue[]>;
}
```

### Issue

```typescript
interface Issue {
  id: string;
  type: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor' | 'info';
  elementSelector: string;
  message?: string;
  remediation?: {
    docsUrl: string;
    suggestion: string;
  };
  issueMetadata?: Record<string, unknown>;
}
```

### AuditReport

```typescript
interface AuditReport {
  analyzerScores: Record<string, number>;
  globalizationScore: number;
  timestamp: string;
  url: string;
  issues: Issue[];
}
```

### AuditProgress

Passed to the optional `onProgress` callback of `AuditRunner.runAudit()` before each analyzer runs.

```typescript
interface AuditProgress {
  currentAnalyzer: string;
  completedAnalyzers: number;
  totalAnalyzers: number;
}
```
