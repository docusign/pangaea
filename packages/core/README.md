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
  errorSensitivity?: number
): Promise<AuditReport>
```

#### Parameters

- **`rootElement`** - The root DOM element to audit
- **`url`** - The URL of the audited page
- **`analyzers`** - Array of analyzer instances to run
- **`analyzerWeights`** _(optional)_ - Custom weights for each analyzer (defaults to equal weights)
- **`errorSensitivity`** _(optional)_ - Error sensitivity for score calculation (defaults to 5,
  range 1-10)

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
    5, // Default error sensitivity
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

Adjust how harshly issues affect the score:

```typescript
// Lenient scoring
const lenientReport = await AuditRunner.runAudit(
  document.body,
  window.location.href,
  [rtlAnalyzer],
  undefined, // no custom weights
  2, // very lenient
);

// Strict scoring
const strictReport = await AuditRunner.runAudit(
  document.body,
  window.location.href,
  [rtlAnalyzer],
  undefined,
  9, // very strict
);
```

### Severity Weights for Analyzer Scores

Issues are weighted by severity when calculating analyzer scores:

| Severity   | Penalty Weight |
| ---------- | -------------- |
| `critical` | 20             |
| `serious`  | 10             |
| `warning`  | 5              |
| `info`     | 1              |

### Analyzer Score Calculation Formula

Each analyzer's score is calculated using an exponential decay formula:

```
score = 100 × e^(-totalPenalty × errorSensitivity / 100)
```

Where:

- `totalPenalty` = sum of all issue weights
- `errorSensitivity` = sensitivity parameter (1-10)

### Analyzer Score Calculation Examples

**With default errorSensitivity = 5:**

| Issues                 | Score |
| ---------------------- | ----- |
| No issues              | 100   |
| 1 info                 | 95    |
| 1 warning              | 78    |
| 1 serious              | 61    |
| 1 critical             | 37    |
| 2 critical             | 14    |
| 1 critical + 2 serious | 22    |

**Same issues with different sensitivity:**

| errorSensitivity | 1 Critical Issue | 1 Critical + 1 Serious |
| ---------------- | ---------------- | ---------------------- |
| 1 (lenient)      | 82               | 74                     |
| 3                | 55               | 41                     |
| 5 (default)      | 37               | 22                     |
| 7                | 25               | 12                     |
| 10 (strict)      | 14               | 5                      |

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
  severity: 'critical' | 'serious' | 'warning' | 'info';
  message: string;
  elementSelector: string;
  remediation: {
    docsUrl: string;
    suggestion: string;
  };
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
