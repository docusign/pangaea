// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.mts';

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
