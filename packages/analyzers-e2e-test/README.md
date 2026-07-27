# Analyzers E2E Test Package

End-to-end tests for analyzers using the `@pangaea/glob-audit-playwright` plugin.

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

- **good-page.html** - Page with proper globalization practices
- **bad-page.html** - Page with globalization issues

## Layout Flow Analyzer Test Pages

- **direct-content-overflow.html** - Elements whose content overflows their visible area
  - Parent containers with fixed widths
  - Nested containers with overflow
  - Tests deduplication logic

- **geometric-position-drift.html** - Elements that shift position when text expands/shrinks
  - Vertical drift from inline elements wrapping
  - Horizontal and vertical drift in grid layouts
  - Absolute positioning drift
  - Tests both expansion (30% larger) and shrinkage (30% smaller) scenarios

- **parent-dimension-overflow.html** - Elements that overflow parent dimensions
  - Width overflow (child wider than parent)
  - Height overflow (child taller than parent)
  - Nested overflow scenarios
  - Flex container overflow

Tests run against `http://localhost:3000` (server starts automatically).
