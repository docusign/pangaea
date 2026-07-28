// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { DocumentEncodingStrategy } from './documentEncodingStrategy';
import type { EncodingAnalyzerContext } from './types';

function makeContext(characterSet: string, expectedEncoding: string): EncodingAnalyzerContext {
  return {
    rootElement: {} as HTMLElement,
    elements: [],
    document: { characterSet } as unknown as Document,
    expectedEncoding,
    mojibakeDetectionThreshold: 3,
  };
}

describe('DocumentEncodingStrategy', () => {
  const strategy = new DocumentEncodingStrategy();

  it('has the correct name', () => {
    expect(strategy.name).toBe('DocumentEncodingStrategy');
  });

  it('returns no issues when characterSet matches expectedEncoding', () => {
    const issues = strategy.analyze(makeContext('UTF-8', 'UTF-8'));
    expect(issues).toHaveLength(0);
  });

  it('returns no issues when characterSet matches case-insensitively', () => {
    const issues = strategy.analyze(makeContext('utf-8', 'UTF-8'));
    expect(issues).toHaveLength(0);
  });

  it('returns no issues when expectedEncoding is lowercase and characterSet is uppercase', () => {
    const issues = strategy.analyze(makeContext('UTF-8', 'utf-8'));
    expect(issues).toHaveLength(0);
  });

  it('returns a critical issue when characterSet differs from expectedEncoding', () => {
    const issues = strategy.analyze(makeContext('ISO-8859-1', 'UTF-8'));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('encoding-mismatch-document');
    expect(issues[0].severity).toBe('critical');
  });

  it('includes the actual and expected encoding in the issue message', () => {
    const issues = strategy.analyze(makeContext('ISO-8859-1', 'UTF-8'));
    expect(issues[0].message).toContain('ISO-8859-1');
    expect(issues[0].message).toContain('UTF-8');
  });

  it('includes remediation with docsUrl and suggestion', () => {
    const issues = strategy.analyze(makeContext('ISO-8859-1', 'UTF-8'));
    expect(issues[0].remediation?.docsUrl).toContain('mozilla.org');
    expect(issues[0].remediation?.suggestion).toBeTruthy();
  });
});
