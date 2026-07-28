// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { finder } from '@medv/finder';

/**
 * Generates a unique CSS selector for an element, with a fallback
 * if `@medv/finder` throws (e.g., detached or unusual DOM nodes).
 */
export function safeFinder(element: Element): string {
  try {
    return finder(element);
  } catch {
    return element.tagName?.toLowerCase() ?? 'unknown';
  }
}
