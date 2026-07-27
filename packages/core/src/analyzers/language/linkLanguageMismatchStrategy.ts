// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, RawIssue, AnalyzerStrategy } from '../../types/types';
import type { LanguageAnalyzerContext } from './types';
import { safeFinder } from '../../utils/safeFinder';
import { normalizeLanguageCode } from './languageDetection';
import { isAnalyzableElement } from '../../utils/isAnalyzableElement';

/**
 * Matches a language code in any URL path segment.
 * Covers /fr/about, /page/fr, /content/en-US/about, etc.
 */
const LANG_PATH_SEGMENT_PATTERN = /\/([a-z]{2}(?:-[a-zA-Z]{2,4})?)(?:\/|$)/;

/**
 * Valid ISO 639-1 language codes commonly used in URL paths.
 * Used to filter out false positives like /ip, /qa, /hr (non-language abbreviations).
 */
const VALID_LANG_CODES = new Set([
  'aa',
  'ab',
  'af',
  'am',
  'an',
  'ar',
  'as',
  'ay',
  'az',
  'ba',
  'be',
  'bg',
  'bh',
  'bi',
  'bn',
  'bo',
  'br',
  'bs',
  'ca',
  'ce',
  'co',
  'cs',
  'cy',
  'da',
  'de',
  'dz',
  'ee',
  'el',
  'en',
  'eo',
  'es',
  'et',
  'eu',
  'fa',
  'fi',
  'fj',
  'fo',
  'fr',
  'fy',
  'ga',
  'gd',
  'gl',
  'gn',
  'gu',
  'ha',
  'he',
  'hi',
  'ho',
  'hr',
  'ht',
  'hu',
  'hy',
  'ia',
  'id',
  'ie',
  'ig',
  'ik',
  'io',
  'is',
  'it',
  'iu',
  'ja',
  'jv',
  'ka',
  'ki',
  'kk',
  'kl',
  'km',
  'kn',
  'ko',
  'ks',
  'ku',
  'ky',
  'la',
  'lb',
  'lg',
  'li',
  'ln',
  'lo',
  'lt',
  'lu',
  'lv',
  'mg',
  'mi',
  'mk',
  'ml',
  'mn',
  'mr',
  'ms',
  'mt',
  'my',
  'na',
  'nb',
  'nd',
  'ne',
  'nl',
  'nn',
  'no',
  'nr',
  'ny',
  'oc',
  'om',
  'or',
  'os',
  'pa',
  'pl',
  'ps',
  'pt',
  'qu',
  'rm',
  'rn',
  'ro',
  'ru',
  'rw',
  'sa',
  'sc',
  'sd',
  'se',
  'sg',
  'si',
  'sk',
  'sl',
  'sm',
  'sn',
  'so',
  'sq',
  'sr',
  'ss',
  'st',
  'su',
  'sv',
  'sw',
  'ta',
  'te',
  'tg',
  'th',
  'ti',
  'tk',
  'tl',
  'tn',
  'to',
  'tr',
  'ts',
  'tt',
  'tw',
  'ty',
  'ug',
  'uk',
  'ur',
  'uz',
  've',
  'vi',
  'vo',
  'wa',
  'wo',
  'xh',
  'yi',
  'yo',
  'za',
  'zh',
  'zu',
]);

/**
 * Common language code patterns in subdomains.
 * Matches subdomains like en.example.com, fr.example.com.
 */
const LANG_SUBDOMAIN_PATTERN = /^([a-z]{2}(?:-[a-z]{2})?)\./i;

/**
 * Common query parameter names used for language switching.
 */
const LANG_QUERY_PARAMS = ['lang', 'locale', 'language', 'hl', 'ln'];

/**
 * File extensions and URL patterns to skip (assets, not navigational links).
 */
const SKIP_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|pdf|zip|json|xml)$/i;

/**
 * Strategy that detects links (`<a href>`) pointing to a different language version
 * of the site than the page's declared language.
 *
 * Extracts language signals from:
 * - `hreflang` attribute (authoritative)
 * - URL path prefix (e.g., `/fr/about`)
 * - Subdomain (e.g., `fr.example.com`)
 * - Query parameters (e.g., `?lang=fr`)
 */
