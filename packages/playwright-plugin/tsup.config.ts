// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { baseConfig } from '../../tsup.config.base';

// Read the core IIFE bundle at build time so it's embedded in the output.
// No runtime filesystem lookups needed.
const __dir = dirname(fileURLToPath(import.meta.url));
const coreIIFE = readFileSync(join(__dir, '../core/dist/index.global.js'), 'utf-8');
const { version: libraryVersion } = JSON.parse(
  readFileSync(join(__dir, 'package.json'), 'utf-8'),
) as { version: string };

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts', 'src/pangeaReporter.ts'],
  format: ['esm', 'cjs'],
  platform: 'node', // Playwright plugin runs in Node.js
  external: ['@playwright/test'], // Don't bundle Playwright
  define: {
    CORE_IIFE_BUNDLE: JSON.stringify(coreIIFE),
    LIBRARY_VERSION: JSON.stringify(libraryVersion),
  },
});
