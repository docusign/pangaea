// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, AnalyzerStrategy } from '../../types/types';
import type { CollationAnalyzerContext, SelectSortOrderRawIssue } from './types';
import { safeFinder } from '../../utils/safeFinder';
import {
  createCollator,
  resolveLocale,
  analyzeSortOrderIntent,
  MAX_OUT_OF_ORDER_INDICES,
  MAX_ORDER_PREVIEW,
} from './utils';

/**
 * Detects `<select>` option lists that appear alphabetically sorted by
 * default JavaScript sort but are not sorted correctly for the locale.
 *
 * @example
 * const strategy = new SelectSortOrderStrategy();
 * const issues = strategy.analyze(context);
 */
export class SelectSortOrderStrategy implements AnalyzerStrategy<CollationAnalyzerContext> {
  readonly name = 'SelectSortOrderStrategy';

  /**
   * Analyzes all select elements in the context and returns collation issues.
   *
   * @param context - The analyzer context containing elements and options
   * @returns Array of issues found in analyzed selects
   */
  analyze(context: CollationAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  /**
   * Iterates over context elements and emits a raw issue for each single-select
   * that has an apparent sort order but is not correctly sorted for its locale.
   * @private
   */
  private detect(context: CollationAnalyzerContext): SelectSortOrderRawIssue[] {
    const issues: SelectSortOrderRawIssue[] = [];
    const { minItemCount } = context.options;

    for (const element of context.elements) {
      try {
        if (this.shouldSkip(element)) continue;

        const options = Array.from(element.querySelectorAll<HTMLOptionElement>(':scope > option'));
        if (options.length < minItemCount) continue;

        const texts = options
          .map((opt) => (opt.textContent ?? '').trim())
          .filter((t) => t.length > 0);
        if (texts.length < minItemCount) continue;

        const locale = resolveLocale(element, context.pageLang);
        const collator = createCollator(locale);
        const analysis = analyzeSortOrderIntent(texts, collator);
        if (!analysis) continue;

        issues.push({
          type: 'collation-unsorted-select',
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
        console.warn(`[SelectSortOrderStrategy] Failed to analyze element:`, error);
        continue;
      }
    }

    return issues;
  }

  /**
   * Returns true for elements that should not be analyzed: non-`<select>` tags,
   * multi-select widgets, and explicit listbox-role widgets.
   * @private
   */
  private shouldSkip(element: HTMLElement): boolean {
    const tag = element.tagName.toLowerCase();
    if (tag !== 'select') return true;

    // Multi-selects and listbox-style widgets often use intentional UI/workflow
    // ordering (pinned/recent/grouped), so alphabetical collation checks are noisy.
    if (element.hasAttribute('multiple')) return true;

    const role = element.getAttribute('role');
    if (role && role.toLowerCase() === 'listbox') return true;

    return false;
  }

  /**
   * Converts a raw issue into a user-facing issue with a message and remediation.
   * @private
   */
  private formatIssue(raw: SelectSortOrderRawIssue): Issue {
    const { locale, itemCount, expectedOrder } = raw.issueMetadata;

    return {
      ...raw,
      id: crypto.randomUUID(),
      message:
        `Select with ${itemCount} options is not sorted according to locale "${locale}". ` +
        `Expected order starts with: ${expectedOrder.map((t) => `"${t}"`).join(', ')}.`,
      remediation: {
        docsUrl:
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator',
        suggestion: `Sort select options using Intl.Collator with locale "${locale}" for culturally appropriate ordering.`,
      },
    };
  }
}
