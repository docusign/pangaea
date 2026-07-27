// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Analyzer, Issue, AnalyzerStrategy } from '../../types/types';
import type { CollationAnalyzerOptions, CollationAnalyzerContext } from './types';
import { ListSortOrderStrategy } from './listSortOrderStrategy';
import { SelectSortOrderStrategy } from './selectSortOrderStrategy';
import { TableSortOrderStrategy } from './tableSortOrderStrategy';
import { isAnalyzableElement } from '../../utils/isAnalyzableElement';
import { getPageLang } from '../../utils/getPageLang';

const COLLATION_ANALYZABLE_ELEMENTS_SELECTOR = 'ul, ol, table, select';

const DEFAULT_OPTIONS: Required<CollationAnalyzerOptions> = {
  minItemCount: 5,
};

/**
 * Analyzes lists/tables to detect items sorted incorrectly for the page locale.
 *
 * @example
 * const analyzer = new CollationAnalyzer();
 * const issues = await analyzer.run(document.body);
 */
export class CollationAnalyzer implements Analyzer {
  public readonly name = 'CollationAnalyzer';
  private readonly options: Required<CollationAnalyzerOptions>;
  private readonly strategies: AnalyzerStrategy<CollationAnalyzerContext>[];

  constructor(
    options?: CollationAnalyzerOptions,
    strategies?: AnalyzerStrategy<CollationAnalyzerContext>[],
  ) {
    if (options?.minItemCount !== undefined && options.minItemCount < 2) {
      throw new Error('minItemCount must be at least 2');
    }
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.strategies = strategies ?? [
      new ListSortOrderStrategy(),
      new SelectSortOrderStrategy(),
      new TableSortOrderStrategy(),
    ];
  }

  async run(rootElement: HTMLElement): Promise<Issue[]> {
    const context = this.buildContext(rootElement);
    const issues = await Promise.all(
      this.strategies.map(async (strategy) => strategy.analyze(context)),
    );
    return issues.flat();
  }

  private buildContext(rootElement: HTMLElement): CollationAnalyzerContext {
    const elements = this.collectElements(rootElement);
    return {
      rootElement,
      elements,
      options: this.options,
      pageLang: getPageLang(rootElement),
    };
  }

  private collectElements(rootElement: HTMLElement): HTMLElement[] {
    const all = Array.from(
      rootElement.querySelectorAll<HTMLElement>(COLLATION_ANALYZABLE_ELEMENTS_SELECTOR),
    );
    return all.filter((el) => isAnalyzableElement(el));
  }
}
