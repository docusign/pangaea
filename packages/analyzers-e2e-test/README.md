# Analyzers E2E Test Package

End-to-end tests for analyzers using the `@pangaea-g11n/playwright` plugin.

## Setup

Install Playwright browsers:

```bash
npx playwright install chromium
```

## Running Tests

```bash
# Run all tests
yarn test

# Run tests in debug mode
yarn test:debug

# Run tests with UI mode
yarn test:ui
```

## Test Pages

All fixtures live under `test-pages/`.

- **good-page.html** - Page with proper globalization practices
- **bad-page.html** - Page with globalization issues
- **collation-demos.html** - Lists, selects, and tables with locale-unaware sort order
- **ime-demos.html** - Inputs with event handlers that are missing/present the `isComposing` check
- **language-demos.html** - Text and links with a language mismatch against the page's `lang`

### Layout Stability Analyzer Test Pages

- **layoutStability.analyzer/self-overflow.html** - Elements whose content overflows their own
  container after text expansion
- **layoutStability.analyzer/sibling-collision.html** - Elements that shift and collide with
  siblings after text expansion

Tests run against `http://localhost:3000` (server starts automatically).
