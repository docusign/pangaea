// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, AnalyzerStrategy } from '../../types/types';
import type { CollationAnalyzerContext, TableSortOrderRawIssue } from './types';
import { safeFinder } from '../../utils/safeFinder';
import {
  createCollator,
  resolveLocale,
  analyzeSortOrderIntent,
  EXCLUDED_CLASS_PATTERNS,
  MAX_OUT_OF_ORDER_INDICES,
  MAX_ORDER_PREVIEW,
} from './utils';

const MIN_TEXT_COLUMN_RATIO = 0.8;
const NUMERIC_PATTERN = /^-?\d[\d.,]*([eE][+-]?\d+)?$/;

/**
 * Detects `<table>` elements with a text column that appears alphabetically
 * sorted by default JavaScript sort but is not sorted correctly for the locale.
 *
 * Only analyzes tables that have a `<thead>` with column headers. Checks each
 * text-dominant column independently and flags those with locale-incorrect order.
 *
 * @example
 * const strategy = new TableSortOrderStrategy();
 * const issues = strategy.analyze(context);
 */
export class TableSortOrderStrategy implements AnalyzerStrategy<CollationAnalyzerContext> {
  readonly name = 'TableSortOrderStrategy';

  /**
   * Analyzes all table elements in the context and returns collation issues.
   *
   * @param context - The analyzer context containing elements and options
   * @returns Array of issues found in analyzed tables
   */
  analyze(context: CollationAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  /**
   * Iterates over context elements and emits a raw issue for each table column
   * that has an apparent sort order but is not correctly sorted for its locale.
   * @private
   */
  private detect(context: CollationAnalyzerContext): TableSortOrderRawIssue[] {
    const issues: TableSortOrderRawIssue[] = [];
    const { minItemCount } = context.options;

    for (const element of context.elements) {
      try {
        if (this.shouldSkip(element)) continue;

        const rows = Array.from(
          element.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr'),
        );
        if (rows.length < minItemCount) continue;

        const columnCount = this.getColumnCount(rows);
        if (columnCount === 0) continue;

        const locale = resolveLocale(element, context.pageLang);
        const collator = createCollator(locale);

        for (let col = 0; col < columnCount; col++) {
          const texts = this.extractColumnTexts(rows, col);
          if (texts.length < minItemCount) continue;
          if (!this.isTextColumn(texts)) continue;

          const analysis = analyzeSortOrderIntent(texts, collator);
          if (!analysis) continue;

          const headerText = this.getColumnHeader(element, col);

          issues.push({
            type: 'collation-unsorted-table',
            severity: 'minor',
            elementSelector: safeFinder(element),
            issueMetadata: {
              locale,
              columnIndex: col,
              columnHeader: headerText,
              itemCount: texts.length,
              outOfOrderIndices: analysis.outOfOrderIndices.slice(0, MAX_OUT_OF_ORDER_INDICES),
              actualOrder: texts.slice(0, MAX_ORDER_PREVIEW),
              expectedOrder: analysis.expectedOrder.slice(0, MAX_ORDER_PREVIEW),
            },
          });
        }
      } catch (error) {
        console.warn(`[TableSortOrderStrategy] Failed to analyze element:`, error);
        continue;
      }
    }

    return issues;
  }

  /**
   * Returns true for elements that should not be analyzed: non-`<table>` tags,
   * layout tables, tables with role="presentation" or role="grid", and tables
   * whose class names suggest non-data patterns.
   * @private
   */
  private shouldSkip(element: HTMLElement): boolean {
    const tag = element.tagName.toLowerCase();
    if (tag !== 'table') return true;

    // Layout and widget tables are not data tables
    const role = element.getAttribute('role');
    if (role && (role === 'presentation' || role === 'none' || role === 'grid')) return true;

    // Tables without thead are unlikely to be sortable data tables
    if (!element.querySelector('thead')) return true;

    const className = element.className;
    if (typeof className === 'string' && EXCLUDED_CLASS_PATTERNS.test(className)) return true;

    return false;
  }

  /**
   * Returns the number of columns based on cells in the first body row.
   * @private
   */
  private getColumnCount(rows: HTMLTableRowElement[]): number {
    if (rows.length === 0) return 0;
    return rows[0].cells.length;
  }

  /**
   * Extracts trimmed text content for a given column index across all rows.
   * @private
   */
  private extractColumnTexts(rows: HTMLTableRowElement[], colIndex: number): string[] {
    return rows
      .map((row) => {
        const cell = row.cells[colIndex];
        return cell ? (cell.textContent ?? '').trim() : '';
      })
      .filter((t) => t.length > 0);
  }

  /**
   * Returns true if the column is predominantly text (no numeric-only values).
   * A column is considered textual if at least 80% of its values contain
   * non-numeric characters.
   * @private
   */
  private isTextColumn(texts: string[]): boolean {
    const textCount = texts.filter((t) => !NUMERIC_PATTERN.test(t)).length;
    return textCount / texts.length >= MIN_TEXT_COLUMN_RATIO;
  }

  /**
   * Retrieves the header text for a given column index from the table's thead.
   * @private
   */
  private getColumnHeader(table: HTMLElement, colIndex: number): string | null {
    const headerRows = table.querySelectorAll<HTMLTableRowElement>(':scope > thead > tr');
    if (headerRows.length === 0) return null;

    // Use the last header row (leaf headers) to handle multi-row thead layouts.
    const lastHeaderRow = headerRows[headerRows.length - 1];
    const cells = Array.from(lastHeaderRow.cells);

    // Walk cells accounting for colspan to find the cell covering colIndex.
    let mappedIndex = 0;
    for (const cell of cells) {
      const span = cell.colSpan || 1;
      if (colIndex >= mappedIndex && colIndex < mappedIndex + span) {
        return (cell.textContent ?? '').trim() || null;
      }
      mappedIndex += span;
    }
    return null;
  }

  /**
   * Converts a raw issue into a user-facing issue with a message and remediation.
   * @private
   */
  private formatIssue(raw: TableSortOrderRawIssue): Issue {
    const { locale, itemCount, columnIndex, columnHeader, expectedOrder } = raw.issueMetadata;

    const columnLabel = columnHeader ? `"${columnHeader}"` : `at index ${columnIndex}`;

    return {
      ...raw,
      id: crypto.randomUUID(),
      message:
        `Table column ${columnLabel} with ${itemCount} rows is not sorted according to locale "${locale}". ` +
        `Expected order starts with: ${expectedOrder.map((t) => `"${t}"`).join(', ')}.`,
      remediation: {
        docsUrl:
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator',
        suggestion: `Sort table data using Intl.Collator with locale "${locale}" for culturally appropriate ordering.`,
      },
    };
  }
}
