// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock franc before importing the module under test
vi.mock('franc-min', () => ({
  franc: vi.fn(),
  francAll: vi.fn(),
}));

import { francAll } from 'franc-min';
import {
  detectLanguage,
  normalizeLanguageCode,
  isLanguageMatch,
  getEffectiveLanguage,
} from './languageDetection';

const mockedFrancAll = vi.mocked(francAll);

describe('languageDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectLanguage', () => {
    it('should return "und" for text shorter than minLength', () => {
      const result = detectLanguage('hi', 20);
      expect(result).toEqual({ lang: 'und', confidence: 0, secondLang: 'und' });
      expect(mockedFrancAll).not.toHaveBeenCalled();
    });

    it('should return "und" when francAll returns "und"', () => {
      mockedFrancAll.mockReturnValue([['und', 1]]);
      const result = detectLanguage('This is a test sentence that is long enough.', 10);
      expect(result).toEqual({ lang: 'und', confidence: 0, secondLang: 'und' });
    });

    it('should return "und" when francAll returns empty', () => {
      mockedFrancAll.mockReturnValue([]);
      const result = detectLanguage('This is a test sentence that is long enough.', 10);
      expect(result).toEqual({ lang: 'und', confidence: 0, secondLang: 'und' });
    });

    it('should convert ISO 639-3 to ISO 639-1', () => {
      mockedFrancAll.mockReturnValue([
        ['eng', 0.1],
        ['fra', 0.5],
      ]);
      const result = detectLanguage('This is a fairly long English sentence for testing.', 10);
      expect(result.lang).toBe('en');
    });

    it('should compute confidence as margin from first non-family competitor', () => {
      mockedFrancAll.mockReturnValue([
        ['eng', 1],
        ['fra', 0.8],
      ]);
      const result = detectLanguage('This is a fairly long English sentence for testing.', 10);
      // confidence = 1 - 0.8 = 0.2 (fra is not in the en family)
      expect(result.confidence).toBeCloseTo(0.2);
    });

    it('should return confidence 1.0 when only one result', () => {
      mockedFrancAll.mockReturnValue([['eng', 1]]);
      const result = detectLanguage('This is a fairly long English sentence for testing.', 10);
      expect(result.confidence).toBe(1);
      expect(result.secondLang).toBe('und');
    });

    it('should skip same-family languages when computing confidence', () => {
      // eng and sco are in the same family, so sco should be skipped
      // confidence should be based on afr (first non-family competitor)
      mockedFrancAll.mockReturnValue([
        ['eng', 1],
        ['sco', 0.97],
        ['afr', 0.85],
      ]);
      const result = detectLanguage('This is a fairly long English sentence for testing.', 10);
      // confidence = 1 - 0.85 = 0.15 (skipped sco at 0.97)
      expect(result.confidence).toBeCloseTo(0.15);
      expect(result.lang).toBe('en');
      expect(result.secondLang).toBe('af');
    });

    it('should skip multiple same-family languages when computing confidence', () => {
      // nob and nor are both in the Norwegian family with nno
      mockedFrancAll.mockReturnValue([
        ['nob', 1],
        ['nor', 0.98],
        ['dan', 0.8],
      ]);
      const result = detectLanguage('Norsk tekst som er lang nok for testing.', 10);
      // nob → nb, nor → no (same family); dan → da is the real competitor
      // confidence = 1 - 0.80 = 0.20
      expect(result.confidence).toBeCloseTo(0.2);
    });

    it('should use second result normally when not in the same family', () => {
      // fra and eng are not in the same family
      mockedFrancAll.mockReturnValue([
        ['fra', 1],
        ['eng', 0.85],
        ['deu', 0.8],
      ]);
      const result = detectLanguage('Ceci est un texte en français assez long pour le test.', 10);
      // confidence = 1 - 0.85 = 0.15 (eng is not in the fr family)
      expect(result.confidence).toBeCloseTo(0.15);
      expect(result.secondLang).toBe('en');
    });

    it('should return the raw ISO 639-3 code if no mapping exists', () => {
      mockedFrancAll.mockReturnValue([
        ['xxx', 1],
        ['yyy', 0.5],
      ]);
      const result = detectLanguage('This is a fairly long test sentence.', 10);
      expect(result.lang).toBe('xxx');
    });

    it('should map cmn to zh', () => {
      mockedFrancAll.mockReturnValue([
        ['cmn', 1],
        ['jpn', 0.5],
      ]);
      const result = detectLanguage('这是一段中文测试文本用于测试语言检测功能', 10);
      expect(result.lang).toBe('zh');
    });

    it('should map jpn to ja', () => {
      mockedFrancAll.mockReturnValue([
        ['jpn', 1],
        ['kor', 0.5],
      ]);
      const result = detectLanguage('これは日本語のテスト文章で十分に長い', 10);
      expect(result.lang).toBe('ja');
    });
  });

  describe('normalizeLanguageCode', () => {
    it('should return empty string for empty input', () => {
      expect(normalizeLanguageCode('')).toBe('');
    });

    it('should lowercase the code', () => {
      expect(normalizeLanguageCode('EN')).toBe('en');
    });

    it('should strip region subtag', () => {
      expect(normalizeLanguageCode('en-US')).toBe('en');
    });

    it('should strip script subtag', () => {
      expect(normalizeLanguageCode('zh-Hans')).toBe('zh');
    });

    it('should handle complex subtags', () => {
      expect(normalizeLanguageCode('zh-Hant-TW')).toBe('zh');
    });

    it('should handle simple codes', () => {
      expect(normalizeLanguageCode('fr')).toBe('fr');
    });
  });

  describe('isLanguageMatch', () => {
    it('should return true for exact match', () => {
      expect(isLanguageMatch('en', 'en')).toBe(true);
    });

    it('should return true for case-insensitive match', () => {
      expect(isLanguageMatch('EN', 'en')).toBe(true);
    });

    it('should return true when declared has region but language matches', () => {
      expect(isLanguageMatch('en-US', 'en')).toBe(true);
    });

    it('should return true for undetermined detected language', () => {
      expect(isLanguageMatch('en', 'und')).toBe(true);
    });

    it('should return false for different languages', () => {
      expect(isLanguageMatch('en', 'fr')).toBe(false);
    });

    it('should match Norwegian family: no/nb/nn', () => {
      expect(isLanguageMatch('no', 'nb')).toBe(true);
      expect(isLanguageMatch('nb', 'nn')).toBe(true);
      expect(isLanguageMatch('nn', 'no')).toBe(true);
    });

    it('should match Serbian/Croatian/Bosnian family', () => {
      expect(isLanguageMatch('sr', 'hr')).toBe(true);
      expect(isLanguageMatch('hr', 'bs')).toBe(true);
      expect(isLanguageMatch('bs', 'sr')).toBe(true);
    });

    it('should match Scots and English as same family', () => {
      expect(isLanguageMatch('en', 'sco')).toBe(true);
      expect(isLanguageMatch('sco', 'en')).toBe(true);
    });

    it('should match Chinese variants via family', () => {
      expect(isLanguageMatch('zh-CN', 'zh')).toBe(true);
      expect(isLanguageMatch('zh-TW', 'zh')).toBe(true);
    });
  });

  describe('getEffectiveLanguage', () => {
    it('should return the lang attribute from the element itself', () => {
      const el = document.createElement('span');
      el.setAttribute('lang', 'fr');
      expect(getEffectiveLanguage(el)).toBe('fr');
    });

    it('should walk up to find the nearest ancestor lang', () => {
      const parent = document.createElement('div');
      parent.setAttribute('lang', 'de');
      const child = document.createElement('span');
      parent.appendChild(child);

      expect(getEffectiveLanguage(child)).toBe('de');
    });

    it('should return the closest ancestor lang, not a farther one', () => {
      const grandparent = document.createElement('div');
      grandparent.setAttribute('lang', 'en');

      const parent = document.createElement('div');
      parent.setAttribute('lang', 'fr');
      grandparent.appendChild(parent);

      const child = document.createElement('span');
      parent.appendChild(child);

      expect(getEffectiveLanguage(child)).toBe('fr');
    });

    it('should return empty string if no lang attribute found', () => {
      const el = document.createElement('span');
      expect(getEffectiveLanguage(el)).toBe('');
    });
  });
});
