// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerStrategy, Issue } from '../../types/types';
import type { LayoutStabilityAnalyzerContext, SelfOverflowRawIssue } from './types';
import { safeFinder } from '../../utils/safeFinder';
import { hasDirectTextContent } from '../../utils/hasDirectTextContent';
import { computeOverflowThreshold } from './utils';

/**
 * Detects elements whose content overflows after text expansion (~30% pseudolocalization).
 * Compares scrollWidth/scrollHeight vs clientWidth/clientHeight before and after.
 *
 * Threshold: effective threshold is max(pixel, percent-of-element). Both must be exceeded.
 *
 * @example
 * const strategy = new SelfOverflowAnalyzerStrategy();
 * const issues = strategy.analyze(context);
 */
export class SelfOverflowAnalyzerStrategy
  implements AnalyzerStrategy<LayoutStabilityAnalyzerContext>
{
  readonly name: string = 'self-overflow-analyzer-strategy';
  readonly issueType: string = 'layout-stability-self-overflow';

  analyze(context: LayoutStabilityAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  private detect({
    elements,
    beforeSnapshots,
    afterSnapshots,
    options: { overflowDeltaPercentThreshold, overflowDeltaPixelThreshold },
  }: LayoutStabilityAnalyzerContext): SelfOverflowRawIssue[] {
    const issues: SelfOverflowRawIssue[] = [];

    for (const element of elements) {
      try {
        if (!hasDirectTextContent(element)) continue;

        const styles = window.getComputedStyle(element);
        if (styles.overflowX !== 'visible' || styles.overflowY !== 'visible') continue;

        const beforeSnapshot = beforeSnapshots.get(element);
        const afterSnapshot = afterSnapshots.get(element);
        if (!beforeSnapshot || !afterSnapshot) continue;

        const overflowXBefore = beforeSnapshot.scrollWidth - beforeSnapshot.clientWidth;
        const overflowYBefore = beforeSnapshot.scrollHeight - beforeSnapshot.clientHeight;
        const overflowXAfter = afterSnapshot.scrollWidth - afterSnapshot.clientWidth;
        const overflowYAfter = afterSnapshot.scrollHeight - afterSnapshot.clientHeight;

        const overflowXDelta = overflowXAfter - overflowXBefore;
        const overflowYDelta = overflowYAfter - overflowYBefore;

        if (overflowXDelta <= 0 && overflowYDelta <= 0) continue;

        const elementWidth = beforeSnapshot.clientWidth;
        const elementHeight = beforeSnapshot.clientHeight;

        if (elementWidth === 0 && elementHeight === 0) continue;

        const horizontalThreshold = computeOverflowThreshold(
          elementWidth,
          overflowDeltaPercentThreshold,
          overflowDeltaPixelThreshold,
        );
        const verticalThreshold = computeOverflowThreshold(
          elementHeight,
          overflowDeltaPercentThreshold,
          overflowDeltaPixelThreshold,
        );

        if (overflowXDelta > horizontalThreshold || overflowYDelta > verticalThreshold) {
          issues.push({
            type: this.issueType,
            severity: 'serious',
            elementSelector: safeFinder(element),
            issueMetadata: {
              overflowXDelta,
              overflowYDelta,
              overflowXPercent:
                elementWidth > 0 ? Math.round((overflowXDelta / elementWidth) * 100) : 0,
              overflowYPercent:
                elementHeight > 0 ? Math.round((overflowYDelta / elementHeight) * 100) : 0,
              horizontalThreshold,
              verticalThreshold,
            },
          });
        }
      } catch (error) {
        console.warn(`[SelfOverflowAnalyzerStrategy] Failed to analyze element:`, error);
        continue;
      }
    }

    return issues;
  }

  private formatIssue(raw: SelfOverflowRawIssue): Issue {
    const {
      overflowXDelta,
      overflowYDelta,
      overflowXPercent,
      overflowYPercent,
      horizontalThreshold,
      verticalThreshold,
    } = raw.issueMetadata;

    let message = 'Text expansion causes content to overflow its container.';

    if (overflowXDelta > horizontalThreshold) {
      message += ` Horizontal overflow: ${Math.round(overflowXDelta)}px (${overflowXPercent}% of container width).`;
    }

    if (overflowYDelta > verticalThreshold) {
      message += ` Vertical overflow: ${Math.round(overflowYDelta)}px (${overflowYPercent}% of container height).`;
    }

    return {
      ...raw,
      id: crypto.randomUUID(),
      message,
      remediation: {
        docsUrl:
          'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox',
        suggestion:
          'Avoid fixed widths on text containers. Use flexible layouts (flexbox/grid), min-width instead of width, or allow text wrapping with word-wrap: break-word.',
      },
    };
  }
}
