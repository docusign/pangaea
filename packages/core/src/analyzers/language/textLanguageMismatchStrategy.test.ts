// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextLanguageMismatchStrategy } from './textLanguageMismatchStrategy';
import type { LanguageAnalyzerContext } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

// Mock franc (used internally by languageDetection.ts)
vi.mock('franc-min', () => ({
  franc: vi.fn(),
  francAll: vi.fn(),
}));

import { francAll } from 'franc-min';

const mockedFrancAll = vi.mocked(francAll);

function createContext(
  rootElement: HTMLElement,
  elements: HTMLElement[],
  pageLang = 'en',
  options?: Partial<{ minTextLength: number; confidenceThreshold: number }>,
): LanguageAnalyzerContext {
  return {
    rootElement,
    elements,
    pageLang,
    options: {
      minTextLength: options?.minTextLength ?? 20,
      confidenceThreshold: options?.confidenceThreshold ?? 0.1,
    },
  };
}

describe('TextLanguageMismatchStrategy', () => {
  const strategy = new TextLanguageMismatchStrategy();
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should have the correct name', () => {
    expect(strategy.name).toBe('TextLanguageMismatchStrategy');
  });

  it('should return no issues when text matches page language', () => {
    const p = document.createElement('p');
    p.textContent = 'This is a long enough English sentence for testing purposes.';
    container.appendChild(p);

    mockedFrancAll.mockReturnValue([
      ['eng', 1],
      ['fra', 0.7],
    ]);

    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should flag text that does not match the page language', () => {
    const p = document.createElement('p');
    p.textContent = 'Ceci est une phrase en français assez longue pour la détection.';
    container.appendChild(p);

    mockedFrancAll.mockReturnValue([
      ['fra', 1],
      ['spa', 0.7],
    ]);

    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('language-text-mismatch');
    expect(issues[0].severity).toBe('moderate');
    expect(issues[0].issueMetadata?.detectedLang).toBe('fr');
    expect(issues[0].issueMetadata?.declaredLang).toBe('en');
  });

  it('should skip text shorter than minTextLength', () => {
    const p = document.createElement('p');
    p.textContent = 'Short';
    container.appendChild(p);

    const issues = strategy.analyze(createContext(container, [p], 'en', { minTextLength: 20 }));
    expect(issues).toHaveLength(0);
    expect(mockedFrancAll).not.toHaveBeenCalled();
  });

  it('should skip text when confidence is below threshold and top-2 includes declared lang', () => {
    const p = document.createElement('p');
    p.textContent = 'Some ambiguous sentence that is long enough for detection.';
    container.appendChild(p);

    // confidence = 1 - 0.95 = 0.05, below default threshold of 0.1
    // second-best is 'en' which matches declared lang → no top-2 consensus → skip
    mockedFrancAll.mockReturnValue([
      ['fra', 1],
      ['eng', 0.95],
    ]);

    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should flag via top-2 consensus when both top guesses differ from declared lang', () => {
    const p = document.createElement('p');
    p.textContent = 'Some ambiguous sentence that is long enough for detection.';
    container.appendChild(p);

    // confidence = 1 - 0.95 = 0.05, below threshold
    // but both fra and spa disagree with 'ja' → top-2 consensus flags it
    mockedFrancAll.mockReturnValue([
      ['fra', 1],
      ['spa', 0.95],
    ]);

    const issues = strategy.analyze(createContext(container, [p], 'ja'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.detectedLang).toBe('fr');
  });

  it('should skip text when franc returns undetermined', () => {
    const p = document.createElement('p');
    p.textContent = 'abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrst';
    container.appendChild(p);

    mockedFrancAll.mockReturnValue([['und', 1]]);

    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should respect the nearest ancestor lang attribute', () => {
    const div = document.createElement('div');
    div.setAttribute('lang', 'fr');
    const p = document.createElement('p');
    p.textContent = 'Ceci est une phrase en français assez longue pour la détection.';
    div.appendChild(p);
    container.appendChild(div);

    mockedFrancAll.mockReturnValue([
      ['fra', 1],
      ['spa', 0.7],
    ]);

    // Page lang is 'en' but the nearest ancestor is 'fr' — should not flag
    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should only analyze direct text content, not children text', () => {
    const p = document.createElement('p');
    p.textContent = ''; // No direct text
    const span = document.createElement('span');
    span.textContent = 'This text belongs to the span, not the paragraph.';
    p.appendChild(span);
    container.appendChild(p);

    // The paragraph has no direct text nodes — should skip
    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should format the issue with message and remediation', () => {
    const p = document.createElement('p');
    p.textContent = 'Dies ist ein deutscher Satz lang genug zur Erkennung.';
    container.appendChild(p);

    mockedFrancAll.mockReturnValue([
      ['deu', 1],
      ['nld', 0.7],
    ]);

    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBeDefined();
    expect(issues[0].message).toContain('de');
    expect(issues[0].message).toContain('en');
    expect(issues[0].remediation?.docsUrl).toContain('lang');
    expect(issues[0].remediation?.suggestion).toBeTruthy();
  });

  it('should skip when no page lang and no ancestor lang declared', () => {
    const p = document.createElement('p');
    p.textContent = 'This is a long enough English sentence for testing purposes.';
    container.appendChild(p);

    const issues = strategy.analyze(createContext(container, [p], ''));
    expect(issues).toHaveLength(0);
  });

  it('should handle multiple elements', () => {
    const p1 = document.createElement('p');
    p1.textContent = 'Ceci est une phrase en français assez longue pour la détection.';
    container.appendChild(p1);

    const p2 = document.createElement('p');
    p2.textContent = 'Dies ist ein deutscher Satz lang genug zur Erkennung.';
    container.appendChild(p2);

    mockedFrancAll
      .mockReturnValueOnce([
        ['fra', 1],
        ['spa', 0.7],
      ])
      .mockReturnValueOnce([
        ['deu', 1],
        ['nld', 0.7],
      ]);

    const issues = strategy.analyze(createContext(container, [p1, p2], 'en'));
    expect(issues).toHaveLength(2);
    expect(issues[0].issueMetadata?.detectedLang).toBe('fr');
    expect(issues[1].issueMetadata?.detectedLang).toBe('de');
  });

  it('should fall back to full textContent when direct text is short and detection is uncertain', () => {
    // Simulates: <h2>Free Workshop - Docusign eSignature: <span>Sending Basics</span></h2>
    // Direct text of h2 is short ("Free Workshop - Docusign eSignature: ")
    // Full textContent includes child spans, giving franc more data.
    const h2 = document.createElement('h2');
    h2.appendChild(document.createTextNode('Free Workshop - Docusign eSignature: '));
    const span = document.createElement('span');
    span.textContent = 'Sending Basics';
    h2.appendChild(span);
    container.appendChild(h2);

    // First call (direct text only) → undetermined or low confidence
    // Second call (full textContent) → confident English detection
    mockedFrancAll
      .mockReturnValueOnce([
        ['nld', 1],
        ['eng', 0.98],
      ]) // direct text: low confidence (0.02)
      .mockReturnValueOnce([
        ['eng', 1],
        ['por', 0.85],
      ]); // full text: good confidence (0.15)

    const issues = strategy.analyze(createContext(container, [h2], 'ja'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.detectedLang).toBe('en');
    expect(mockedFrancAll).toHaveBeenCalledTimes(2);
  });

  it('should not fall back when direct text is long enough but use top-2 consensus', () => {
    const p = document.createElement('p');
    // 90 chars of direct text — above SHORT_TEXT_FALLBACK_THRESHOLD (80)
    const longText =
      'This is a sufficiently long English sentence that should not need fallback to full content.';
    p.appendChild(document.createTextNode(longText));
    const span = document.createElement('span');
    span.textContent = ' Extra child text here.';
    p.appendChild(span);
    container.appendChild(p);

    // Low confidence (nld and eng are close) but both disagree with 'ja'
    // → top-2 consensus triggers detection
    mockedFrancAll.mockReturnValueOnce([
      ['nld', 1],
      ['eng', 0.95],
    ]);

    const issues = strategy.analyze(createContext(container, [p], 'ja'));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata?.detectedLang).toBe('nl');
    expect(mockedFrancAll).toHaveBeenCalledTimes(1);
  });

  it('should skip when low confidence and top-2 includes declared language', () => {
    const p = document.createElement('p');
    const longText =
      'This is a sufficiently long sentence that might be in English or not, who knows.';
    p.appendChild(document.createTextNode(longText));
    container.appendChild(p);

    // Low confidence, but second-best is 'en' which matches the page lang
    // → don't flag (one of the top 2 agrees with the declared language)
    mockedFrancAll.mockReturnValueOnce([
      ['nld', 1],
      ['eng', 0.95],
    ]);

    const issues = strategy.analyze(createContext(container, [p], 'en'));
    expect(issues).toHaveLength(0);
  });

  it('should not fall back when direct text detection already has good confidence', () => {
    const h2 = document.createElement('h2');
    h2.appendChild(document.createTextNode('A short heading with enough chars'));
    const span = document.createElement('span');
    span.textContent = ' more text here to pad';
    h2.appendChild(span);
    container.appendChild(h2);

    // Direct text detection succeeds with good confidence — no fallback needed
    mockedFrancAll.mockReturnValueOnce([
      ['eng', 1],
      ['por', 0.8],
    ]);

    const issues = strategy.analyze(createContext(container, [h2], 'ja'));
    expect(issues).toHaveLength(1);
    expect(mockedFrancAll).toHaveBeenCalledTimes(1); // only called once, no fallback
  });
});
