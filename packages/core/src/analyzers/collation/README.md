# Collation Analyzer

Detects list elements whose items are not sorted correctly for the page locale.

## How it works

### Element collection

The analyzer collects all `ul`, `ol`, `table`, and `select` elements visible on the page. Each
registered strategy then filters for the element types it handles.

### Sort detection

For each candidate list, the original order (`O`) is compared against two reference sorts:

- `D` — default JavaScript sort (`Array.prototype.sort()`, ascending and descending)
- `C` — locale-aware sort via `Intl.Collator(locale)` (ascending and descending)

The decision tree:

```
O == C (asc or desc)?
├── yes → skip  (correctly sorted by locale)
└── no
     O == D (asc or desc)?
     ├── yes → flag  (sorted by default sort — wrong method)
     └── no  → skip  (never intended to sort alphabetically)
```

This relies on the assumption that developers use `Array.prototype.sort()` when they intend to sort
alphabetically. A list that matches the default sort but not the locale sort indicates the wrong
method was used.

### Flagging

A list is flagged if it:

1. Is **not** correctly sorted by the locale collator (ascending or descending)
2. **Is** sorted by the default JavaScript sort (ascending or descending)
3. Contains enough text-only items (`minItemCount`, `MIN_TEXT_HOMOGENEITY_RATIO`)
4. Is not a UI widget (nav, menu, breadcrumb, pagination, etc.)

## Usage

```ts
import { CollationAnalyzer } from '@pangaea-tools/core';

const analyzer = new CollationAnalyzer();
const issues = await analyzer.run(document.body);
```

## Options

| Option         | Type     | Default | Description                                       |
| -------------- | -------- | ------- | ------------------------------------------------- |
| `minItemCount` | `number` | `5`     | Minimum items in a list or select to be analyzed. |

## Strategies

| Strategy                  | Elements   | Description                                                                                                                                                                                   |
| ------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ListSortOrderStrategy`   | `ul`, `ol` | Detects lists whose text items are not sorted for the locale. Skips navigation, menus, and mixed-content lists.                                                                               |
| `SelectSortOrderStrategy` | `select`   | Detects single-select option lists sorted by default JS sort instead of locale collation. Options inside `<optgroup>` are intentionally ignored since grouped selects have semantic ordering. |
| `TableSortOrderStrategy`  | `table`    | Detects table columns sorted by default JS sort instead of locale collation. Skips layout/grid/presentation tables.                                                                           |

## Issue types

| Type                        | Severity | Description                                                                                    |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `collation-unsorted-list`   | `minor`  | A list is sorted by the default JavaScript sort but not by the locale-aware sort.              |
| `collation-unsorted-select` | `minor`  | A select's options are sorted by the default JavaScript sort but not by the locale-aware sort. |
| `collation-unsorted-table`  | `minor`  | A table column is sorted by the default JavaScript sort but not by the locale-aware sort.      |
