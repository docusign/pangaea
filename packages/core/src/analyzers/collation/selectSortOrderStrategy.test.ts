// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach } from 'vitest';
import { SelectSortOrderStrategy } from './selectSortOrderStrategy';
import type { CollationAnalyzerContext } from './types';

const DEFAULT_OPTIONS: CollationAnalyzerContext['options'] = {
  minItemCount: 5,
};

function createSelect(optionTexts: string[], attrs?: Record<string, string>): HTMLSelectElement {
  const select = document.createElement('select');
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      select.setAttribute(key, value);
    }
  }

  for (const text of optionTexts) {
    const option = document.createElement('option');
    option.textContent = text;
    select.appendChild(option);
  }

  return select;
}

function buildContext(elements: HTMLElement[], pageLang = 'en'): CollationAnalyzerContext {
  return {
    rootElement: document.documentElement,
    elements,
    options: DEFAULT_OPTIONS,
    pageLang,
  };
}

describe('SelectSortOrderStrategy', () => {
  let strategy: SelectSortOrderStrategy;

  beforeEach(() => {
    strategy = new SelectSortOrderStrategy();
  });

  it('should have the correct name', () => {
    expect(strategy.name).toBe('SelectSortOrderStrategy');
  });

  it('should return no issues for a locale-sorted select', () => {
    const select = createSelect(['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']);
    document.body.appendChild(select);
    const issues = strategy.analyze(buildContext([select]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(select);
  });

  it('should return an issue for a select sorted by default but not by locale', () => {
    const select = createSelect(['file1', 'file10', 'file2', 'file3', 'file4']);
    document.body.appendChild(select);
    const issues = strategy.analyze(buildContext([select]));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('collation-unsorted-select');
    expect(issues[0].severity).toBe('minor');
    document.body.removeChild(select);
  });

  it('should skip select with fewer than minItemCount options', () => {
    const select = createSelect(['B', 'A', 'C']);
    document.body.appendChild(select);
    const issues = strategy.analyze(buildContext([select]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(select);
  });

  it('should skip select with multiple attribute', () => {
    const select = createSelect(['file1', 'file10', 'file2', 'file3', 'file4'], {
      multiple: '',
    });
    document.body.appendChild(select);
    const issues = strategy.analyze(buildContext([select]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(select);
  });

  it('should skip random order select with no alphabetical sort intent', () => {
    const select = createSelect(['Zebra', 'Apple', 'Mango', 'Banana', 'Watermelon']);
    document.body.appendChild(select);
    const issues = strategy.analyze(buildContext([select]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(select);
  });

  it('should flag select sorted by default but not by locale', () => {
    const select = createSelect(
      ['Abel', 'Bertil', 'Caesar', 'David', 'Erik', 'Äpple', 'Åse', 'Öberg'],
      { lang: 'sv' },
    );
    document.body.appendChild(select);
    const issues = strategy.analyze(buildContext([select], 'sv'));
    document.body.removeChild(select);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('collation-unsorted-select');
  });

  it('should ignore non-select elements', () => {
    const ul = document.createElement('ul');
    ul.innerHTML = '<li>A</li><li>B</li><li>C</li><li>D</li><li>E</li>';
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });
});
