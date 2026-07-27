// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

const MIN_DIMENSION_PX = 5;

/**
 * Threshold for considering an element "off-page" - elements positioned
 * more than this many pixels outside the document bounds are likely
 * measurement elements or hidden content that shouldn't be analyzed.
 */
const OFF_PAGE_THRESHOLD_PX = 10;

export function isAnalyzableElement(element: HTMLElement): boolean {
  // Skip SVG elements and their children - they don't follow normal layout rules
  if (element instanceof SVGElement || element.closest('svg')) {
    return false;
  }

  const styles = window.getComputedStyle(element);

  if (styles.display === 'none') {
    return false;
  }

  if (styles.visibility === 'hidden' || styles.visibility === 'collapse') {
    return false;
  }

  if (parseFloat(styles.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width < MIN_DIMENSION_PX || rect.height < MIN_DIMENSION_PX) {
    return false;
  }

  // Skip elements positioned far off-page (e.g., measurement spans at top: -20000px)
  // These are typically hidden helper elements that shouldn't be analyzed.
  // Use document coordinates throughout to avoid filtering elements below the fold.
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const docTop = rect.top + scrollY;
  const docLeft = rect.left + scrollX;
  const docHeight = document.documentElement.scrollHeight;
  const docWidth = document.documentElement.scrollWidth;

  if (
    docTop < -OFF_PAGE_THRESHOLD_PX ||
    docLeft < -OFF_PAGE_THRESHOLD_PX ||
    docTop > docHeight + OFF_PAGE_THRESHOLD_PX ||
    docLeft > docWidth + OFF_PAGE_THRESHOLD_PX
  ) {
    return false;
  }

  return true;
}
