// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach } from 'vitest';
import { ListSortOrderStrategy } from './listSortOrderStrategy';
import type { CollationAnalyzerContext } from './types';

const DEFAULT_OPTIONS: CollationAnalyzerContext['options'] = {
  minItemCount: 5,
};

function createList(
  tag: 'ul' | 'ol',
  itemTexts: string[],
  attrs?: Record<string, string>,
): HTMLElement {
  const list = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      list.setAttribute(key, value);
    }
  }
  for (const text of itemTexts) {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  }
  return list;
}

function buildContext(elements: HTMLElement[], pageLang = 'en'): CollationAnalyzerContext {
  return {
    rootElement: document.documentElement,
    elements,
    options: DEFAULT_OPTIONS,
    pageLang,
  };
}

describe('ListSortOrderStrategy', () => {
  let strategy: ListSortOrderStrategy;

  beforeEach(() => {
    strategy = new ListSortOrderStrategy();
  });

  it('should have the correct name', () => {
    expect(strategy.name).toBe('ListSortOrderStrategy');
  });

  it('should return no issues for a sorted list', () => {
    const ul = createList('ul', ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']);
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should return an issue for a list sorted by default but not by locale', () => {
    // Lexicographic sort puts file10 before file2; numeric-aware locale sort does not
    const ul = createList('ul', ['file1', 'file10', 'file2', 'file3', 'file4']);
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('collation-unsorted-list');
    expect(issues[0].severity).toBe('minor');
    document.body.removeChild(ul);
  });

  it('should skip lists with navigation role', () => {
    const ul = createList('ul', ['Banana', 'Apple', 'Date', 'Cherry', 'Elderberry'], {
      role: 'navigation',
    });
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should skip lists with menu role', () => {
    const ul = createList('ul', ['Banana', 'Apple', 'Date', 'Cherry', 'Elderberry'], {
      role: 'menu',
    });
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should skip lists inside nav element', () => {
    const nav = document.createElement('nav');
    const ul = createList('ul', ['Banana', 'Apple', 'Date', 'Cherry', 'Elderberry']);
    nav.appendChild(ul);
    document.body.appendChild(nav);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(nav);
  });

  it('should skip lists with nav-related class names', () => {
    const ul = createList('ul', ['Banana', 'Apple', 'Date', 'Cherry', 'Elderberry'], {
      class: 'main-nav-list',
    });
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should skip lists with fewer than minItemCount items', () => {
    const ul = createList('ul', ['B', 'A', 'C']);
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should skip lists with complex children (images)', () => {
    const ul = document.createElement('ul');
    for (let i = 0; i < 5; i++) {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = 'test.png';
      li.appendChild(img);
      li.appendChild(document.createTextNode(`Item ${5 - i}`));
      ul.appendChild(li);
    }
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should not flag descending-sorted list', () => {
    const ul = createList('ul', ['Elderberry', 'Date', 'Cherry', 'Banana', 'Apple']);
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should skip lists with random order (never intended to sort)', () => {
    // Completely random order has too many inversions
    const ul = createList('ul', [
      'Zebra',
      'Apple',
      'Mango',
      'Banana',
      'Watermelon',
      'Cherry',
      'Pear',
      'Date',
      'Kiwi',
      'Fig',
    ]);
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should work with ol elements', () => {
    const ol = createList('ol', ['file1', 'file10', 'file2', 'file3', 'file4']);
    document.body.appendChild(ol);
    const issues = strategy.analyze(buildContext([ol]));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('collation-unsorted-list');
    document.body.removeChild(ol);
  });

  it('should ignore select elements', () => {
    const select = document.createElement('select');
    for (const text of ['B', 'A', 'C', 'E', 'D']) {
      const opt = document.createElement('option');
      opt.textContent = text;
      select.appendChild(opt);
    }
    document.body.appendChild(select);
    const issues = strategy.analyze(buildContext([select]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(select);
  });

  it('should skip list inside ancestor with nav class', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'site-navigation';
    const ul = createList('ul', ['Banana', 'Apple', 'Date', 'Cherry', 'Elderberry']);
    wrapper.appendChild(ul);
    document.body.appendChild(wrapper);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(wrapper);
  });

  it('should flag list sorted by default but not by locale', () => {
    // In Swedish, Å(U+00C5) sorts before Ä(U+00C4) — opposite of Unicode order.
    // Default sort produces Äpple before Åse; Swedish locale sort produces Åse before Äpple.
    const ul = createList(
      'ul',
      ['Abel', 'Bertil', 'Caesar', 'David', 'Erik', 'Äpple', 'Åse', 'Öberg'],
      { lang: 'sv' },
    );
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul], 'sv'));
    document.body.removeChild(ul);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('collation-unsorted-list');
  });

  it('should skip list with no alphabetical sort intent', () => {
    const ul = createList('ul', [
      'Frankreich',
      'Ägypten',
      'Österreich',
      'Brasilien',
      'Deutschland',
    ]);
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul], 'de'));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });
});
