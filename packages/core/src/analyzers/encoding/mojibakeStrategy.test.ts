// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi } from 'vitest';
import { MojibakeStrategy } from './mojibakeStrategy';
import type { EncodingAnalyzerContext } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

function makeContext(bodyInnerText: string, threshold = 3): EncodingAnalyzerContext {
  return {
    rootElement: {} as HTMLElement,
    elements: [],
    document: {
      body: { innerText: bodyInnerText, childNodes: [], children: [] },
      querySelector: vi.fn().mockReturnValue(null),
    } as unknown as Document,
    expectedEncoding: 'UTF-8',
    mojibakeDetectionThreshold: threshold,
  };
}

describe('MojibakeStrategy', () => {
  const strategy = new MojibakeStrategy();

  it('has the correct name', () => {
    expect(strategy.name).toBe('MojibakeStrategy');
  });

  it('returns no issues for normal English text', () => {
    const issues = strategy.analyze(
      makeContext('This is normal English text without any encoding issues.'),
    );
    expect(issues).toHaveLength(0);
  });

  it('returns no issues when body is missing', () => {
    const context: EncodingAnalyzerContext = {
      rootElement: {} as HTMLElement,
      elements: [],
      document: { body: null } as unknown as Document,
      expectedEncoding: 'UTF-8',
      mojibakeDetectionThreshold: 3,
    };
    const issues = strategy.analyze(context);
    expect(issues).toHaveLength(0);
  });

  it('returns no issues for empty body text', () => {
    const issues = strategy.analyze(makeContext(''));
    expect(issues).toHaveLength(0);
  });

  it('detects Japanese UTF-8 as Windows-1252 mojibake (1-gram patterns)', () => {
    // ã (U+00E3), control chars 0x83, 0x82 — high-frequency patterns from MOJIBAKE dictionary
    const char1 = '\u00E3';
    const char2 = String.fromCharCode(0x0083);
    const char3 = String.fromCharCode(0x0082);
    // Repeat enough times to exceed the 15% mojibake character threshold
    const text = `${char1}${char2}${char1}${char3}`.repeat(20);
    const issues = strategy.analyze(makeContext(text));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe('encoding-mojibake');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].message).toContain('mojibake');
  });

  it('detects Japanese mojibake with 3-gram patterns', () => {
    // ã\x83¼ (U+00E3 U+0083 U+00BC) — most frequent 3-gram
    const threeGram = String.fromCharCode(0x00e3, 0x0083, 0x00bc);
    const text = threeGram.repeat(20);
    const issues = strategy.analyze(makeContext(text));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe('encoding-mojibake');
  });

  it('detects UTF-8 as Shift_JIS mojibake patterns', () => {
    // High-frequency patterns from MOJIBAKE_UTF8_AS_SHIFTJIS
    const pattern = '縺・';
    const text = pattern.repeat(20);
    const issues = strategy.analyze(makeContext(text));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe('encoding-mojibake');
  });

  it('returns a single issue with issueMetadata.mojibakeSelectors', () => {
    const char1 = '\u00E3';
    const char2 = String.fromCharCode(0x0083);
    const text = `${char1}${char2}`.repeat(30);
    const issues = strategy.analyze(makeContext(text));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueMetadata).toBeDefined();
    expect(Array.isArray(issues[0].issueMetadata?.mojibakeSelectors)).toBe(true);
  });

  it('returns no issues when mojibake chars are below threshold', () => {
    // A single 1-gram match doesn't exceed default threshold of 3
    const singleMatch = '\u00E3'; // 1 char, far below threshold=3
    const issues = strategy.analyze(makeContext(singleMatch));
    expect(issues).toHaveLength(0);
  });

  it('includes remediation with docsUrl and suggestion', () => {
    const char1 = '\u00E3';
    const char2 = String.fromCharCode(0x0083);
    const text = `${char1}${char2}`.repeat(30);
    const issues = strategy.analyze(makeContext(text));
    expect(issues[0].remediation?.docsUrl).toContain('wikipedia.org');
    expect(issues[0].remediation?.suggestion).toBeTruthy();
  });
});
