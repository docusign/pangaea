// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { defineConfig } from 'tsup';
import { baseConfig } from '../../tsup.config.base';

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts'],
  format: ['esm', 'iife'], // Build both ESM and IIFE (for browser injection)
  globalName: 'GlobalizationAudit', // Global name for IIFE build
  platform: 'browser',
});
