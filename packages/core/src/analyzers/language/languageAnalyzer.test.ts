// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LanguageAnalyzer } from './languageAnalyzer';
import type { AnalyzerStrategy, Issue } from '../../types/types';
import type { LanguageAnalyzerContext } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

vi.mock('../../utils/isAnalyzableElement', () => ({
  isAnalyzableElement: vi.fn().mockReturnValue(true),
}));

vi.mock('franc-min', () => ({
  franc: vi.fn(),
  francAll: vi.fn().mockReturnValue([['und', 1]]),
}));

describe('LanguageAnalyzer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('constructor and options', () => {
    it('should have the correct name', () => {
      const analyzer = new LanguageAnalyzer();
      expect(analyzer.name).toBe('LanguageAnalyzer');
    });

    it('should implement the Analyzer interface', () => {
      const analyzer = new LanguageAnalyzer();
      expect(analyzer).toHaveProperty('name');
      expect(analyzer).toHaveProperty('run');
      expect(typeof analyzer.run).toBe('function');
    });

    it('should accept custom options', () => {
      const analyzer = new LanguageAnalyzer({
        minTextLength: 50,
        confidenceThreshold: 0.8,
      });
      expect(analyzer).toBeDefined();
    });
  });

  describe('run', () => {
    it('should return a missing-html-lang issue when no page lang is set', async () => {
      // No html lang set in the test environment
      container.innerHTML = '<p>This is some text content that should be long enough.</p>';

      const analyzer = new LanguageAnalyzer();
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('language-missing-html-lang');
      expect(issues[0].severity).toBe('critical');
      expect(issues[0].elementSelector).toBe('html');
      expect(issues[0].message).toContain('missing');
    });

    it('should delegate to strategies when page lang is set', async () => {
      // Set html lang
      document.documentElement.setAttribute('lang', 'en');

      container.innerHTML = '<p>This is some text content that should be long enough.</p>';

      const mockIssue: Issue = {
        id: 'test-id',
        type: 'language-text-mismatch',
        severity: 'moderate',
        elementSelector: '.mock-selector',
        message: 'Mock issue',
      };

      const mockStrategy: AnalyzerStrategy<LanguageAnalyzerContext> = {
        name: 'MockStrategy',
        analyze: vi.fn().mockReturnValue([mockIssue]),
      };

      const analyzer = new LanguageAnalyzer({}, [mockStrategy]);
      const issues = await analyzer.run(container);

      expect(mockStrategy.analyze).toHaveBeenCalledOnce();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toBe(mockIssue);

      document.documentElement.removeAttribute('lang');
    });

    it('should pass correct context to strategies', async () => {
      document.documentElement.setAttribute('lang', 'fr');

      container.innerHTML = '<p>Un paragraphe de texte français.</p>';

      const mockStrategy: AnalyzerStrategy<LanguageAnalyzerContext> = {
        name: 'MockStrategy',
        analyze: vi.fn().mockReturnValue([]),
      };

      const analyzer = new LanguageAnalyzer({ minTextLength: 30, confidenceThreshold: 0.7 }, [
        mockStrategy,
      ]);
      await analyzer.run(container);

      const call = vi.mocked(mockStrategy.analyze).mock.calls[0];
      const context = call[0];

      expect(context.pageLang).toBe('fr');
      expect(context.options.minTextLength).toBe(30);
      expect(context.options.confidenceThreshold).toBe(0.7);
      expect(context.rootElement).toBe(container);
      expect(context.elements.length).toBeGreaterThan(0);

      document.documentElement.removeAttribute('lang');
    });

    it('should merge issues from multiple strategies', async () => {
      document.documentElement.setAttribute('lang', 'en');

      container.innerHTML = '<p>Some text here that is long enough.</p>';

      const issue1: Issue = {
        id: 'id-1',
        type: 'language-text-mismatch',
        severity: 'moderate',
        elementSelector: '.s1',
      };
      const issue2: Issue = {
        id: 'id-2',
        type: 'language-link-mismatch',
        severity: 'minor',
        elementSelector: '.s2',
      };

      const strategy1: AnalyzerStrategy<LanguageAnalyzerContext> = {
        name: 'Strategy1',
        analyze: vi.fn().mockReturnValue([issue1]),
      };
      const strategy2: AnalyzerStrategy<LanguageAnalyzerContext> = {
        name: 'Strategy2',
        analyze: vi.fn().mockReturnValue([issue2]),
      };

      const analyzer = new LanguageAnalyzer({}, [strategy1, strategy2]);
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(2);
      expect(issues).toContain(issue1);
      expect(issues).toContain(issue2);

      document.documentElement.removeAttribute('lang');
    });

    it('should use default options when none provided', async () => {
      document.documentElement.setAttribute('lang', 'en');

      container.innerHTML = '<p>Test content for defaults.</p>';

      const mockStrategy: AnalyzerStrategy<LanguageAnalyzerContext> = {
        name: 'MockStrategy',
        analyze: vi.fn().mockReturnValue([]),
      };

      const analyzer = new LanguageAnalyzer(undefined, [mockStrategy]);
      await analyzer.run(container);

      const context = vi.mocked(mockStrategy.analyze).mock.calls[0][0];
      expect(context.options.minTextLength).toBe(30);
      expect(context.options.confidenceThreshold).toBe(0.15);

      document.documentElement.removeAttribute('lang');
    });

    it('should not read xml:lang', async () => {
      document.documentElement.removeAttribute('lang');
      document.documentElement.setAttribute('xml:lang', 'ja');

      container.innerHTML = '<p>日本語のテスト文章が十分に長い。</p>';

      const analyzer = new LanguageAnalyzer();
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('language-missing-html-lang');

      document.documentElement.removeAttribute('xml:lang');
    });
  });
});
