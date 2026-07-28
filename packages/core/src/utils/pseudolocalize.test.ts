// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { defaultConfigurationJSON, pseudolocalize } from './pseudolocalize';
import { pseudolocalizeText } from './pseudolocalizeText';

describe('pseudolocalize', () => {
  it('wraps output in the configured prepend/append markers', () => {
    const result = pseudolocalize('Hello');
    expect(result.startsWith('[')).toBe(true);
    expect(result.endsWith(']')).toBe(true);
  });

  it('accents ASCII letters', () => {
    const result = pseudolocalize('Hello');
    expect(result).not.toContain('H');
    expect(result).not.toContain('e');
    expect(result).toContain('Ĥ');
  });

  it('expands length by roughly the configured pad ratio', () => {
    const input = 'The quick brown fox jumps over the lazy dog';
    const inner = pseudolocalize(input).slice(1, -1); // strip [ ]
    // padded by ceil(len * 0.3) extra characters
    const expected = input.length + Math.ceil(input.length * defaultConfigurationJSON.pad);
    expect(inner.length).toBe(expected);
  });

  it('is deterministic for a given input', () => {
    expect(pseudolocalize('Save changes')).toBe(pseudolocalize('Save changes'));
  });

  it('preserves interpolation tokens', () => {
    const result = pseudolocalize('Hello {{name}} and <b>world</b>');
    expect(result).toContain('{{name}}');
    expect(result).toContain('<b>');
  });
});

describe('pseudolocalizeText', () => {
  it('appends the division marker and pseudolocalizes', () => {
    const result = pseudolocalizeText('Menu');
    expect(result).toContain('～');
    expect(result.startsWith('[')).toBe(true);
    expect(result.endsWith(']')).toBe(true);
  });
});
