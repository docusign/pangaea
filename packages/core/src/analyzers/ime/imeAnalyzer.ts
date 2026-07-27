// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Analyzer, Issue, AnalyzerStrategy } from '../../types/types';
import type { IMEAnalyzerOptions, IMEAnalyzerContext } from './types';
import { EventHandlerStrategy } from './eventHandlerStrategy';
import { ReactPropsStrategy } from './reactPropsStrategy';
import { isAnalyzableElement } from '../../utils/isAnalyzableElement';

// Covers text-accepting inputs, textareas, and contenteditable elements
const TEXT_INPUT_ELEMENTS_SELECTOR =
  'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input:not([type]), textarea, [contenteditable="true"], [contenteditable=""]';

/**
 * Detects event handlers on text input elements that may break Input Method
 * Editor (IME) composition for CJK languages.
 *
 * @example
 * const analyzer = new IMEAnalyzer({ getEventListeners });
 * const issues = await analyzer.run(document.body);
 */
export class IMEAnalyzer implements Analyzer {
  public readonly name = 'IMEAnalyzer';
  private readonly options: IMEAnalyzerOptions;
  private readonly strategies: AnalyzerStrategy<IMEAnalyzerContext>[];

  constructor(options: IMEAnalyzerOptions, strategies?: AnalyzerStrategy<IMEAnalyzerContext>[]) {
    this.options = options;
    this.strategies = strategies ?? [new EventHandlerStrategy(), new ReactPropsStrategy()];
  }

  /**
   * Runs all strategies against text-input elements under the given root.
   *
   * @param rootElement - The DOM subtree to analyze
   * @returns Array of IME-related issues found
   */
  async run(rootElement: HTMLElement): Promise<Issue[]> {
    const context = this.buildContext(rootElement);
    const issues = await Promise.all(
      this.strategies.map(async (strategy) => strategy.analyze(context)),
    );
    return issues.flat();
  }

  /**
   * Packages elements, root, and options into a strategy context.
   * @private
   */
  private buildContext(rootElement: HTMLElement): IMEAnalyzerContext {
    const elements = this.collectElements(rootElement);
    return {
      rootElement,
      elements,
      options: this.options,
    };
  }

  /**
   * Collects analyzable text-input and contenteditable elements, filtering
   * by runtime state (visibility, size, position).
   * @private
   */
  private collectElements(rootElement: HTMLElement): HTMLElement[] {
    const allElements = Array.from(
      rootElement.querySelectorAll<HTMLElement>(TEXT_INPUT_ELEMENTS_SELECTOR),
    );
    return allElements.filter((el) => isAnalyzableElement(el));
  }
}

export default IMEAnalyzer;
