// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerContext } from '../../types/types';

/**
 * Configuration options for the LanguageAnalyzer.
 */
export interface LanguageAnalyzerOptions {
  /**
   * Minimum text length (in characters) for language detection to be reliable.
   * Shorter text is skipped to avoid false positives on brand names, abbreviations, etc.
   * @default 20
   */
  minTextLength?: number;

  /**
   * Confidence threshold (0–1) for franc language detection.
   * Measured as the margin between best and second-best match.
   * Only flag text when the detection margin exceeds this value.
   * @default 0.1
   */
  confidenceThreshold?: number;
}

export type LanguageIssueType =
  | 'language-text-mismatch'
  | 'language-link-mismatch'
  | 'language-missing-html-lang';

export interface LanguageAnalyzerContext extends AnalyzerContext {
  options: Required<LanguageAnalyzerOptions>;
  /** The effective language from <html lang="..."> */
  pageLang: string;
}
