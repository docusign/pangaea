// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, RawIssue, AnalyzerStrategy } from '../../types/types';
import type { LanguageAnalyzerContext } from './types';
import { safeFinder } from '../../utils/safeFinder';
import {
  detectLanguage,
  getEffectiveLanguage,
  isLanguageMatch,
  isSameScript,
} from './languageDetection';

/**
 * When direct text is shorter than this, try the element's full textContent
 * (including children) for a more reliable detection sample.
 */
const SHORT_TEXT_FALLBACK_THRESHOLD = 80;

/**
 * Maximum confidence multiplier for same-script language pairs (e.g. en↔fr, es↔pt).
 * franc-min shares many trigrams between Latin-script languages, making short-text
 * detection unreliable. We require up to 3× the normal confidence threshold to flag
 * same-script mismatches, reducing false positives like "en flagged as fr".
 *
 * The actual multiplier graduates from this value (for short text at minTextLength)
 * down to 1× (for text at or above SAME_SCRIPT_RELIABLE_LENGTH), because franc
 * becomes more reliable with longer text samples.
 */
const SAME_SCRIPT_MAX_MULTIPLIER = 3;

/**
 * Text length (in characters) at which franc is reliable enough to detect
 * same-script language mismatches without an elevated confidence threshold.
 * Below this length, the same-script multiplier is graduated between
 * SAME_SCRIPT_MAX_MULTIPLIER (at minTextLength) and 1× (at this length).
 */
const SAME_SCRIPT_RELIABLE_LENGTH = 100;

/**
 * Strategy that detects visible text content whose language doesn't match
 * the page's declared `lang` attribute or the nearest ancestor `lang` attribute.
 *
 * Uses franc trigram analysis for language detection with configurable
 * minimum text length and confidence thresholds.
 */
export class TextLanguageMismatchStrategy implements AnalyzerStrategy<LanguageAnalyzerContext> {
  readonly name = 'TextLanguageMismatchStrategy';
  readonly issueType = 'language-text-mismatch';

  analyze(context: LanguageAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  /**
   * Collects direct text from an element's own text nodes (not children).
   */
  private getDirectText(element: HTMLElement): string {
    let text = '';
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent) {
        text += child.textContent;
      }
    }
    return text.trim();
  }

  private detect(context: LanguageAnalyzerContext): RawIssue[] {
    const issues: RawIssue[] = [];
    const { minTextLength, confidenceThreshold } = context.options;

    for (const element of context.elements) {
      const directText = this.getDirectText(element);
      if (directText.length < minTextLength) continue;

      // Resolve the effective declared language for this element
      const effectiveLang = getEffectiveLanguage(element) || context.pageLang;
      if (!effectiveLang) continue; // No lang declared anywhere — nothing to compare against

      // First try detection on direct text only
      let detection = detectLanguage(directText, minTextLength);
      let analyzedTextLength = directText.length;

      // For short direct text: if detection is uncertain or undetermined,
      // fall back to full textContent (including children) for a better sample.
      if (
        directText.length < SHORT_TEXT_FALLBACK_THRESHOLD &&
        (detection.lang === 'und' || detection.confidence < confidenceThreshold)
      ) {
        const fullText = (element.textContent ?? '').trim();
        if (fullText.length > directText.length) {
          detection = detectLanguage(fullText, minTextLength);
          analyzedTextLength = fullText.length;
        }
      }

      if (detection.lang === 'und') continue;

      // Same-script pairs (e.g. en↔fr, es↔pt) need higher confidence because
      // franc shares many trigrams between Latin-script languages.
      // The multiplier graduates from SAME_SCRIPT_MAX_MULTIPLIER (for short text)
      // down to 1× (for text >= SAME_SCRIPT_RELIABLE_LENGTH), because franc
      // becomes much more accurate with longer text samples.
      let effectiveThreshold = confidenceThreshold;
      if (isSameScript(effectiveLang, detection.lang)) {
        const scaleFactor = Math.min(
          1,
          Math.max(
            0,
            (analyzedTextLength - minTextLength) / (SAME_SCRIPT_RELIABLE_LENGTH - minTextLength),
          ),
        );
        const multiplier =
          SAME_SCRIPT_MAX_MULTIPLIER - (SAME_SCRIPT_MAX_MULTIPLIER - 1) * scaleFactor;
        effectiveThreshold *= multiplier;
      }

      // Top-2 consensus: if confidence is low but BOTH top guesses disagree
      // with the declared language, the text is clearly not in the right language.
      // For cross-script cases (e.g. Latin text on a Japanese page), even very low
      // confidence consensus is reliable. For same-script pairs, consensus is
      // disabled entirely since both guesses could be wrong Latin-script languages.
      const confidentEnough = detection.confidence >= effectiveThreshold;
      const top2Consensus =
        !confidentEnough &&
        !isSameScript(effectiveLang, detection.lang) &&
        !isLanguageMatch(effectiveLang, detection.lang) &&
        detection.secondLang !== 'und' &&
        !isLanguageMatch(effectiveLang, detection.secondLang);

      if (!confidentEnough && !top2Consensus) continue;

      if (!isLanguageMatch(effectiveLang, detection.lang)) {
        issues.push({
          type: this.issueType,
          severity: 'moderate',
          elementSelector: safeFinder(element),
          issueMetadata: {
            declaredLang: effectiveLang,
            detectedLang: detection.lang,
            textSnippet: directText.substring(0, 80),
          },
        });
      }
    }

    return issues;
  }

  private formatIssue(raw: RawIssue): Issue {
    const meta = raw.issueMetadata ?? {};
    const declaredLang = meta.declaredLang as string;
    const detectedLang = meta.detectedLang as string;
    const textSnippet = meta.textSnippet as string;

    return {
      ...raw,
      id: crypto.randomUUID(),
      message:
        `Text appears to be in "${detectedLang}" ` +
        `but the declared language is "${declaredLang}". ` +
        `Snippet: "${textSnippet}${textSnippet.length >= 80 ? '…' : ''}"`,
      remediation: {
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang',
        suggestion:
          `Ensure the text is translated to "${declaredLang}", ` +
          `or wrap it in a <span lang="${detectedLang}"> to declare the correct language.`,
      },
    };
  }
}
