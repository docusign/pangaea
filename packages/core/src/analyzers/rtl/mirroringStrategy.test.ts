// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MirroringStrategy } from './mirroringStrategy';
import type { RTLAnalyzerContext } from './types';
import type { ElementSnapshot } from '../../types/types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

vi.mock('../../utils/hasDirectTextContent', () => ({
  hasDirectTextContent: vi.fn().mockReturnValue(false),
}));

import { hasDirectTextContent } from '../../utils/hasDirectTextContent';
const mockHasDirectTextContent = vi.mocked(hasDirectTextContent);

const originalGetComputedStyle = window.getComputedStyle;
let displayValue = 'block';

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return new DOMRect(left, top, width, height);
}

function makeSnapshot(rect: DOMRect): ElementSnapshot {
  return {
    boundingRect: rect,
    scrollWidth: rect.width,
    scrollHeight: rect.height,
    clientWidth: rect.width,
    clientHeight: rect.height,
  };
}

function createContext(
  elements: HTMLElement[],
  beforeMap: Map<HTMLElement, ElementSnapshot>,
  afterMap: Map<HTMLElement, ElementSnapshot>,
  overrides: Partial<RTLAnalyzerContext> = {},
): RTLAnalyzerContext {
  const root = document.createElement('div');
  // Mock container width to 1000px for symmetry calculations
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 800));
  return {
    rootElement: root,
    elements,
    beforeSnapshots: beforeMap,
    afterSnapshots: afterMap,
    targetDir: 'rtl',
    options: {
      asymmetryThresholdPercent: 15,
      asymmetryThresholdPx: 20,
    },
    ...overrides,
  };
}

