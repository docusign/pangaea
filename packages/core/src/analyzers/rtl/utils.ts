// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { hasDirectTextContent } from '../../utils/hasDirectTextContent';

/**
 * Computes the adaptive asymmetry threshold for an element.
 * Scales with element width (percentage) but enforces a pixel floor
 * so small elements don't get imperceptibly tiny thresholds.
 *
 * @param elementWidth - Width of the element in pixels
 * @param percentThreshold - Threshold as a percentage of element width
 * @param pxFloor - Minimum threshold in pixels regardless of element size
 * @returns Threshold value in pixels (the greater of percentage-based or floor)
 */
export function computeAsymmetryThreshold(
  elementWidth: number,
  percentThreshold: number,
  pxFloor: number,
): number {
  return Math.max((elementWidth * percentThreshold) / 100, pxFloor);
}

/**
 * Measures how far an element's mirrored position deviates from the expected position.
 * In a correct RTL layout, distance-from-right (LTR) should equal distance-from-left (RTL).
 *
 * @param containerWidth - Width of the parent container in pixels
 * @param beforeRight - Element's right edge position in LTR layout
 * @param afterLeft - Element's left edge position in RTL layout
 * @returns Drift in pixels; 0 for a perfectly mirrored element
 */
export function computeMirrorPositionDrift(
  containerWidth: number,
  beforeRight: number,
  afterLeft: number,
): number {
  const distanceFromRight = containerWidth - beforeRight;
  return Math.abs(distanceFromRight - afterLeft);
}

/**
 * Determines whether a child element's position shift is merely inherited from its parent
 * rather than being its own layout issue.
 *
 * @param childDrift - Drift measured for the child element in pixels
 * @param parentDrift - Drift measured for the nearest tracked ancestor, or undefined if none found
 * @param tolerance - Maximum allowed difference between child and parent drift
 * @returns True when the child's drift matches the ancestor's drift within tolerance
 */
export function isShiftInheritedFromParent(
  childDrift: number,
  parentDrift: number | undefined,
  tolerance: number,
): boolean {
  return parentDrift !== undefined && Math.abs(childDrift - parentDrift) < tolerance;
}

/**
 * Walks up the DOM tree to find the drift of the nearest ancestor that was tracked.
 * Handles gaps where intermediate elements were filtered out by isAnalyzableElement.
 *
 * @param element - The element whose ancestor drift we want to find
 * @param elementDrifts - Map of tracked elements to their measured drift values
 * @returns Drift of the nearest tracked ancestor, or undefined if none found
 */
export function findNearestTrackedAncestorDrift(
  element: HTMLElement,
  elementDrifts: Map<HTMLElement, number>,
): number | undefined {
  let ancestor = element.parentElement;
  while (ancestor) {
    const drift = elementDrifts.get(ancestor);
    if (drift !== undefined) return drift;
    ancestor = ancestor.parentElement;
  }
  return undefined;
}

/**
 * Determines whether an inline element should be skipped during mirroring analysis.
 * Inline elements inside a parent with direct text content flow with BIDI text
 * reordering and don't need independent mirroring checks.
 *
 * @param element - The element to evaluate
 * @param computedDisplay - The element's computed display value
 * @returns True when the element is inline and its parent has direct text content
 */
export function shouldSkipInlineElement(element: HTMLElement, computedDisplay: string): boolean {
  return (
    computedDisplay.startsWith('inline') &&
    !!element.parentElement &&
    hasDirectTextContent(element.parentElement)
  );
}
