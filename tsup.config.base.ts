// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { defineConfig } from 'tsup';

// Shared tsup configuration for all packages
export const baseConfig = defineConfig({
  entry: ['src/index.ts'],
  ignoreWatch: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
  outDir: 'dist',
  clean: true,
  format: ['esm'],
  dts: {
    compilerOptions: {
      incremental: false,
      composite: false,
    },
  },
});
