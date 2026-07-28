// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerContext, RawIssue } from '../../types/types';

/** Configuration options for {@link CollationAnalyzer}. */
export interface CollationAnalyzerOptions {
  /**
   * Minimum number of text items in a list/select for it to be considered
   * a candidate for sort-order validation.
   * @default 5
   */
  minItemCount?: number;
}

/** Issue types emitted by the collation analyzer. */
export type CollationIssueType =
  | 'collation-unsorted-list'
  | 'collation-unsorted-select'
  | 'collation-unsorted-table';

/** Sort direction used by collation comparisons. */
export type SortDirection = 'asc' | 'desc';

/**
 * Analysis result for sequences that appear intended to be alphabetically sorted
 * but are not correctly ordered for locale-aware collation.
 */
export interface SortOrderAnalysis {
  /** Whether the list was intended to be sorted ascending or descending */
  intendedDirection: SortDirection;
  /** Indices of items that break the expected locale sort order */
  outOfOrderIndices: number[];
  /** The correct sequence according to locale-aware collation */
  expectedOrder: string[];
}

/** Analysis context passed to each collation strategy during a run. */
export interface CollationAnalyzerContext extends AnalyzerContext {
  /** Resolved options with all defaults applied. */
  options: Required<CollationAnalyzerOptions>;
  /** BCP 47 language tag of the current page. */
  pageLang: string;
}

/** Structured metadata shared by list and select sort-order issues. */
export interface SortOrderIssueMetadata {
  locale: string;
  itemCount: number;
  outOfOrderIndices: number[];
  actualOrder: string[];
  expectedOrder: string[];
  [key: string]: unknown;
}

/** A RawIssue with strongly-typed list sort-order metadata. */
export type ListSortOrderRawIssue = Omit<RawIssue, 'issueMetadata'> & {
  issueMetadata: SortOrderIssueMetadata;
};

/** A RawIssue with strongly-typed select sort-order metadata. */
export type SelectSortOrderRawIssue = Omit<RawIssue, 'issueMetadata'> & {
  issueMetadata: SortOrderIssueMetadata;
};

/** Structured metadata for table sort-order issues (extends base with column info). */
export interface TableSortOrderIssueMetadata extends SortOrderIssueMetadata {
  columnIndex: number;
  columnHeader: string | null;
}

/** A RawIssue with strongly-typed table sort-order metadata. */
export type TableSortOrderRawIssue = Omit<RawIssue, 'issueMetadata'> & {
  issueMetadata: TableSortOrderIssueMetadata;
};
