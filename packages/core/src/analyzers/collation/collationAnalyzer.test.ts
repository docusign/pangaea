// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollationAnalyzer } from './collationAnalyzer';

vi.mock('../../utils/isAnalyzableElement', () => ({
  isAnalyzableElement: () => true,
}));

describe('CollationAnalyzer', () => {
  let analyzer: CollationAnalyzer;

  beforeEach(() => {
    analyzer = new CollationAnalyzer();
  });

  it('should have the correct name', () => {
    expect(analyzer.name).toBe('CollationAnalyzer');
  });

  it('should accept custom options', () => {
    const custom = new CollationAnalyzer({
      minItemCount: 3,
    });
    expect(custom.name).toBe('CollationAnalyzer');
  });

  it('should return no issues for a page with sorted lists', async () => {
    document.body.innerHTML = `
      <ul>
        <li>Alpha</li>
        <li>Beta</li>
        <li>Charlie</li>
        <li>Delta</li>
        <li>Echo</li>
      </ul>
    `;

    const issues = await analyzer.run(document.body);
    expect(issues).toHaveLength(0);
  });

  it('should detect unsorted list', async () => {
    document.body.innerHTML = `
      <ul>
        <li>file1</li>
        <li>file10</li>
        <li>file2</li>
        <li>file3</li>
        <li>file4</li>
      </ul>
    `;

    const issues = await analyzer.run(document.body);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe('collation-unsorted-list');
  });

  it('should detect unsorted select options', async () => {
    document.body.innerHTML = `
      <select>
        <option>file1</option>
        <option>file10</option>
        <option>file2</option>
        <option>file3</option>
        <option>file4</option>
      </select>
    `;

    const issues = await analyzer.run(document.body);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe('collation-unsorted-select');
  });

  it('should accept custom strategies', async () => {
    const mockStrategy = {
      name: 'MockStrategy',
      analyze: () => [],
    };
    const customAnalyzer = new CollationAnalyzer({}, [mockStrategy]);
    const issues = await customAnalyzer.run(document.body);
    expect(issues).toHaveLength(0);
  });
});