describe('MirroringStrategy', () => {
  const strategy = new MirroringStrategy();
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    element.textContent = 'Test';
    document.body.appendChild(element);
    displayValue = 'block';
    mockHasDirectTextContent.mockReturnValue(false);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) =>
        ({
          ...originalGetComputedStyle(el),
          display: displayValue,
        }) as CSSStyleDeclaration,
    );
  });

  afterEach(() => {
    document.body.removeChild(element);
    vi.restoreAllMocks();
  });

  it('should have the correct name and issueType', () => {
    expect(strategy.name).toBe('mirroring');
    expect(strategy.issueType).toBe('rtl-asymmetric-layout');
  });

  describe('position asymmetry detection', () => {
    it('should detect element that does not mirror (stays in same position)', () => {
      // Element at left:100 in LTR, stays at left:100 in RTL (doesn't mirror)
      // containerWidth=1000, right=300 → distanceFromRight=700
      // In RTL, left=100 → positionDifference = |700 - 100| = 600
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('rtl-asymmetric-layout');
      expect(issues[0].severity).toBe('serious');
      expect(issues[0].message).toContain('Position issue');
    });

    it('should NOT flag element that mirrors properly', () => {
      // Element at left:100, width:200 → right=300 → distanceFromRight=700
      // In RTL, element at left:700 → newDistanceFromLeft=700 → diff=0
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(700, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });

    it('should NOT flag element within the threshold', () => {
      // distanceFromRight = 1000 - 300 = 700
      // newDistanceFromLeft = 690 → diff = 10
      // thresholdPx = max(200*15/100, 20) = max(30, 20) = 30 → 10 < 30 → no issue
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(690, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });
  });

  describe('width and height change detection', () => {
    it('should detect width change exceeding threshold', () => {
      // Position mirrors properly, but width changes significantly
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const afterRect = makeRect(700, 0, 260, 50); // width grew from 200 → 260 (diff=60 > threshold 30)
      const after = makeSnapshot(afterRect);

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Width issue');
    });

    it('should detect height change exceeding threshold', () => {
      // Position mirrors properly, but height changes significantly
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const afterRect = makeRect(700, 0, 200, 120); // height grew from 50 → 120 (diff=70 > threshold 30)
      const after = makeSnapshot(afterRect);

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Height issue');
    });

    it('should NOT flag small width/height changes within threshold', () => {
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(700, 0, 210, 55)); // diff: 10w, 5h — both < threshold 30

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });
  });

  describe('child element skipping', () => {
    it('should skip children of problematic elements', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      document.body.appendChild(parent);

      // Parent doesn't mirror → flagged
      const parentBefore = makeSnapshot(makeRect(100, 0, 200, 50));
      const parentAfter = makeSnapshot(makeRect(100, 0, 200, 50));
      // Child wouldn't mirror either, but should be skipped
      const childBefore = makeSnapshot(makeRect(110, 10, 50, 30));
      const childAfter = makeSnapshot(makeRect(110, 10, 50, 30));

      const ctx = createContext(
        [parent, child],
        new Map([
          [parent, parentBefore],
          [child, childBefore],
        ]),
        new Map([
          [parent, parentAfter],
          [child, childAfter],
        ]),
      );

      const issues = strategy.analyze(ctx);
      // Only parent should be reported, child is skipped
      expect(issues).toHaveLength(1);

      document.body.removeChild(parent);
    });
  });

  describe('inherited shift detection', () => {
    it('should skip element whose shift matches parent shift', () => {
      const parent = document.createElement('div');
      const child = document.createElement('div');
      parent.appendChild(child);
      document.body.appendChild(parent);

      // Parent has 15px position diff (within threshold, not problematic itself)
      // containerWidth=1000, parent right=300 → distanceFromRight=700
      // parent in RTL left=685 → diff=15
      const parentBefore = makeSnapshot(makeRect(100, 0, 200, 50));
      const parentAfter = makeSnapshot(makeRect(685, 0, 200, 50));

      // Child has same ~15px diff (inherited from parent)
      // child right=250 → distanceFromRight=750
      // child in RTL left=735 → diff=15
      const childBefore = makeSnapshot(makeRect(150, 10, 100, 30));
      const childAfter = makeSnapshot(makeRect(735, 10, 100, 30));

      const ctx = createContext(
        [parent, child],
        new Map([
          [parent, parentBefore],
          [child, childBefore],
        ]),
        new Map([
          [parent, parentAfter],
          [child, childAfter],
        ]),
      );

      const issues = strategy.analyze(ctx);
      // Neither should be flagged: parent is within threshold, child inherits the shift
      expect(issues).toHaveLength(0);

      document.body.removeChild(parent);
    });
  });

  describe('inline element filtering', () => {
    it('should skip inline elements whose parent has direct text content', () => {
      displayValue = 'inline';
      mockHasDirectTextContent.mockReturnValue(true);

      // Element doesn't mirror, but is inline inside text content → skip
      const before = makeSnapshot(makeRect(100, 0, 80, 20));
      const after = makeSnapshot(makeRect(100, 0, 80, 20));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });

    it('should NOT skip block elements even if parent has text content', () => {
      displayValue = 'block';
      mockHasDirectTextContent.mockReturnValue(true);

      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(1);
    });

    it('should NOT skip inline elements whose parent has no text content', () => {
      displayValue = 'inline-block';
      mockHasDirectTextContent.mockReturnValue(false);

      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(1);
    });
  });

  describe('missing snapshots', () => {
    it('should skip elements with missing before snapshot', () => {
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map(), // no before snapshot
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });

    it('should skip elements with missing after snapshot', () => {
      const before = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map(), // no after snapshot
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });
  });

  describe('issue formatting', () => {
    it('should include remediation with docs URL and suggestion', () => {
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(1);
      expect(issues[0].remediation).toBeDefined();
      expect(issues[0].remediation?.docsUrl).toContain('CSS_Logical_Properties');
      expect(issues[0].remediation?.suggestion).toContain('logical CSS properties');
    });

    it('should generate a UUID for each issue', () => {
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues[0].id).toBeDefined();
      expect(typeof issues[0].id).toBe('string');
      expect(issues[0].id.length).toBeGreaterThan(0);
    });

    it('should format message with original and target direction', () => {
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
        { targetDir: 'rtl' },
      );

      const issues = strategy.analyze(ctx);
      expect(issues[0].message).toContain('LTR');
      expect(issues[0].message).toContain('RTL');
    });

    it('should format correctly when target direction is LTR', () => {
      const before = makeSnapshot(makeRect(100, 0, 200, 50));
      const after = makeSnapshot(makeRect(100, 0, 200, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
        { targetDir: 'ltr' },
      );

      const issues = strategy.analyze(ctx);
      expect(issues[0].message).toContain('RTL to LTR');
    });
  });

  describe('edge cases', () => {
    it('should return empty array when no elements provided', () => {
      const ctx = createContext([], new Map(), new Map());
      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });

    it('should use asymmetryThresholdPx as floor for small elements', () => {
      // Small element: width=20px → percent threshold = 20*15/100 = 3px
      // Floor threshold = max(3, 20) = 20px
      // Position diff of 15px should NOT be flagged (15 < 20)
      const before = makeSnapshot(makeRect(490, 0, 20, 20));
      // distanceFromRight = 1000 - 510 = 490, newDistFromLeft = 475 → diff = 15
      const after = makeSnapshot(makeRect(475, 0, 20, 20));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });

    it('should use percentage threshold for large elements when it exceeds px threshold', () => {
      // Large element: width=400px → percent threshold = 400*15/100 = 60px
      // Floor threshold = max(60, 20) = 60px
      // Position diff of 50px should NOT be flagged (50 < 60)
      const before = makeSnapshot(makeRect(100, 0, 400, 50));
      // distanceFromRight = 1000 - 500 = 500, newDistFromLeft = 450 → diff = 50
      const after = makeSnapshot(makeRect(450, 0, 400, 50));

      const ctx = createContext(
        [element],
        new Map([[element, before]]),
        new Map([[element, after]]),
      );

      const issues = strategy.analyze(ctx);
      expect(issues).toHaveLength(0);
    });
  });
});
