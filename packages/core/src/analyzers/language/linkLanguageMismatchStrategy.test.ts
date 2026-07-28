// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LinkLanguageMismatchStrategy } from './linkLanguageMismatchStrategy';
import type { LanguageAnalyzerContext, LanguageAnalyzerOptions } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

vi.mock('../../utils/isAnalyzableElement', () => ({
  isAnalyzableElement: vi.fn().mockReturnValue(true),
}));

import { isAnalyzableElement } from '../../utils/isAnalyzableElement';
const mockIsAnalyzableElement = vi.mocked(isAnalyzableElement);

const DEFAULT_OPTIONS: Required<LanguageAnalyzerOptions> = {
  minTextLength: 20,
  confidenceThreshold: 0.1,
};

function createContext(
  rootElement: HTMLElement,
  pageLang = 'en',
  optionOverrides?: Partial<LanguageAnalyzerOptions>,
): LanguageAnalyzerContext {
  return {
    rootElement,
    elements: [],
    pageLang,
    options: { ...DEFAULT_OPTIONS, ...optionOverrides },
  };
}

/**
 * Helper: set document.location.origin in happy-dom.
 * We create links relative to it, so we need a predictable origin.
 */
function createLink(href: string, text?: string, hreflang?: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  if (text) a.textContent = text;
  if (hreflang) a.setAttribute('hreflang', hreflang);
  return a;
}

describe('LinkLanguageMismatchStrategy', () => {
  const strategy = new LinkLanguageMismatchStrategy();
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockIsAnalyzableElement.mockReturnValue(true);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('should have the correct name', () => {
    expect(strategy.name).toBe('LinkLanguageMismatchStrategy');
  });

  it('should return no issues when page lang is not set', () => {
    container.appendChild(createLink('/fr/about', 'About'));
    const issues = strategy.analyze(createContext(container, ''));
    expect(issues).toHaveLength(0);
  });

  it('should flag a link with a path prefix that mismatches page lang', () => {
    container.appendChild(createLink('/fr/about', 'About in French'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('language-link-mismatch');
    expect(issues[0].severity).toBe('minor');
    expect(issues[0].issueMetadata?.linkLang).toBe('fr');
  });

  it('should not flag a link matching the page language', () => {
    container.appendChild(createLink('/en/about', 'About'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should detect language from hreflang attribute', () => {
    const link = createLink('/some-page', 'Page', 'de');
    container.appendChild(link);

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.linkLang).toBe('de');
  });

  it('should not flag hreflang that matches page lang', () => {
    const link = createLink('/some-page', 'Page', 'en');
    container.appendChild(link);

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should detect language from query parameter', () => {
    container.appendChild(createLink('/page?lang=fr', 'French page'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.linkLang).toBe('fr');
  });

  it('should detect language from any path segment', () => {
    container.appendChild(createLink('/page/fr', 'French page'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.linkLang).toBe('fr');
  });

  it('should not flag path segment matching page language', () => {
    container.appendChild(createLink('/page/en', 'English page'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should detect hl query parameter', () => {
    container.appendChild(createLink('/page?hl=ja', 'Japanese page'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.linkLang).toBe('ja');
  });

  it('should skip fragment-only links', () => {
    container.appendChild(createLink('#section', 'Section'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should skip mailto links', () => {
    container.appendChild(createLink('mailto:test@example.com', 'Email'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should skip javascript: links', () => {
    container.appendChild(createLink('javascript:void(0)', 'Click'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should skip asset links', () => {
    container.appendChild(createLink('/fr/styles.css', 'Styles'));
    container.appendChild(createLink('/fr/image.png', 'Image'));
    container.appendChild(createLink('/fr/script.js', 'Script'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should flag cross-origin links with language signals', () => {
    container.appendChild(createLink('https://fr.example.com/page', 'French subdomain'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.linkLang).toBe('fr');
  });

  it('should not flag cross-origin links without language signals', () => {
    container.appendChild(createLink('https://other-domain.com/page', 'External'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should not flag a link without language signals', () => {
    container.appendChild(createLink('/about', 'About page'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should format the issue with message and remediation', () => {
    container.appendChild(createLink('/fr/about', 'About'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBeDefined();
    expect(issues[0].message).toContain('fr');
    expect(issues[0].message).toContain('en');
    expect(issues[0].remediation?.docsUrl).toContain('hreflang');
    expect(issues[0].remediation?.suggestion).toBeTruthy();
  });

  it('should handle multiple mismatched links', () => {
    container.appendChild(createLink('/fr/about', 'French'));
    container.appendChild(createLink('/de/about', 'German'));
    container.appendChild(createLink('/en/about', 'English'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(2);
    const langs = issues.map((i) => i.issueMetadata?.linkLang);
    expect(langs).toContain('fr');
    expect(langs).toContain('de');
  });

  it('should detect language in path with region subtag', () => {
    container.appendChild(createLink('/en-US/about', 'US English'));

    const issues = strategy.analyze(createContext(container, 'fr'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.linkLang).toBe('en');
  });

  it('should hreflang take priority over path prefix', () => {
    // hreflang says 'de' but path says '/fr/...' — hreflang wins
    const link = createLink('/fr/about', 'German page', 'de');
    container.appendChild(link);

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.linkLang).toBe('de');
  });

  it('should skip hidden links (e.g., hidden menus at left:-9999px)', () => {
    mockIsAnalyzableElement.mockReturnValue(false);
    container.appendChild(createLink('/fr/about', 'Hidden French'));

    const issues = strategy.analyze(createContext(container, 'en'));
    expect(issues).toHaveLength(0);
  });
});
