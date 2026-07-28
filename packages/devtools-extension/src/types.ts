// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

// types.ts
import type { AuditProgress } from '@pangaea/core';

export interface AuditMessage {
  source: 'glob-audit-extension';
  type: 'GLOB_AUDIT_RESULT' | 'GLOB_AUDIT_ERROR' | 'GLOB_AUDIT_PROGRESS' | 'HIGHLIGHT_CLEARED';
  result?: unknown;
  error?: string;
  progress?: AuditProgress;
  requestId?: string;
}
