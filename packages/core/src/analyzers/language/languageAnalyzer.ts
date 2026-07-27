// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Analyzer, Issue, AnalyzerStrategy } from '../../types/types';
import type { LanguageAnalyzerOptions, LanguageAnalyzerContext } from './types';
import { TextLanguageMismatchStrategy } from './textLanguageMismatchStrategy';
// import { LinkLanguageMismatchStrategy } from './linkLanguageMismatchStrategy';
import { isAnalyzableElement } from '../../utils/isAnalyzableElement';
import { hasDirectTextContent } from '../../utils/hasDirectTextContent';
import { getPageLang } from '../../utils/getPageLang';

/**
 * Default minimum text length for language detection.
 * Shorter strings yield unreliable trigram analysis.
 */
const DEFAULT_MIN_TEXT_LENGTH = 30;

/**
 * Default confidence threshold (0-1).
 * Margin between the best franc result and the first non-family competitor.
 * A value of 0.1 means 10% more similarity than the nearest unrelated language.
 * The family-aware confidence calculation already handles closely related
 * languages (eng/sco, no/nb, sr/hr), so a lower threshold is safe.
 */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.15;

/**
 * CSS selector for elements that can carry visible text.
 * Targets block/inline text containers; excludes script, style, noscript, etc.
 */
const TEXT_ELEMENTS_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, td, th, span, a, label, button, caption, figcaption, blockquote, dt, dd, summary, legend, div, article, section, main, aside, footer, header, nav';

/**
 * LanguageAnalyzer — Detects globalization issues related to language mismatches.
 *
 * Two default strategies:
 * 1. **TextLanguageMismatchStrategy** – flags visible text whose detected language
 *    differs from the declared `lang` attribute.
 * 2. **LinkLanguageMismatchStrategy** – flags same-origin `<a>` links whose URL
 *    embeds a language code that doesn't match the page language.
 */
export class LanguageAnalyzer implements Analyzer {
  public readonly name = 'LanguageAnalyzer';
  private readonly options: Required<LanguageAnalyzerOptions>;
  private readonly strategies: AnalyzerStrategy<LanguageAnalyzerContext>[];

  constructor(
    options?: LanguageAnalyzerOptions,
    strategies?: AnalyzerStrategy<LanguageAnalyzerContext>[],
  ) {
    this.options = {
      minTextLength: options?.minTextLength ?? DEFAULT_MIN_TEXT_LENGTH,
      confidenceThreshold: options?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
    };
    this.strategies = strategies ?? [
      new TextLanguageMismatchStrategy(),
      // TODO: Re-enable once link detection is stabilized
      // new LinkLanguageMismatchStrategy(),
    ];
  }

  async run(rootElement: HTMLElement): Promise<Issue[]> {
    const context = this.buildContext(rootElement);
    const issues: Issue[] = [];

    if (!context.pageLang) {
      issues.push({
        id: crypto.randomUUID(),
        type: 'language-missing-html-lang',
        severity: 'critical',
        elementSelector: 'html',
        message:
          `The <html> element is missing a "lang" attribute. ` +
          `Without a declared language, browsers and assistive technologies may default to English.`,
        remediation: {
          docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang',
          suggestion: `Add a lang attribute to the <html> element, e.g. <html lang="en">`,
        },
      });
      return issues;
    }

    const strategyIssues = await Promise.all(
      this.strategies.map(async (strategy) => strategy.analyze(context)),
    );
    issues.push(...strategyIssues.flat());
    return issues;
  }

  /**
   * Builds the shared context passed to all strategies.
   */
  private buildContext(rootElement: HTMLElement): LanguageAnalyzerContext {
    const elements = this.collectElements(rootElement);
    return {
      rootElement,
      elements,
      options: this.options,
      pageLang: getPageLang(rootElement),
    };
  }

  /**
   * Collects visible elements that carry direct text content.
   * Uses a two-phase approach:
   * 1. CSS selector narrows to text-bearing element types
   * 2. Filters by analyzability (visible, on-screen) and direct text presence
   */
  private collectElements(rootElement: HTMLElement): HTMLElement[] {
    const all = Array.from(rootElement.querySelectorAll<HTMLElement>(TEXT_ELEMENTS_SELECTOR));
    return all.filter((el) => isAnalyzableElement(el) && hasDirectTextContent(el));
  }
}

export default LanguageAnalyzer;
