// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerStrategy, Issue } from '../../types/types';
import type { LayoutStabilityAnalyzerContext, ParentOverflowRawIssue } from './types';
import { safeFinder } from '../../utils/safeFinder';
import { computeOverflowThreshold } from './utils';

/**
 * Detects elements that escape their parent's boundaries after text expansion.
 * Compares bounding rects before/after pseudolocalization and flags new overflow.
 *
 * Skips: parents with overflow:hidden/scroll/auto, pre-existing overflow, zero-dimension parents.
 * Threshold: effective threshold is max(pixel, percent-of-parent).
 *
 * @example
 * const strategy = new ParentOverflowAnalyzerStrategy();
 * const issues = strategy.analyze(context);
 */
export class ParentOverflowAnalyzerStrategy
  implements AnalyzerStrategy<LayoutStabilityAnalyzerContext>
{
  readonly name: string = 'parent-overflow-analyzer-strategy';
  readonly issueType: string = 'layout-stability-parent-overflow';

  analyze(context: LayoutStabilityAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  private detect({
    elements,
    beforeSnapshots,
    afterSnapshots,
    options: { overflowDeltaPercentThreshold, overflowDeltaPixelThreshold },
  }: LayoutStabilityAnalyzerContext): ParentOverflowRawIssue[] {
    const issues: ParentOverflowRawIssue[] = [];

    for (const element of elements) {
      try {
        const parent = element.parentElement;
        if (!parent) continue;

        const parentStyles = window.getComputedStyle(parent);
        if (parentStyles.overflowX !== 'visible' || parentStyles.overflowY !== 'visible') continue;

        const beforeSnapshot = beforeSnapshots.get(element);
        const beforeSnapshotParent = beforeSnapshots.get(parent);
        const afterSnapshot = afterSnapshots.get(element);
        const afterSnapshotParent = afterSnapshots.get(parent);

        if (!beforeSnapshot || !afterSnapshot || !beforeSnapshotParent || !afterSnapshotParent) {
          continue;
        }

        const elementRect = beforeSnapshot.boundingRect;
        const parentRect = beforeSnapshotParent.boundingRect;

        // Skip elements that already overflow their parent before expansion
        if (
          elementRect.left < parentRect.left ||
          elementRect.top < parentRect.top ||
          elementRect.right > parentRect.right ||
          elementRect.bottom > parentRect.bottom
        ) {
          continue;
        }

        const parentWidth = beforeSnapshotParent.clientWidth;
        const parentHeight = beforeSnapshotParent.clientHeight;
        if (parentWidth === 0 || parentHeight === 0) continue;

        const beforeElementRect = beforeSnapshot.boundingRect;
        const afterElementRect = afterSnapshot.boundingRect;
        const beforeParentRect = beforeSnapshotParent.boundingRect;
        const afterParentRect = afterSnapshotParent.boundingRect;

        const overflowRightDelta = this.calculateOverflowDelta(
          beforeElementRect.right - beforeParentRect.right,
          afterElementRect.right - afterParentRect.right,
        );
        const overflowLeftDelta = this.calculateOverflowDelta(
          beforeParentRect.left - beforeElementRect.left,
          afterParentRect.left - afterElementRect.left,
        );
        const overflowBottomDelta = this.calculateOverflowDelta(
          beforeElementRect.bottom - beforeParentRect.bottom,
          afterElementRect.bottom - afterParentRect.bottom,
        );
        const overflowTopDelta = this.calculateOverflowDelta(
          beforeParentRect.top - beforeElementRect.top,
          afterParentRect.top - afterElementRect.top,
        );

        if (
          overflowRightDelta <= 0 &&
          overflowLeftDelta <= 0 &&
          overflowBottomDelta <= 0 &&
          overflowTopDelta <= 0
        ) {
          continue;
        }

        const overflowRight = Math.max(0, afterElementRect.right - afterParentRect.right);
        const overflowLeft = Math.max(0, afterParentRect.left - afterElementRect.left);
        const overflowBottom = Math.max(0, afterElementRect.bottom - afterParentRect.bottom);
        const overflowTop = Math.max(0, afterParentRect.top - afterElementRect.top);

        const horizontalThreshold = computeOverflowThreshold(
          parentWidth,
          overflowDeltaPercentThreshold,
          overflowDeltaPixelThreshold,
        );
        const verticalThreshold = computeOverflowThreshold(
          parentHeight,
          overflowDeltaPercentThreshold,
          overflowDeltaPixelThreshold,
        );

        if (
          overflowRight > horizontalThreshold ||
          overflowLeft > horizontalThreshold ||
          overflowBottom > verticalThreshold ||
          overflowTop > verticalThreshold
        ) {
          issues.push({
            type: this.issueType,
            severity: 'serious',
            elementSelector: safeFinder(element),
            issueMetadata: {
              overflowRight,
              overflowLeft,
              overflowBottom,
              overflowTop,
              overflowRightPercent: Math.round((overflowRight / parentWidth) * 100),
              overflowLeftPercent: Math.round((overflowLeft / parentWidth) * 100),
              overflowBottomPercent: Math.round((overflowBottom / parentHeight) * 100),
              overflowTopPercent: Math.round((overflowTop / parentHeight) * 100),
              parentSelector: safeFinder(parent),
              horizontalThreshold,
              verticalThreshold,
            },
          });
        }
      } catch (error) {
        console.warn(`[ParentOverflowAnalyzerStrategy] Failed to analyze element:`, error);
        continue;
      }
    }

    return issues;
  }

  private formatIssue(raw: ParentOverflowRawIssue): Issue {
    const {
      overflowRight,
      overflowLeft,
      overflowBottom,
      overflowTop,
      horizontalThreshold,
      verticalThreshold,
    } = raw.issueMetadata;

    const directions: string[] = [];
    if (overflowRight > horizontalThreshold)
      directions.push(`right by ${Math.round(overflowRight)}px`);
    if (overflowLeft > horizontalThreshold)
      directions.push(`left by ${Math.round(overflowLeft)}px`);
    if (overflowBottom > verticalThreshold)
      directions.push(`bottom by ${Math.round(overflowBottom)}px`);
    if (overflowTop > verticalThreshold) directions.push(`top by ${Math.round(overflowTop)}px`);

    return {
      ...raw,
      id: crypto.randomUUID(),
      message: `Text expansion causes element to overflow its parent container. Overflow: ${directions.join(', ')}.`,
      remediation: {
        docsUrl:
          'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox',
        suggestion:
          'Allow parent containers to grow with content using flexible layouts. Use min-height/min-width instead of fixed dimensions, or consider using overflow: auto for scrollable regions.',
      },
    };
  }

  /**
   * Returns new overflow caused by expansion, ignoring pre-existing overflow.
   * beforeValue > 0 means element already overflowed before expansion — returns 0.
   */
  private calculateOverflowDelta(beforeValue: number, afterValue: number): number {
    if (beforeValue > 0) return 0;
    return Math.max(0, afterValue);
  }
}
