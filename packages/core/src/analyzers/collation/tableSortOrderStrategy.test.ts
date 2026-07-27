// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach } from 'vitest';
import { TableSortOrderStrategy } from './tableSortOrderStrategy';
import type { CollationAnalyzerContext } from './types';

const DEFAULT_OPTIONS: CollationAnalyzerContext['options'] = {
  minItemCount: 5,
};

function createTable(
  headers: string[],
  rows: string[][],
  attrs?: Record<string, string>,
): HTMLTableElement {
  const table = document.createElement('table');
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      table.setAttribute(key, value);
    }
  }

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const header of headers) {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const cellText of row) {
      const td = document.createElement('td');
      td.textContent = cellText;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

function buildContext(elements: HTMLElement[], pageLang = 'en'): CollationAnalyzerContext {
  return {
    rootElement: document.documentElement,
    elements,
    options: DEFAULT_OPTIONS,
    pageLang,
  };
}

describe('TableSortOrderStrategy', () => {
  let strategy: TableSortOrderStrategy;

  beforeEach(() => {
    strategy = new TableSortOrderStrategy();
  });

  it('should have the correct name', () => {
    expect(strategy.name).toBe('TableSortOrderStrategy');
  });

  it('should return no issues for a locale-sorted table column', () => {
    const table = createTable(
      ['Name', 'Age'],
      [
        ['Alice', '30'],
        ['Bob', '25'],
        ['Charlie', '35'],
        ['David', '28'],
        ['Eve', '32'],
      ],
    );
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should return an issue for a column sorted by default but not by locale', () => {
    const table = createTable(
      ['File', 'Size'],
      [
        ['file1', '10kb'],
        ['file10', '5kb'],
        ['file2', '20kb'],
        ['file3', '15kb'],
        ['file4', '8kb'],
      ],
    );
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('collation-unsorted-table');
    expect(issues[0].severity).toBe('minor');
    document.body.removeChild(table);
  });

  it('should skip tables without thead', () => {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    for (const text of ['file1', 'file10', 'file2', 'file3', 'file4']) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should skip tables with role="presentation"', () => {
    const table = createTable(['File'], [['file1'], ['file10'], ['file2'], ['file3'], ['file4']], {
      role: 'presentation',
    });
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should skip tables with role="grid"', () => {
    const table = createTable(['File'], [['file1'], ['file10'], ['file2'], ['file3'], ['file4']], {
      role: 'grid',
    });
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should skip tables with layout-related class names', () => {
    const table = createTable(['File'], [['file1'], ['file10'], ['file2'], ['file3'], ['file4']], {
      class: 'page-layout',
    });
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should skip columns with fewer than minItemCount rows', () => {
    const table = createTable(['Name'], [['B'], ['A'], ['C']]);
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should skip numeric-only columns', () => {
    const table = createTable(
      ['ID', 'Name'],
      [
        ['1', 'file1'],
        ['10', 'file10'],
        ['2', 'file2'],
        ['3', 'file3'],
        ['4', 'file4'],
      ],
    );
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    // Only the Name column should be flagged, not the numeric ID column
    expect(issues).toHaveLength(1);
    expect((issues[0].issueMetadata as Record<string, unknown>).columnHeader).toBe('Name');
    document.body.removeChild(table);
  });

  it('should skip random order columns with no sort intent', () => {
    const table = createTable(
      ['Name'],
      [['Zebra'], ['Apple'], ['Mango'], ['Banana'], ['Watermelon']],
    );
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should flag table column sorted by default but not by locale', () => {
    const table = createTable(
      ['Name'],
      [['Abel'], ['Bertil'], ['Caesar'], ['David'], ['Erik'], ['Äpple'], ['Åse'], ['Öberg']],
      { lang: 'sv' },
    );
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table], 'sv'));
    document.body.removeChild(table);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('collation-unsorted-table');
  });

  it('should ignore non-table elements', () => {
    const ul = document.createElement('ul');
    ul.innerHTML = '<li>A</li><li>B</li><li>C</li><li>D</li><li>E</li>';
    document.body.appendChild(ul);
    const issues = strategy.analyze(buildContext([ul]));
    expect(issues).toHaveLength(0);
    document.body.removeChild(ul);
  });

  it('should include column header in issue metadata', () => {
    const table = createTable(
      ['Filename'],
      [['file1'], ['file10'], ['file2'], ['file3'], ['file4']],
    );
    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(1);
    expect((issues[0].issueMetadata as Record<string, unknown>).columnHeader).toBe('Filename');
    document.body.removeChild(table);
  });

  it('should not include rows from nested tables', () => {
    const table = createTable(
      ['Name', 'Details'],
      [
        ['Abel', 'info'],
        ['Bertil', 'info'],
        ['Caesar', 'info'],
        ['David', 'info'],
        ['Erik', 'info'],
      ],
    );
    // Insert a nested table inside one of the detail cells
    const nestedTable = document.createElement('table');
    const nestedTbody = document.createElement('tbody');
    for (const text of ['Zebra', 'Apple', 'Mango']) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
      nestedTbody.appendChild(tr);
    }
    nestedTable.appendChild(nestedTbody);
    table.querySelector('tbody tr:nth-child(2) td:nth-child(2)')!.appendChild(nestedTable);

    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    // Nested table rows should not leak into outer table analysis
    // Name column is locale-sorted, so no issues expected
    expect(issues).toHaveLength(0);
    document.body.removeChild(table);
  });

  it('should resolve header correctly with multi-row thead', () => {
    const table = document.createElement('table');
    const thead = document.createElement('thead');

    // Group header row with colspan
    const groupRow = document.createElement('tr');
    const groupTh = document.createElement('th');
    groupTh.textContent = 'People';
    groupTh.colSpan = 2;
    groupRow.appendChild(groupTh);
    thead.appendChild(groupRow);

    // Leaf header row
    const leafRow = document.createElement('tr');
    for (const h of ['Name', 'Role']) {
      const th = document.createElement('th');
      th.textContent = h;
      leafRow.appendChild(th);
    }
    thead.appendChild(leafRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const names = ['file1', 'file10', 'file2', 'file3', 'file4'];
    const roles = ['dev', 'qa', 'dev', 'pm', 'dev'];
    for (let i = 0; i < names.length; i++) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = names[i];
      const td2 = document.createElement('td');
      td2.textContent = roles[i];
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(1);
    // Should use the last thead row ("Name"), not the group row ("People")
    expect((issues[0].issueMetadata as Record<string, unknown>).columnHeader).toBe('Name');
    document.body.removeChild(table);
  });

  it('should resolve header correctly with colspan in last header row', () => {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // First header spans 2 columns
    const th1 = document.createElement('th');
    th1.textContent = 'Info';
    th1.colSpan = 2;
    headerRow.appendChild(th1);

    const th2 = document.createElement('th');
    th2.textContent = 'Value';
    headerRow.appendChild(th2);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const data = [
      ['file1', 'a', 'x'],
      ['file10', 'b', 'y'],
      ['file2', 'c', 'z'],
      ['file3', 'd', 'w'],
      ['file4', 'e', 'v'],
    ];
    for (const row of data) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    document.body.appendChild(table);
    const issues = strategy.analyze(buildContext([table]));
    expect(issues).toHaveLength(1);
    // Column 0 falls under the "Info" colspan header
    expect((issues[0].issueMetadata as Record<string, unknown>).columnHeader).toBe('Info');
    document.body.removeChild(table);
  });
});
