// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Raw issue returned by strategies — structured detection data without
 * human-readable message or generated ID. Strategies produce these,
 * and `formatIssue` (or the analyzer) turns them into full `Issue` objects.
 */
export interface RawIssue {
  type: string;
  elementSelector: string;
  severity: Severity;
  issueMetadata?: Record<string, unknown>;
}

export interface Issue extends RawIssue {
  id: string; // Unique identifier for the issue
  message?: string; // User-friendly description of the problem
  remediation?: {
    docsUrl: string; // Link to internal/external documentation
    suggestion: string; // A brief suggestion, e.g., "Use 'margin-inline-start' instead."
  };
}

export type Severity = 'critical' | 'serious' | 'moderate' | 'minor' | 'info';

export type Awaitable<T> = T | Promise<T>;

export interface AuditReport {
  analyzerScores: Record<string, number>; // Individual scores for each analyzer (0-100)
  globalizationScore: number; // Calculated overallscore from 0-100
  timestamp: string; // ISO 8601 timestamp
  url: string; // URL of the audited page
  issues: Issue[];
}

// TODO: Add comment later
export interface Analyzer {
  name: string;
  run(rootElement: HTMLElement): Promise<Issue[]>;
}

/**
 * A pluggable detection strategy used by analyzers.
 *
 * Strategies handle both detection and formatting internally.
 * Use a private detect method returning `RawIssue[]` and a `formatIssue` method
 * to keep detection and presentation logic separated within the strategy.
 */
export interface AnalyzerStrategy<TContext extends AnalyzerContext> {
  readonly name: string;
  analyze(context: TContext): Awaitable<Issue[]>;
}

// TODO: Add comment later
export interface AnalyzerContext {
  rootElement: HTMLElement;
  elements: HTMLElement[];
}

/**
 * Snapshot of an element's layout measurements at a point in time.
 * Used to compare before/after states in analyzers.
 */
export interface ElementSnapshot {
  /** Element's position and size relative to the viewport */
  boundingRect: DOMRect;
  /** Total width of content including overflow */
  scrollWidth: number;
  /** Total height of content including overflow */
  scrollHeight: number;
  /** Visible width of the element (excluding scrollbars) */
  clientWidth: number;
  /** Visible height of the element (excluding scrollbars) */
  clientHeight: number;
}

// TODO: Add Comment later
export interface AnalyzerConfig<TContext extends AnalyzerContext> {
  strategies: AnalyzerStrategy<TContext>[];
}
