// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerContext, ElementSnapshot, RawIssue } from '../../types/types';

/**
 * Configuration options for the RTL analyzer.
 */
export interface RTLAnalyzerOptions {
  /** Maximum allowed difference as a percentage of element width; scales with element size */
  asymmetryThresholdPercent?: number;
  /** Absolute pixel floor so small elements don't get tiny thresholds */
  asymmetryThresholdPx?: number;
}

/**
 * Context passed to RTL strategies for analysis.
 * Contains before/after snapshots captured around direction flip.
 */
export interface RTLAnalyzerContext extends AnalyzerContext {
  options: Required<RTLAnalyzerOptions>;
  /** The direction that was flipped to (opposite of the page's original direction) */
  targetDir: 'ltr' | 'rtl';
  /** Layout measurements captured before the direction flip */
  beforeSnapshots: Map<HTMLElement, ElementSnapshot>;
  /** Layout measurements captured after the direction flip */
  afterSnapshots: Map<HTMLElement, ElementSnapshot>;
}

/** Structured metadata attached to mirroring issues for type-safe formatting. */
export type MirroringIssueMetadata = {
  /** The direction that was flipped to ('ltr' or 'rtl') */
  targetDir: 'ltr' | 'rtl';
  /** Width of the root container used for mirror calculations */
  containerWidth: number;
  /** Element's right edge position in the original direction */
  originalRight: number;
  /** Absolute drift between expected and actual mirrored position in pixels */
  positionDifference: number;
  /** Absolute difference in element width before and after flip */
  widthDifference: number;
  /** Absolute difference in element height before and after flip */
  heightDifference: number;
  /** Adaptive threshold used to determine if differences are significant */
  thresholdPx: number;
  /** Element width in original direction */
  originalWidth: number;
  /** Element width in flipped direction */
  oppositeWidth: number;
  /** Element height in original direction */
  originalHeight: number;
  /** Element height in flipped direction */
  oppositeHeight: number;
};

/** A RawIssue with strongly-typed mirroring metadata */
export type MirroringRawIssue = Omit<RawIssue, 'issueMetadata'> & {
  issueMetadata: MirroringIssueMetadata;
};
