// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Analyzer, AnalyzerStrategy, Issue } from '../../types/types';
import { SelfOverflowAnalyzerStrategy } from './selfOverflowAnalyzerStrategy';
import { ParentOverflowAnalyzerStrategy } from './parentOverflowAnalyzerStrategy';
import type { LayoutStabilityAnalyzerContext, LayoutStabilityAnalyzerOptions } from './types';
import { isAnalyzableElement } from '../../utils/isAnalyzableElement';
import { isTextNode } from '../../utils/isTextNode';
import { pseudolocalizeText } from '../../utils/pseudolocalizeText';
import { waitForLayout } from '../../utils/waitForLayout';
import { captureSnapshots } from '../../utils/captureSnapshots';

const LAYOUT_STABILITY_ANALYZABLE_ELEMENTS_SELECTOR =
  '*:not(script):not(style):not(meta):not(link):not(head):not(title):not(noscript):not(template):not(br):not(hr):not(svg)';

const DEFAULT_OPTIONS: LayoutStabilityAnalyzerOptions = {
  overflowDeltaPercentThreshold: 5,
  overflowDeltaPixelThreshold: 10,
};

/**
 * Detects layout instability caused by text expansion during localization.
 * Applies ~30% pseudolocalization, captures before/after snapshots, and runs strategies.
 *
 * @example
 * const analyzer = new LayoutStabilityAnalyzer();
 * const issues = await analyzer.run(document.body);
 */
export class LayoutStabilityAnalyzer implements Analyzer {
  readonly name: string = 'LayoutStabilityAnalyzer';
  private readonly options: LayoutStabilityAnalyzerOptions;
  private readonly strategies: AnalyzerStrategy<LayoutStabilityAnalyzerContext>[];

  constructor(
    options: Partial<LayoutStabilityAnalyzerOptions> = {},
    strategies?: AnalyzerStrategy<LayoutStabilityAnalyzerContext>[],
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.strategies = strategies ?? [
      new SelfOverflowAnalyzerStrategy(),
      new ParentOverflowAnalyzerStrategy(),
    ];
  }

  async run(rootElement: HTMLElement): Promise<Issue[]> {
    const context = await this.buildContext(rootElement);
    const issues = await Promise.all(
      this.strategies.map(async (strategy) => strategy.analyze(context)),
    );
    return issues.flat();
  }

  private async buildContext(rootElement: HTMLElement): Promise<LayoutStabilityAnalyzerContext> {
    const elements: HTMLElement[] = this.collectElements(rootElement);
    const beforeSnapshots = captureSnapshots(elements);

    const revertPseudolocalization = this.pseudolocalizeTextNodes(elements);
    await waitForLayout();
    const afterSnapshots = captureSnapshots(elements);
    revertPseudolocalization();

    return {
      rootElement,
      elements,
      afterSnapshots,
      beforeSnapshots,
      options: this.options,
    };
  }

  private collectElements(rootElement: HTMLElement): HTMLElement[] {
    const allElements: HTMLElement[] = [
      rootElement,
      ...Array.from(
        rootElement.querySelectorAll<HTMLElement>(LAYOUT_STABILITY_ANALYZABLE_ELEMENTS_SELECTOR),
      ),
    ];
    return allElements.filter(isAnalyzableElement);
  }

  // Only processes direct text children to avoid double-expanding nested elements
  private pseudolocalizeTextNodes(elements: HTMLElement[]): () => void {
    const originalTexts: Map<Text, string> = new Map();

    for (const el of elements) {
      for (const child of Array.from(el.childNodes)) {
        if (isTextNode(child) && child.textContent?.trim()) {
          const originalText = child.textContent || '';
          child.textContent = pseudolocalizeText(originalText);
          originalTexts.set(child, originalText);
        }
      }
    }

    return () => {
      for (const [node, text] of originalTexts) {
        node.textContent = text;
      }
    };
  }
}
