// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SelfOverflowAnalyzerStrategy } from './selfOverflowAnalyzerStrategy';
import type { LayoutStabilityAnalyzerContext, ElementSnapshot } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

vi.mock('../../utils/hasDirectTextContent', () => ({
  hasDirectTextContent: vi.fn().mockReturnValue(true),
}));

import { hasDirectTextContent } from '../../utils/hasDirectTextContent';
const mockHasDirectTextContent = vi.mocked(hasDirectTextContent);

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

describe('SelfOverflowAnalyzerStrategy', () => {
  const strategy = new SelfOverflowAnalyzerStrategy();
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    element.textContent = 'Test text';
    document.body.appendChild(element);
    mockHasDirectTextContent.mockReturnValue(true);
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
    expect(strategy.name).toBe('self-overflow-analyzer-strategy');
    expect(strategy.issueType).toBe('layout-stability-self-overflow');
  });

  describe('horizontal overflow detection', () => {
    it('should detect horizontal overflow exceeding both thresholds', () => {
      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 250, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('layout-stability-self-overflow');
      expect(issues[0].severity).toBe('serious');
      expect(issues[0].message).toContain('Horizontal overflow');
      expect(issues[0].message).toContain('50px');
    });

    it('should not detect horizontal overflow below pixel threshold', () => {
      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 205, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      // 5px overflow, pixel threshold is 10
      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should not detect horizontal overflow below percent threshold', () => {
      const before = makeSnapshot({ scrollWidth: 1000, clientWidth: 1000 });
      const after = makeSnapshot({ scrollWidth: 1015, clientWidth: 1000 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      // 15px overflow, but only 1.5% of 1000px — below 5% threshold
      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });
  });

  describe('vertical overflow detection', () => {
    it('should detect vertical overflow exceeding both thresholds', () => {
      const before = makeSnapshot({ scrollHeight: 100, clientHeight: 100 });
      const after = makeSnapshot({ scrollHeight: 130, clientHeight: 100 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Vertical overflow');
      expect(issues[0].message).toContain('30px');
    });
  });

  describe('combined overflow', () => {
    it('should report both horizontal and vertical overflow in one issue', () => {
      const before = makeSnapshot({
        scrollWidth: 200,
        clientWidth: 200,
        scrollHeight: 100,
        clientHeight: 100,
      });
      const after = makeSnapshot({
        scrollWidth: 260,
        clientWidth: 200,
        scrollHeight: 130,
        clientHeight: 100,
      });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Horizontal overflow');
      expect(issues[0].message).toContain('Vertical overflow');
    });
  });

  describe('skip conditions', () => {
    it('should skip elements without direct text content', () => {
      mockHasDirectTextContent.mockReturnValue(false);

      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 300, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements with overflow-x hidden', () => {
      overflowXValue = 'hidden';

      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 300, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements with overflow-y scroll', () => {
      overflowYValue = 'scroll';

      const before = makeSnapshot({ scrollHeight: 100, clientHeight: 100 });
      const after = makeSnapshot({ scrollHeight: 200, clientHeight: 100 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements with overflow auto', () => {
      overflowXValue = 'auto';
      overflowYValue = 'auto';

      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 300, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements with no snapshots', () => {
      const issues = strategy.analyze(createContext([element], new Map(), new Map()));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements where overflow decreased', () => {
      const before = makeSnapshot({ scrollWidth: 250, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 220, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });

    it('should skip elements that already had overflow before expansion', () => {
      // Already overflowing by 50px before, same after — no NEW overflow
      const before = makeSnapshot({ scrollWidth: 250, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 250, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));
      expect(issues).toHaveLength(0);
    });
  });

  describe('issue metadata', () => {
    it('should include overflow deltas and percentages in metadata', () => {
      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 260, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));

      expect(issues[0].issueMetadata).toMatchObject({
        overflowXDelta: 60,
        overflowYDelta: 0,
        overflowXPercent: 30,
        overflowYPercent: 0,
      });
    });

    it('should include remediation info', () => {
      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 260, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      const issues = strategy.analyze(createContext([element], beforeMap, afterMap));

      expect(issues[0].remediation).toBeDefined();
      expect(issues[0].remediation?.docsUrl).toContain('flexbox');
      expect(issues[0].remediation?.suggestion).toContain('fixed widths');
    });
  });

  describe('multiple elements', () => {
    it('should analyze multiple elements independently', () => {
      const element2 = document.createElement('div');
      element2.textContent = 'More text';
      document.body.appendChild(element2);

      const before1 = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after1 = makeSnapshot({ scrollWidth: 260, clientWidth: 200 });
      const before2 = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after2 = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });

      const beforeMap = new Map<HTMLElement, ElementSnapshot>([
        [element, before1],
        [element2, before2],
      ]);
      const afterMap = new Map<HTMLElement, ElementSnapshot>([
        [element, after1],
        [element2, after2],
      ]);

      const issues = strategy.analyze(createContext([element, element2], beforeMap, afterMap));

      expect(issues).toHaveLength(1); // Only element1 overflows

      document.body.removeChild(element2);
    });
  });

  describe('custom thresholds', () => {
    it('should respect custom pixel threshold', () => {
      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 215, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      // 15px, 7.5% — with default thresholds (10px, 5%) this would be flagged
      const issues = strategy.analyze(
        createContext([element], beforeMap, afterMap, { overflowDeltaPixelThreshold: 20 }),
      );
      expect(issues).toHaveLength(0);
    });

    it('should respect custom percent threshold', () => {
      const before = makeSnapshot({ scrollWidth: 200, clientWidth: 200 });
      const after = makeSnapshot({ scrollWidth: 215, clientWidth: 200 });

      const beforeMap = new Map([[element, before]]);
      const afterMap = new Map([[element, after]]);

      // 15px, 7.5% — with custom 10% threshold it would NOT be flagged
      const issues = strategy.analyze(
        createContext([element], beforeMap, afterMap, { overflowDeltaPercentThreshold: 10 }),
      );
      expect(issues).toHaveLength(0);
    });
  });
});
