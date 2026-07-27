// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import {
  createCollator,
  resolveLocale,
  isSorted,
  getOutOfOrderIndices,
  isDefaultSorted,
  analyzeSortOrderIntent,
} from './utils';

describe('collationUtils', () => {
  describe('createCollator', () => {
    it('should create a collator with the given locale', () => {
      const collator = createCollator('en');
      expect(collator).toBeInstanceOf(Intl.Collator);
    });

    it('should use numeric collation', () => {
      const collator = createCollator('en');
      expect(collator.compare('item2', 'item10')).toBeLessThan(0);
    });

    it('should sort German umlauts correctly', () => {
      const collator = createCollator('de');
      // In German, ä sorts near a
      expect(collator.compare('ä', 'b')).toBeLessThan(0);
    });

    it('should sort Swedish ö after z', () => {
      const collator = createCollator('sv');
      // In Swedish, ö is a separate letter that comes after z
      expect(collator.compare('ö', 'z')).toBeGreaterThan(0);
    });
  });

  describe('resolveLocale', () => {
    it('should return element lang attribute when present', () => {
      const el = document.createElement('div');
      el.setAttribute('lang', 'de');
      document.body.appendChild(el);
      expect(resolveLocale(el, 'en')).toBe('de');
      document.body.removeChild(el);
    });

    it('should fall back to pageLang', () => {
      const el = document.createElement('div');
      expect(resolveLocale(el, 'fr')).toBe('fr');
    });

    it('should fall back to en when nothing is available', () => {
      const el = document.createElement('div');
      expect(resolveLocale(el, '')).toBe('en');
    });
  });

  describe('isSorted', () => {
    it('should return true for ascending sorted items', () => {
      const collator = createCollator('en');
      expect(isSorted(['apple', 'banana', 'cherry'], collator, 'asc')).toBe(true);
    });

    it('should return false for unsorted items (ascending)', () => {
      const collator = createCollator('en');
      expect(isSorted(['banana', 'apple', 'cherry'], collator, 'asc')).toBe(false);
    });

    it('should return true for descending sorted items', () => {
      const collator = createCollator('en');
      expect(isSorted(['cherry', 'banana', 'apple'], collator, 'desc')).toBe(true);
    });

    it('should return false for unsorted items (descending)', () => {
      const collator = createCollator('en');
      expect(isSorted(['cherry', 'apple', 'banana'], collator, 'desc')).toBe(false);
    });

    it('should handle single item', () => {
      const collator = createCollator('en');
      expect(isSorted(['apple'], collator, 'asc')).toBe(true);
    });

    it('should handle empty array', () => {
      const collator = createCollator('en');
      expect(isSorted([], collator, 'asc')).toBe(true);
    });
  });

  describe('getOutOfOrderIndices', () => {
    it('should return empty for sorted items', () => {
      const collator = createCollator('en');
      expect(getOutOfOrderIndices(['a', 'b', 'c'], collator, 'asc')).toEqual([]);
    });

    it('should return indices of items that differ from sorted order', () => {
      const collator = createCollator('en');
      const indices = getOutOfOrderIndices(['b', 'a', 'c'], collator, 'asc');
      expect(indices).toContain(0);
      expect(indices).toContain(1);
      expect(indices).not.toContain(2);
    });

    it('should return empty for descending sorted items', () => {
      const collator = createCollator('en');
      expect(getOutOfOrderIndices(['c', 'b', 'a'], collator, 'desc')).toEqual([]);
    });
  });

  describe('isDefaultSorted', () => {
    it('should return true for ascending default-sorted items', () => {
      expect(isDefaultSorted(['apple', 'banana', 'cherry'], 'asc')).toBe(true);
    });

    it('should return false for unsorted items (ascending)', () => {
      expect(isDefaultSorted(['banana', 'apple', 'cherry'], 'asc')).toBe(false);
    });

    it('should return true for descending default-sorted items', () => {
      expect(isDefaultSorted(['cherry', 'banana', 'apple'], 'desc')).toBe(true);
    });

    it('should return false for unsorted items (descending)', () => {
      expect(isDefaultSorted(['apple', 'banana', 'cherry'], 'desc')).toBe(false);
    });

    it('should use lexicographic order, not numeric', () => {
      // Default sort is lexicographic: file10 comes before file2
      expect(isDefaultSorted(['file1', 'file10', 'file2', 'file3', 'file4'], 'asc')).toBe(true);
    });

    it('should handle single item', () => {
      expect(isDefaultSorted(['apple'], 'asc')).toBe(true);
    });

    it('should handle empty array', () => {
      expect(isDefaultSorted([], 'asc')).toBe(true);
    });
  });

  describe('analyzeSortOrderIntent', () => {
    it('should return null when items are already locale sorted', () => {
      const collator = createCollator('en');
      const result = analyzeSortOrderIntent(['apple', 'banana', 'cherry'], collator);
      expect(result).toBeNull();
    });

    it('should return null when no default-sort intent is detected', () => {
      const collator = createCollator('en');
      const result = analyzeSortOrderIntent(
        ['zebra', 'apple', 'mango', 'banana', 'kiwi'],
        collator,
      );
      expect(result).toBeNull();
    });

    it('should return analysis when default sort differs from locale sort', () => {
      const collator = createCollator('en');
      const result = analyzeSortOrderIntent(
        ['file1', 'file10', 'file2', 'file3', 'file4'],
        collator,
      );

      expect(result).not.toBeNull();
      expect(result?.intendedDirection).toBe('asc');
      expect(result?.outOfOrderIndices.length).toBeGreaterThan(0);
      expect(result?.expectedOrder).toEqual(['file1', 'file2', 'file3', 'file4', 'file10']);
    });
  });
});
