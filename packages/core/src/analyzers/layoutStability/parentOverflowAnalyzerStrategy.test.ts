// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParentOverflowAnalyzerStrategy } from './parentOverflowAnalyzerStrategy';
import type { LayoutStabilityAnalyzerContext, ElementSnapshot } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

// Mock getComputedStyle to return 'visible' for overflow by default
const originalGetComputedStyle = window.getComputedStyle;
let overflowXValue = 'visible';
let overflowYValue = 'visible';

function makeSnapshot(overrides: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    boundingRect: new DOMRect(0, 0, 200, 100),
    scrollWidth: 200,
    scrollHeight: 100,
    clientWidth: 200,
    clientHeight: 100,
    ...overrides,
  };
}

function createContext(
  elements: HTMLElement[],
  beforeMap: Map<HTMLElement, ElementSnapshot>,
  afterMap: Map<HTMLElement, ElementSnapshot>,
  options: Partial<LayoutStabilityAnalyzerContext['options']> = {},
): LayoutStabilityAnalyzerContext {
  return {
    rootElement: document.createElement('div'),
    elements,
    beforeSnapshots: beforeMap,
    afterSnapshots: afterMap,
    options: {
      overflowDeltaPercentThreshold: 5,
      overflowDeltaPixelThreshold: 10,
      ...options,
    },
  };
}

describe('ParentOverflowAnalyzerStrategy', () => {
  const strategy = new ParentOverflowAnalyzerStrategy();
  let parent: HTMLElement;
  let child: HTMLElement;

  beforeEach(() => {
    parent = document.createElement('div');
    child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);
    overflowXValue = 'visible';
    overflowYValue = 'visible';
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) =>
        ({
          ...originalGetComputedStyle(el),
          overflowX: overflowXValue,
          overflowY: overflowYValue,
        }) as CSSStyleDeclaration,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have the correct name and issueType', () => {
    expect(strategy.name).toBe('parent-overflow-analyzer-strategy');
    expect(strategy.issueType).toBe('layout-stability-parent-overflow');
  });

  describe('right overflow detection', () => {
    it('should detect child overflowing parent to the right', () => {
      // Before: child fits inside parent
      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
        clientWidth: 180,
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });
      // After: child extends beyond parent right edge
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 250, 80),
        clientWidth: 250,
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('layout-stability-parent-overflow');
      expect(issues[0].severity).toBe('serious');
      expect(issues[0].message).toContain('right');
    });
  });

  describe('bottom overflow detection', () => {
    it('should detect child overflowing parent downward', () => {
      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 150),
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('bottom');
    });
  });

  describe('skip conditions', () => {
    it('should skip elements without a parent', () => {
      const orphan = document.createElement('div');
      // orphan has no parent

      const before = makeSnapshot();
      const after = makeSnapshot({ boundingRect: new DOMRect(0, 0, 300, 100) });

      const beforeMap = new Map([[orphan, before]]);
      const afterMap = new Map([[orphan, after]]);

      const issues = strategy.analyze(createContext([orphan], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip parent with overflow hidden', () => {
      overflowXValue = 'hidden';
      overflowYValue = 'hidden';

      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 300, 80),
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip parent with overflow-x auto', () => {
      overflowXValue = 'auto';

      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 300, 80),
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements already overflowing parent before expansion', () => {
      // Child already extends beyond parent's right edge before expansion
      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 250, 80), // right = 260 > parent right 200
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 300, 80),
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip zero-dimension parents', () => {
      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 50, 50),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 0, 0),
        clientWidth: 0,
        clientHeight: 0,
      });
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 100, 100),
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 0, 0),
        clientWidth: 0,
        clientHeight: 0,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements with no snapshots', () => {
      const issues = strategy.analyze(createContext([child], new Map(), new Map()));
      expect(issues).toHaveLength(0);
    });

    it('should skip when overflow decreased after expansion', () => {
      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });
      // After: child actually fits better (shrunk)
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 150, 70),
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });
  });

  describe('threshold logic', () => {
    it('should use max of pixel and percent thresholds', () => {
      // Parent 200px wide: 5% = 10px threshold via percent
      // Max(10px pixel, 10px percent) = 10px effective threshold
      // But with a larger parent (1000px): 5% = 50px
      // Max(10px, 50px) = 50px effective threshold

      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 1000, 100),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 1000, 100),
        clientWidth: 1000,
        clientHeight: 100,
      });
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 1040, 100), // 40px overflow, < 50px threshold
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 1000, 100),
        clientWidth: 1000,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));
      expect(issues).toHaveLength(0); // 40px < 50px effective threshold
    });
  });

  describe('issue metadata', () => {
    it('should include overflow amounts and percentages', () => {
      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });
      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 260, 80),
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child], beforeMap, afterMap));

      expect(issues).toHaveLength(1);
      expect(issues[0].issueMetadata).toHaveProperty('overflowRight');
      expect(issues[0].issueMetadata).toHaveProperty('overflowRightPercent');
      expect(issues[0].issueMetadata).toHaveProperty('parentSelector');
      expect(issues[0].remediation).toBeDefined();
      expect(issues[0].remediation?.suggestion).toContain('flexible layouts');
    });
  });

  describe('multiple elements', () => {
    it('should analyze each element independently', () => {
      const child2 = document.createElement('span');
      parent.appendChild(child2);

      const childBefore = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
      });
      const child2Before = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80),
      });
      const parentBefore = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const childAfter = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 280, 80), // overflows
      });
      const child2After = makeSnapshot({
        boundingRect: new DOMRect(10, 10, 180, 80), // no overflow
      });
      const parentAfter = makeSnapshot({
        boundingRect: new DOMRect(0, 0, 200, 100),
        clientWidth: 200,
        clientHeight: 100,
      });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childBefore],
        [child2, child2Before],
        [parent, parentBefore],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [child, childAfter],
        [child2, child2After],
        [parent, parentAfter],
      ]);

      const issues = strategy.analyze(createContext([child, child2], beforeMap, afterMap));

      expect(issues).toHaveLength(1); // Only first child overflows
    });
  });
});
