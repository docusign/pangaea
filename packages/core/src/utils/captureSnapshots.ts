// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { ElementSnapshot } from '../types/types';

/**
 * Captures layout measurements for a set of elements.
 * Records bounding rect and scroll/client dimensions for before/after comparison.
 *
 * @param elements - DOM elements to capture layout measurements for
 * @returns Map from each element to its layout snapshot at the time of capture
 */
export function captureSnapshots(elements: HTMLElement[]): Map<HTMLElement, ElementSnapshot> {
  const snapshots = new Map<HTMLElement, ElementSnapshot>();
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    snapshots.set(el, {
      boundingRect: rect,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    });
  }
  return snapshots;
}
