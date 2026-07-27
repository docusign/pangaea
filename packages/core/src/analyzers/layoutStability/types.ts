// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerContext, ElementSnapshot, RawIssue } from '../../types/types';

export type { ElementSnapshot };

/**
 * Configuration options for the layout stability analyzer.
 */
export interface LayoutStabilityAnalyzerOptions {
  /**
   * Minimum overflow as a percentage of element/parent dimensions.
   * Both this AND pixel threshold must be exceeded to report an issue.
   */
  overflowDeltaPercentThreshold: number;
  /**
   * Minimum overflow in pixels.
   * Both this AND percent threshold must be exceeded to report an issue.
   */
  overflowDeltaPixelThreshold: number;
}

/**
 * Context passed to layout stability strategies for analysis.
 * Contains before/after snapshots captured around pseudolocalization.
 */
export interface LayoutStabilityAnalyzerContext extends AnalyzerContext {
  options: Required<LayoutStabilityAnalyzerOptions>;
  beforeSnapshots: Map<HTMLElement, ElementSnapshot>;
  afterSnapshots: Map<HTMLElement, ElementSnapshot>;
}

/** Structured metadata for self-overflow issues. */
export type SelfOverflowIssueMetadata = {
  overflowXDelta: number;
  overflowYDelta: number;
  overflowXPercent: number;
  overflowYPercent: number;
  horizontalThreshold: number;
  verticalThreshold: number;
};

/** A RawIssue with strongly-typed self-overflow metadata. */
export type SelfOverflowRawIssue = Omit<RawIssue, 'issueMetadata'> & {
  issueMetadata: SelfOverflowIssueMetadata;
};

/** Structured metadata for parent-overflow issues. */
export type ParentOverflowIssueMetadata = {
  overflowRight: number;
  overflowLeft: number;
  overflowBottom: number;
  overflowTop: number;
  overflowRightPercent: number;
  overflowLeftPercent: number;
  overflowBottomPercent: number;
  overflowTopPercent: number;
  parentSelector: string;
  horizontalThreshold: number;
  verticalThreshold: number;
};

/** A RawIssue with strongly-typed parent-overflow metadata. */
export type ParentOverflowRawIssue = Omit<RawIssue, 'issueMetadata'> & {
  issueMetadata: ParentOverflowIssueMetadata;
};
