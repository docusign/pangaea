# Pangaea

[![CI](https://github.com/docusign/pangaea/actions/workflows/ci.yml/badge.svg)](https://github.com/docusign/pangaea/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](packages/core/vitest.config.mts)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm: @pangaea-g11n/core](https://img.shields.io/npm/v/@pangaea-g11n/core.svg?label=%40pangaea-g11n%2Fcore)](https://www.npmjs.com/package/@pangaea-g11n/core)
[![npm downloads: @pangaea-g11n/core](https://img.shields.io/npm/dm/@pangaea-g11n/core.svg)](https://www.npmjs.com/package/@pangaea-g11n/core)
[![npm: @pangaea-g11n/playwright](https://img.shields.io/npm/v/@pangaea-g11n/playwright.svg?label=%40pangaea-g11n%2Fplaywright)](https://www.npmjs.com/package/@pangaea-g11n/playwright)
[![npm downloads: @pangaea-g11n/playwright](https://img.shields.io/npm/dm/@pangaea-g11n/playwright.svg)](https://www.npmjs.com/package/@pangaea-g11n/playwright)
[![Node.js Version](https://img.shields.io/node/v/@pangaea-g11n/core.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A monorepo of tools for detecting globalization and internationalization (i18n) issues in web
applications. Provides a Chrome DevTools extension for manual inspection and a Playwright plugin for
automated CI auditing.

---

## Packages

| Package                                                      | Name                                         | Description                                                 |
| ------------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------- |
| [`packages/core`](packages/core)                             | `@pangaea-g11n/core`                         | Analyzer engine — runs analyzers and produces audit reports |
| [`packages/playwright-plugin`](packages/playwright-plugin)   | `@pangaea-g11n/playwright`                   | Playwright plugin for running audits in E2E tests           |
| [`packages/devtools-extension`](packages/devtools-extension) | `@pangaea-g11n/extension` (private)          | Chrome DevTools extension for interactive browser auditing  |
| [`packages/analyzers-e2e-test`](packages/analyzers-e2e-test) | `@pangaea-g11n/analyzers-e2e-test` (private) | E2E smoke tests for the analyzers themselves                |

---

## What Gets Detected

| Analyzer                    | What It Checks                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **RTLAnalyzer**             | Missing `dir` attributes, hardcoded text directions, improper RTL styling                                             |
| **EncodingAnalyzer**        | Mojibake patterns from UTF-8 → Windows-1252, Shift_JIS, and EUC-JP mismatches                                         |
| **LayoutStabilityAnalyzer** | Content overflow (self-overflow and parent-overflow) that breaks when text expands                                    |
| **IMEAnalyzer**             | Input fields with keyboard handlers that are missing an `event.isComposing` guard, which breaks CJK input composition |
| **LanguageAnalyzer**        | Text content or links whose detected language does not match the page's declared `lang` attribute                     |
| **CollationAnalyzer**       | List, table, and `select` elements whose items are not sorted correctly for the page locale                           |

---

## Prerequisites

- Node.js 22+ (see `.node-version` / `.nvmrc`)
- Yarn (Corepack) — enabled automatically via `.yarnrc.yml`

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/docusign/pangaea.git
cd pangaea

# Install dependencies
yarn install

# Build all packages
yarn build
```

---

## Chrome DevTools Extension

The extension lets you manually audit any page you have open in Chrome without writing any test
code.

### Load the Extension

1. Build the extension:

   ```bash
   yarn build
   ```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select `packages/devtools-extension/dist`
5. Open Chrome DevTools (`F12`) and look for the **Pangæa** tab

### Run an Audit

1. Navigate to the page you want to inspect
2. Open DevTools → **Pangæa** tab
3. Configure the analyzers you want to run and click **Run Audit**
4. Click on any issue in the report to highlight the offending element on the page
5. Optionally export the report as a PDF

---

## Playwright Plugin

Use `@pangaea-g11n/playwright` to add globalization checks directly into your Playwright E2E test
suite.

### Install

Add it to your project:

```bash
yarn add @pangaea-g11n/playwright
```

### Usage

Import `runAudit` and run it against a page inside a test:

```typescript
import { test, expect } from '@playwright/test';
import { runAudit } from '@pangaea-g11n/playwright';

test('passes the globalization audit', async ({ page }) => {
  await page.goto('https://example.com');

  const result = await runAudit({
    page,
    target: { name: 'Homepage', path: '/' },
    thresholds: { globalizationScore: 70 },
  });

  expect(result.globalScore).toBeGreaterThanOrEqual(70);
});
```

See the [plugin README](packages/playwright-plugin/README.md) for per-analyzer thresholds, result
artifacts, and reporter configuration.

---

## Development

All commands run from the repo root and use [Turborepo](https://turbo.build/repo) to run tasks in
parallel across packages.

```bash
yarn build            # Build all packages
yarn test             # Run all unit tests
yarn test:coverage    # Run tests with coverage
yarn lint             # Lint all packages
yarn format           # Auto-format all files
yarn format:check     # Check formatting without writing
yarn check-types      # TypeScript type-check all packages
yarn clean            # Delete all build outputs and node_modules
```

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow,
coding standards, and how to open issues and pull requests.

## Security

To report a security vulnerability, please follow the process in [SECURITY.md](SECURITY.md). Do not
open a public issue for security reports.

## Community

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Docusign, Inc.
