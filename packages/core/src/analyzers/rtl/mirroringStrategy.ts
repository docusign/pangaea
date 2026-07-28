// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerStrategy, Issue } from '../../types/types';
import type { MirroringRawIssue, RTLAnalyzerContext } from './types';
import { safeFinder } from '../../utils/safeFinder';
import {
  computeAsymmetryThreshold,
  computeMirrorPositionDrift,
  findNearestTrackedAncestorDrift,
  isShiftInheritedFromParent,
  shouldSkipInlineElement,
} from './utils';

/**
 * Detects elements whose position doesn't mirror correctly when page direction flips.
 * Compares each element's distance-from-right (LTR) against distance-from-left (RTL).
 *
 * @example
 * const strategy = new MirroringStrategy();
 * const issues = strategy.analyze(context);
 */
export class MirroringStrategy implements AnalyzerStrategy<RTLAnalyzerContext> {
  readonly name: string = 'mirroring';
  readonly issueType: string = 'rtl-asymmetric-layout';

  analyze(context: RTLAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  private detect({
    rootElement,
    elements,
    beforeSnapshots,
    afterSnapshots,
    targetDir,
    options: { asymmetryThresholdPercent, asymmetryThresholdPx },
  }: RTLAnalyzerContext): MirroringRawIssue[] {
    const issues: MirroringRawIssue[] = [];
    const problematicElements = new Set<HTMLElement>();
    const elementDrifts = new Map<HTMLElement, number>();
    const containerWidth = rootElement.getBoundingClientRect().width;

    for (const element of elements) {
      try {
        if (this.hasProblematicAncestor(element, problematicElements)) {
          problematicElements.add(element);
          continue;
        }

        if (this.shouldSkip(element)) continue;

        const beforeSnapshot = beforeSnapshots.get(element);
        const afterSnapshot = afterSnapshots.get(element);

        if (!beforeSnapshot || !afterSnapshot) continue;

        const currentRect = beforeSnapshot.boundingRect;
        const oppositeRect = afterSnapshot.boundingRect;

        const positionDrift = computeMirrorPositionDrift(
          containerWidth,
          currentRect.right,
          oppositeRect.left,
        );
        const widthDifference = Math.abs(currentRect.width - oppositeRect.width);
        const heightDifference = Math.abs(currentRect.height - oppositeRect.height);

        elementDrifts.set(element, positionDrift);

        const thresholdPx = computeAsymmetryThreshold(
          currentRect.width,
          asymmetryThresholdPercent,
          asymmetryThresholdPx,
        );

        const parentDrift = findNearestTrackedAncestorDrift(element, elementDrifts);

        if (isShiftInheritedFromParent(positionDrift, parentDrift, asymmetryThresholdPx)) continue;

        if (
          positionDrift > thresholdPx ||
          widthDifference > thresholdPx ||
          heightDifference > thresholdPx
        ) {
          problematicElements.add(element);

          issues.push({
            type: this.issueType,
            severity: 'serious',
            elementSelector: safeFinder(element),
            issueMetadata: {
              targetDir,
              containerWidth,
              originalRight: currentRect.right,
              positionDifference: positionDrift,
              widthDifference,
              heightDifference,
              thresholdPx,
              originalWidth: currentRect.width,
              oppositeWidth: oppositeRect.width,
              originalHeight: currentRect.height,
              oppositeHeight: oppositeRect.height,
            },
          });
        }
      } catch (error) {
        console.warn(`[MirroringStrategy] Failed to analyze element:`, error);
        continue;
      }
    }

    return issues;
  }

  private shouldSkip(element: HTMLElement): boolean {
    const computedStyle = getComputedStyle(element);
    return shouldSkipInlineElement(element, computedStyle.display);
  }

  private hasProblematicAncestor(
    element: HTMLElement,
    problematicElements: Set<HTMLElement>,
  ): boolean {
    let ancestor = element.parentElement;
    while (ancestor) {
      if (problematicElements.has(ancestor)) return true;
      ancestor = ancestor.parentElement;
    }
    return false;
  }

  private formatIssue(raw: MirroringRawIssue): Issue {
    const meta = raw.issueMetadata;
    const originalDir = meta.targetDir === 'rtl' ? 'ltr' : 'rtl';

    const parts = [
      `Element layout changes when direction switches from ${originalDir.toUpperCase()} to ${meta.targetDir.toUpperCase()}.`,
    ];

    if (meta.positionDifference > meta.thresholdPx) {
      parts.push(
        `Position issue: Element doesn't mirror properly when direction changes (asymmetry: ${Math.round(meta.positionDifference)}px).`,
      );
    }

    if (meta.widthDifference > meta.thresholdPx) {
      parts.push(
        `Width issue: Width changed from ${Math.round(meta.originalWidth)}px to ${Math.round(meta.oppositeWidth)}px (difference: ${Math.round(meta.widthDifference)}px).`,
      );
    }

    if (meta.heightDifference > meta.thresholdPx) {
      parts.push(
        `Height issue: Height changed from ${Math.round(meta.originalHeight)}px to ${Math.round(meta.oppositeHeight)}px (difference: ${Math.round(meta.heightDifference)}px).`,
      );
    }

    return {
      ...raw,
      id: crypto.randomUUID(),
      message: parts.join(' '),
      remediation: {
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties',
        suggestion: 'Avoid hardcoded CSS values and use logical CSS properties instead',
      },
    };
  }
}
