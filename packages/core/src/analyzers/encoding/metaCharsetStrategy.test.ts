// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi } from 'vitest';
import { MetaCharsetStrategy } from './metaCharsetStrategy';
import type { EncodingAnalyzerContext } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

function makeContext(
  html5MetaCharset: string | null,
  html4ContentType: string | null,
  expectedEncoding = 'UTF-8',
): EncodingAnalyzerContext {
  const querySelector = vi.fn((selector: string) => {
    if (selector === 'meta[charset]') {
      return html5MetaCharset !== null
        ? { getAttribute: () => html5MetaCharset, tagName: 'META' }
        : null;
    }
    if (selector === 'meta[http-equiv="Content-Type"]') {
      return html4ContentType !== null
        ? { getAttribute: () => html4ContentType, tagName: 'META' }
        : null;
    }
    return null;
  });

  return {
    rootElement: {} as HTMLElement,
    elements: [],
    document: { querySelector } as unknown as Document,
    expectedEncoding,
    mojibakeDetectionThreshold: 3,
  };
}

describe('MetaCharsetStrategy', () => {
  const strategy = new MetaCharsetStrategy();

  it('has the correct name', () => {
    expect(strategy.name).toBe('MetaCharsetStrategy');
  });

  it('returns no issues when no meta charset elements are present', () => {
    const issues = strategy.analyze(makeContext(null, null));
    expect(issues).toHaveLength(0);
  });

  it('returns no issues when HTML5 meta charset matches expectedEncoding', () => {
    const issues = strategy.analyze(makeContext('UTF-8', null));
    expect(issues).toHaveLength(0);
  });

  it('returns no issues when HTML5 meta charset matches case-insensitively', () => {
    const issues = strategy.analyze(makeContext('utf-8', null));
    expect(issues).toHaveLength(0);
  });

  it('returns a critical issue when HTML5 meta charset mismatches', () => {
    const issues = strategy.analyze(makeContext('ISO-8859-1', null));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('encoding-mismatch-meta-charset');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].message).toContain('ISO-8859-1');
    expect(issues[0].message).toContain('UTF-8');
  });

  it('returns no issues when HTML4 Content-Type charset matches expectedEncoding', () => {
    const issues = strategy.analyze(makeContext(null, 'text/html; charset=UTF-8'));
    expect(issues).toHaveLength(0);
  });

  it('returns a critical issue when HTML4 Content-Type charset mismatches', () => {
    const issues = strategy.analyze(makeContext(null, 'text/html; charset=ISO-8859-1'));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('encoding-mismatch-meta-content-type');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].message).toContain('ISO-8859-1');
  });

  it('returns no issues when HTML4 Content-Type has no charset', () => {
    const issues = strategy.analyze(makeContext(null, 'text/html'));
    expect(issues).toHaveLength(0);
  });

  it('can return two issues when both meta elements mismatch', () => {
    const issues = strategy.analyze(makeContext('ISO-8859-1', 'text/html; charset=Windows-1252'));
    expect(issues).toHaveLength(2);
    const types = issues.map((i) => i.type);
    expect(types).toContain('encoding-mismatch-meta-charset');
    expect(types).toContain('encoding-mismatch-meta-content-type');
  });
});
