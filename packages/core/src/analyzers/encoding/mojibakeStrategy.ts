// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, AnalyzerStrategy } from '../../types/types';
import { safeFinder } from '../../utils/safeFinder';
import {
  MOJIBAKE,
  MOJIBAKE_UTF8_AS_WIN1252,
  MOJIBAKE_UTF8_AS_SHIFTJIS,
  MOJIBAKE_UTF8_AS_EUCJP,
} from '../mojibake-patterns';
import type { EncodingAnalyzerContext } from './types';

const MOJIBAKE_PERCENTAGE_THRESHOLD = 15;

const SKIP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'path',
  'meta',
  'link',
]);

const TEXT_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'a',
  'button',
  'label',
  'li',
  'td',
  'th',
  'dt',
  'dd',
  'blockquote',
  'pre',
  'code',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'small',
  'mark',
  'cite',
  'q',
  'abbr',
  'figcaption',
  'caption',
  'legend',
  'summary',
  'article',
  'section',
  'header',
  'footer',
  'nav',
  'aside',
  'main',
  'address',
  'time',
]);

/**
 * Detects mojibake (garbled text from encoding mismatch) using n-gram dictionaries.
 */
export class MojibakeStrategy implements AnalyzerStrategy<EncodingAnalyzerContext> {
  readonly name = 'MojibakeStrategy';

  analyze(context: EncodingAnalyzerContext): Issue[] {
    const body = context.document.body;
    if (!body) return [];

    const text = body.innerText || '';
    if (!text) return [];

    if (!this.detectMojibakeByNGrams(text, context.mojibakeDetectionThreshold)) return [];

    const mojibakeSelectors = this.findMojibakeElementSelectors(
      body,
      context.mojibakeDetectionThreshold,
    );

    return [
      {
        id: crypto.randomUUID(),
        type: 'encoding-mojibake',
        severity: 'critical',
        message: `A significant amount of mojibake characters detected. The text appears to have incorrect character encoding.`,
        elementSelector: 'body',
        issueMetadata: { mojibakeSelectors },
        remediation: {
          docsUrl: 'https://en.wikipedia.org/wiki/Mojibake',
          suggestion: `Ensure the document encoding declaration matches the actual encoding of the content.`,
        },
      },
    ];
  }

  private detectMojibakeByNGrams(text: string, threshold: number): boolean {
    const dictionaries = [
      MOJIBAKE_UTF8_AS_WIN1252,
      MOJIBAKE_UTF8_AS_SHIFTJIS,
      MOJIBAKE_UTF8_AS_EUCJP,
      MOJIBAKE,
    ];

    let totalMojibakeChars = 0;

    for (const dictionary of dictionaries) {
      for (const pattern of dictionary.threeGrams) {
        totalMojibakeChars += this.countOccurrences(text, pattern.ngram) * pattern.ngram.length;
      }
      for (const pattern of dictionary.twoGrams) {
        totalMojibakeChars += this.countOccurrences(text, pattern.ngram) * pattern.ngram.length;
      }
      for (const pattern of dictionary.oneGrams) {
        totalMojibakeChars += this.countOccurrences(text, pattern.ngram) * pattern.ngram.length;
      }
    }

    if (totalMojibakeChars < threshold) return false;

    const mojibakePercentage = text.length > 0 ? (totalMojibakeChars / (text.length * 3)) * 100 : 0;
    return mojibakePercentage >= MOJIBAKE_PERCENTAGE_THRESHOLD;
  }

  private findMojibakeElementSelectors(rootElement: Element, threshold: number): string[] {
    const selectors: string[] = [];
    const processedTexts = new Set<string>();

    const processElement = (element: Element): void => {
      const tagName = element.tagName?.toLowerCase();
      if (!tagName || SKIP_TAGS.has(tagName)) return;

      if (TEXT_TAGS.has(tagName)) {
        let directText = '';
        for (const child of Array.from(element.childNodes)) {
          if (child.nodeType === 3) {
            // 3 = TEXT_NODE
            directText += child.textContent ?? '';
          }
        }
        directText = directText.trim();

        if (
          directText.length >= 8 &&
          !processedTexts.has(directText) &&
          this.detectMojibakeByNGrams(directText, threshold)
        ) {
          processedTexts.add(directText);
          selectors.push(safeFinder(element));
        }
      }

      for (const child of Array.from(element.children)) {
        processElement(child);
      }
    };

    processElement(rootElement);
    return selectors;
  }

  private countOccurrences(text: string, ngram: string): number {
    let count = 0;
    let index = 0;
    while ((index = text.indexOf(ngram, index)) !== -1) {
      count++;
      index++;
    }
    return count;
  }
}
