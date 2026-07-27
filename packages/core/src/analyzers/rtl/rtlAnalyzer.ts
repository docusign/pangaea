// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { isAnalyzableElement } from '../../utils/isAnalyzableElement';
import { waitForLayout } from '../../utils/waitForLayout';
import { captureSnapshots } from '../../utils/captureSnapshots';
import type { Analyzer, AnalyzerStrategy, ElementSnapshot, Issue } from '../../types/types';
import type { RTLAnalyzerContext, RTLAnalyzerOptions } from './types';
import { MirroringStrategy } from './mirroringStrategy';

// Excludes structural/non-visual elements that can't have layout asymmetry
const RTL_ANALYZABLE_ELEMENTS_SELECTOR =
  '*:not(html):not(body):not(script):not(style):not(meta):not(link):not(head):not(title):not(noscript):not(template):not(br):not(hr):not(svg)';

const DEFAULT_OPTIONS: Required<RTLAnalyzerOptions> = {
  asymmetryThresholdPercent: 15,
  asymmetryThresholdPx: 20,
};

/**
 * Detects elements that don't mirror correctly when page direction flips between LTR and RTL.
 *
 * @example
 * const analyzer = new RTLAnalyzer();
 * const issues = await analyzer.run(document.documentElement);
 */
export class RTLAnalyzer implements Analyzer {
  readonly name: string = 'RTLAnalyzer';
  private readonly options: Required<RTLAnalyzerOptions>;
  private readonly strategies: AnalyzerStrategy<RTLAnalyzerContext>[];

  constructor(
    options: Partial<RTLAnalyzerOptions> = {},
    strategies?: AnalyzerStrategy<RTLAnalyzerContext>[],
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.strategies = strategies ?? [new MirroringStrategy()];
  }

  async run(rootElement: HTMLElement): Promise<Issue[]> {
    const context = await this.buildContext(rootElement);
    const issues = await Promise.all(
      this.strategies.map(async (strategy) => strategy.analyze(context)),
    );
    return issues.flat();
  }

  private async buildContext(rootElement: HTMLElement): Promise<RTLAnalyzerContext> {
    const elements = this.collectElements(rootElement);

    const beforeSnapshots = captureSnapshots(elements);

    const computedDirection = getComputedStyle(rootElement).direction;
    const targetDir = computedDirection === 'rtl' ? 'ltr' : 'rtl';

    const revertDirection = this.flipDirection(rootElement);
    let afterSnapshots: Map<HTMLElement, ElementSnapshot>;
    try {
      await waitForLayout();
      afterSnapshots = captureSnapshots(elements);
    } finally {
      revertDirection();
    }

    return {
      rootElement,
      elements,
      options: this.options,
      targetDir,
      beforeSnapshots,
      afterSnapshots,
    };
  }

  private flipDirection(element: HTMLElement): () => void {
    const computedDirection = getComputedStyle(element).direction;
    const originalInlineDirection = element.style.direction;
    element.style.direction = computedDirection === 'rtl' ? 'ltr' : 'rtl';

    return () => {
      element.style.direction = originalInlineDirection;
    };
  }

  private collectElements(rootElement: HTMLElement): HTMLElement[] {
    const all = Array.from(
      rootElement.querySelectorAll<HTMLElement>(RTL_ANALYZABLE_ELEMENTS_SELECTOR),
    );
    return all.filter((el) => isAnalyzableElement(el));
  }
}
