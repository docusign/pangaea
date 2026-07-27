// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerContext } from '../../types/types';

export type EncodingIssueType =
  | 'encoding-mismatch-document'
  | 'encoding-mismatch-meta-charset'
  | 'encoding-mismatch-meta-content-type'
  | 'encoding-mojibake';

/**
 * Shared context passed to all encoding strategies.
 * `elements` is inherited from AnalyzerContext but unused (encoding checks operate on the document).
 */
export interface EncodingAnalyzerContext extends AnalyzerContext {
  document: Document;
  expectedEncoding: string; // Normalized to uppercase, e.g. "UTF-8"
  mojibakeDetectionThreshold: number;
}
