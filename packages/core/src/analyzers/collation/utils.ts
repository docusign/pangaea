// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { getEffectiveLanguage } from '../language/languageDetection';
import type { SortDirection, SortOrderAnalysis } from './types';

// Cap metadata arrays to avoid bloating issue reports on large lists/tables
export const MAX_OUT_OF_ORDER_INDICES = 10;
export const MAX_ORDER_PREVIEW = 5;

export const EXCLUDED_CLASS_PATTERNS =
  /(nav|menu|breadcrumb|tabs?|pagination|steps?|timeline|social|footer|header|toolbar|calendar|schedule|layout)/i;

const collatorCache = new Map<string, Intl.Collator>();

/**
 * Returns a locale-aware collator configured for deterministic sort checks.
 * Instances are cached per locale to avoid repeated construction.
 *
 * @param locale - BCP 47 locale to use for collation comparisons
 * @returns Configured Intl.Collator instance
 */
export function createCollator(locale: string): Intl.Collator {
  const cached = collatorCache.get(locale);
  if (cached) return cached;

  const collator = new Intl.Collator(locale, {
    sensitivity: 'variant',
    numeric: true,
    usage: 'sort',
    ignorePunctuation: false,
  });
  collatorCache.set(locale, collator);
  return collator;
}

/**
 * Resolves the effective locale for an element, falling back to page language
 * and then to English.
 *
 * @param element - Element whose effective language should be resolved
 * @param pageLang - Page-level fallback language
 * @returns Resolved locale string
 */
export function resolveLocale(element: HTMLElement, pageLang: string): string {
  const effectiveLang = getEffectiveLanguage(element);
  return effectiveLang || pageLang || 'en';
}

/**
 * Checks whether items are sorted according to a locale collator and direction.
 *
 * @param items - Text items to validate
 * @param collator - Locale-aware collator
 * @param direction - Expected sort direction
 * @returns True when sequence is sorted in the requested direction
 */
export function isSorted(
  items: string[],
  collator: Intl.Collator,
  direction: SortDirection,
): boolean {
  for (let i = 1; i < items.length; i++) {
    const cmp = collator.compare(items[i - 1], items[i]);
    if (direction === 'asc' && cmp > 0) return false;
    if (direction === 'desc' && cmp < 0) return false;
  }
  return true;
}

/**
 * Returns indices whose values do not match the locale-sorted sequence.
 *
 * @param items - Original text items
 * @param collator - Locale-aware collator
 * @param direction - Sort direction used to compute expected order
 * @returns Zero-based indices of out-of-order entries
 */
export function getOutOfOrderIndices(
  items: string[],
  collator: Intl.Collator,
  direction: SortDirection,
): number[] {
  const sorted = [...items].sort((a, b) => {
    const cmp = collator.compare(a, b);
    return direction === 'asc' ? cmp : -cmp;
  });

  const indices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i] !== sorted[i]) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Checks whether items match default JavaScript string sort order.
 *
 * @param items - Text items to validate
 * @param direction - Expected default sort direction
 * @returns True when items match Array.prototype.sort() order for direction
 */
export function isDefaultSorted(items: string[], direction: SortDirection): boolean {
  const sorted = [...items].sort();
  if (direction === 'desc') sorted.reverse();
  return items.every((item, i) => item === sorted[i]);
}

/**
 * Evaluates whether a sequence appears intentionally sorted by default
 * JavaScript ordering but is not sorted by locale-aware collation.
 *
 * Returns `null` when the sequence is already locale-sorted or when there is
 * no default-sort intent. Otherwise returns the intended direction and details
 * needed for issue metadata.
 *
 * @param items - Original text items to analyze
 * @param collator - Locale-aware collator used for expected ordering
 * @returns Sort analysis details when mismatch should be flagged; otherwise null
 */
export function analyzeSortOrderIntent(
  items: string[],
  collator: Intl.Collator,
): SortOrderAnalysis | null {
  if (isSorted(items, collator, 'asc') || isSorted(items, collator, 'desc')) {
    return null;
  }

  const defaultAsc = isDefaultSorted(items, 'asc');
  const defaultDesc = isDefaultSorted(items, 'desc');
  if (!defaultAsc && !defaultDesc) {
    return null;
  }

  const intendedDirection: SortDirection = defaultAsc ? 'asc' : 'desc';
  const outOfOrderIndices = getOutOfOrderIndices(items, collator, intendedDirection);
  const expectedOrder = [...items].sort((a, b) =>
    intendedDirection === 'asc' ? collator.compare(a, b) : collator.compare(b, a),
  );

  return {
    intendedDirection,
    outOfOrderIndices,
    expectedOrder,
  };
}