export class LinkLanguageMismatchStrategy implements AnalyzerStrategy<LanguageAnalyzerContext> {
  readonly name = 'LinkLanguageMismatchStrategy';
  readonly issueType = 'language-link-mismatch';

  analyze(context: LanguageAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  private detect(context: LanguageAnalyzerContext): RawIssue[] {
    const issues: RawIssue[] = [];
    const pageLang = normalizeLanguageCode(context.pageLang);
    if (!pageLang) return issues;

    const pageOrigin = context.rootElement.ownerDocument.location?.origin ?? '';

    const links = context.rootElement.querySelectorAll<HTMLAnchorElement>('a[href]');

    for (const link of Array.from(links)) {
      // Skip links that are hidden, off-page, or too small to be visible
      if (!isAnalyzableElement(link)) continue;

      const href = link.getAttribute('href') ?? '';

      // Skip non-navigational links
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        continue;
      }

      // Skip asset links
      if (SKIP_EXTENSIONS.test(href)) continue;

      let url: URL;
      try {
        url = new URL(href, pageOrigin);
      } catch {
        continue;
      }

      // Extract language signal from the link
      const linkLang = this.extractLinkLanguage(link, url);
      if (!linkLang) continue; // No language signal in the link

      const normalizedLinkLang = normalizeLanguageCode(linkLang);
      if (normalizedLinkLang === pageLang) continue; // Matches page language

      issues.push({
        type: this.issueType,
        severity: 'minor',
        elementSelector: safeFinder(link),
        issueMetadata: {
          declaredLang: pageLang,
          linkLang: normalizedLinkLang,
          href: url.origin !== pageOrigin ? url.href : url.pathname + url.search,
          linkText: (link.textContent ?? '').trim().substring(0, 60),
        },
      });
    }

    return issues;
  }

  /**
   * Extracts the language signal from a link element, checking in priority order:
   * 1. `hreflang` attribute (authoritative)
   * 2. URL path segment (e.g., /fr/about, /page/fr)
   * 3. Subdomain (e.g., fr.example.com)
   * 4. Query parameter (e.g., ?lang=fr)
   */
  private extractLinkLanguage(link: HTMLAnchorElement, url: URL): string | null {
    // 1. hreflang is authoritative
    const hreflang = link.getAttribute('hreflang');
    if (hreflang) return hreflang;

    // 2. Path segment (any position) — validated against known language codes
    const segmentMatch = url.pathname.match(LANG_PATH_SEGMENT_PATTERN);
    if (segmentMatch) {
      const code = segmentMatch[1].toLowerCase().split('-')[0];
      if (VALID_LANG_CODES.has(code)) return segmentMatch[1];
    }

    // 3. Subdomain
    const host = url.hostname;
    const subdomainMatch = host.match(LANG_SUBDOMAIN_PATTERN);
    if (subdomainMatch) {
      const sub = subdomainMatch[1].toLowerCase();
      // Skip common non-language subdomains and validate against known codes
      if (
        !['www', 'api', 'cdn', 'app', 'dev', 'staging', 'mail', 'ftp'].includes(sub) &&
        VALID_LANG_CODES.has(sub.split('-')[0])
      ) {
        return sub;
      }
    }

    // 4. Query parameter
    for (const param of LANG_QUERY_PARAMS) {
      const value = url.searchParams.get(param);
      if (value && /^[a-z]{2}(-[a-zA-Z]{2,4})?$/i.test(value)) {
        return value;
      }
    }

    return null;
  }

  private formatIssue(raw: RawIssue): Issue {
    const meta = raw.issueMetadata ?? {};
    const declaredLang = meta.declaredLang as string;
    const linkLang = meta.linkLang as string;
    const href = meta.href as string;
    const linkText = meta.linkText as string;

    return {
      ...raw,
      id: crypto.randomUUID(),
      message:
        `Link points to "${linkLang}" content but the page language is "${declaredLang}". ` +
        `href="${href}"` +
        (linkText ? ` (text: "${linkText}")` : ''),
      remediation: {
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#hreflang',
        suggestion:
          `Update the link to point to the "${declaredLang}" version of the page, ` +
          `or add hreflang="${linkLang}" to indicate the link intentionally targets a different language.`,
      },
    };
  }
}
