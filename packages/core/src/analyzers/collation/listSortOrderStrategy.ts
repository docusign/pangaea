// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, AnalyzerStrategy } from '../../types/types';
import type { CollationAnalyzerContext, ListSortOrderRawIssue } from './types';
import { safeFinder } from '../../utils/safeFinder';
import {
  createCollator,
  resolveLocale,
  analyzeSortOrderIntent,
  EXCLUDED_CLASS_PATTERNS,
  MAX_OUT_OF_ORDER_INDICES,
  MAX_ORDER_PREVIEW,
} from './utils';

// Lists below this ratio of plain-text items are skipped as non-textual content
const MIN_TEXT_HOMOGENEITY_RATIO = 0.8;

const EXCLUDED_ROLES = new Set([
  'navigation',
  'menu',
  'menubar',
  'tablist',
  'toolbar',
  'tree',
  'listbox',
]);

/**
 * Detects `<ul>` and `<ol>` elements whose items are not sorted correctly
 * for the detected locale. Accepts both ascending and descending order as
 * valid; flags lists that appear to have an intended sort order but deviate
 * from it.
 *
 * @example
 * const strategy = new ListSortOrderStrategy();
 * const issues = strategy.analyze(context);
 */
export class ListSortOrderStrategy implements AnalyzerStrategy<CollationAnalyzerContext> {
  readonly name = 'ListSortOrderStrategy';

  /**
   * Analyzes all list elements in the context and returns collation issues.
   *
   * @param context - The analyzer context containing elements and options
   * @returns Array of issues found in the analyzed lists
   */
  analyze(context: CollationAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  /**
   * Iterates over context elements and emits a raw issue for each list that
   * has an apparent sort order but is not correctly sorted for its locale.
   * @private
   */
  private detect(context: CollationAnalyzerContext): ListSortOrderRawIssue[] {
    const issues: ListSortOrderRawIssue[] = [];
    const { minItemCount } = context.options;

    for (const element of context.elements) {
      try {
        if (this.shouldSkip(element)) continue;

        const listItems = Array.from(element.querySelectorAll<HTMLElement>(':scope > li'));
        if (listItems.length < minItemCount) continue;

        if (!this.isTextHomogeneous(listItems)) continue;

        const texts = listItems
          .map((li) => (li.textContent ?? '').trim())
          .filter((t) => t.length > 0);

        if (texts.length < minItemCount) continue;

        const locale = resolveLocale(element, context.pageLang);
        const collator = createCollator(locale);
        const analysis = analyzeSortOrderIntent(texts, collator);
        if (!analysis) continue;

        issues.push({
          type: 'collation-unsorted-list',
          severity: 'minor',
          elementSelector: safeFinder(element),
          issueMetadata: {
            locale,
            itemCount: texts.length,
            outOfOrderIndices: analysis.outOfOrderIndices.slice(0, MAX_OUT_OF_ORDER_INDICES),
            actualOrder: texts.slice(0, MAX_ORDER_PREVIEW),
            expectedOrder: analysis.expectedOrder.slice(0, MAX_ORDER_PREVIEW),
          },
        });
      } catch (error) {
        console.warn(`[ListSortOrderStrategy] Failed to analyze element:`, error);
        continue;
      }
    }

    return issues;
  }

  /**
   * Returns true for elements that should not be analyzed: non-list tags,
   * UI widget roles (navigation, menu, tablist…), elements inside `<nav>`,
   * and elements whose class names suggest structural UI patterns.
   * @private
   */
  private shouldSkip(element: HTMLElement): boolean {
    const tag = element.tagName.toLowerCase();
    if (tag !== 'ul' && tag !== 'ol') return true;

    const role = element.getAttribute('role');
    if (role && EXCLUDED_ROLES.has(role.toLowerCase())) return true;

    if (element.closest('nav')) return true;

    const className = element.className;
    if (typeof className === 'string' && EXCLUDED_CLASS_PATTERNS.test(className)) return true;

    let ancestor: HTMLElement | null = element.parentElement;
    let depth = 0;
    while (ancestor && depth < 10) {
      const ancestorClass = ancestor.className;
      if (typeof ancestorClass === 'string' && EXCLUDED_CLASS_PATTERNS.test(ancestorClass)) {
        return true;
      }
      ancestor = ancestor.parentElement;
      depth++;
    }

    return false;
  }

  /**
   * Returns true if at least {@link MIN_TEXT_HOMOGENEITY_RATIO} of items
   * contain only text (no images, videos, or nested lists). Mixed-content
   * lists are skipped as their items are not reliably comparable by text.
   * @private
   */
  private isTextHomogeneous(listItems: HTMLElement[]): boolean {
    let textOnlyCount = 0;
    for (const li of listItems) {
      const hasComplexChildren = li.querySelector('img, svg, ul, ol, table, video, canvas, iframe');
      if (!hasComplexChildren) {
        textOnlyCount++;
      }
    }
    return textOnlyCount / listItems.length >= MIN_TEXT_HOMOGENEITY_RATIO;
  }

  /**
   * Converts a raw issue into a user-facing issue with a message and remediation.
   * @private
   */
  private formatIssue(raw: ListSortOrderRawIssue): Issue {
    const { locale, itemCount, expectedOrder } = raw.issueMetadata;

    return {
      ...raw,
      id: crypto.randomUUID(),
      message:
        `List with ${itemCount} items is not sorted according to locale "${locale}". ` +
        `Expected order starts with: ${expectedOrder.map((t) => `"${t}"`).join(', ')}.`,
      remediation: {
        docsUrl:
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator',
        suggestion: `Sort list items using Intl.Collator with locale "${locale}" for culturally appropriate ordering.`,
      },
    };
  }
}
