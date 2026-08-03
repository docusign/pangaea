// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.mts';

// Coverage floor for this package, set with a buffer below its current
// coverage (97.7% stmts/lines, 88.44% branch, 99.29% funcs) so incidental
// dips don't break CI while real regressions still get caught.
export default mergeConfig(rootConfig, {
  test: {
    coverage: {
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 95,
        lines: 90,
      },
    },
  },
});
