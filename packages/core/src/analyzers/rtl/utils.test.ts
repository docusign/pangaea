// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import {
  computeAsymmetryThreshold,
  computeMirrorPositionDrift,
  findNearestTrackedAncestorDrift,
  isShiftInheritedFromParent,
  shouldSkipInlineElement,
} from './utils';

describe('computeAsymmetryThreshold', () => {
  it('should use percentage for large elements when it exceeds px floor', () => {
    // 400px wide, 15% threshold → 60px > 20px floor
    expect(computeAsymmetryThreshold(400, 15, 20)).toBe(60);
  });

  it('should use px floor for small elements when percentage is tiny', () => {
    // 20px wide, 15% threshold → 3px < 20px floor
    expect(computeAsymmetryThreshold(20, 15, 20)).toBe(20);
  });

  it('should return px floor when element has zero width', () => {
    expect(computeAsymmetryThreshold(0, 15, 20)).toBe(20);
  });

  it('should return exact percentage when it equals px floor', () => {
    // 200px wide, 10% threshold → 20px == 20px floor
    expect(computeAsymmetryThreshold(200, 10, 20)).toBe(20);
  });

  it('should handle fractional results', () => {
    // 150px wide, 15% → 22.5px > 20px floor
    expect(computeAsymmetryThreshold(150, 15, 20)).toBe(22.5);
  });
});

describe('computeMirrorPositionDrift', () => {
  it('should return 0 for a perfectly mirrored element', () => {
    // Container 1000px, element right=300 → distFromRight=700, afterLeft=700
    expect(computeMirrorPositionDrift(1000, 300, 700)).toBe(0);
  });

  it('should detect element that stays in place (does not mirror)', () => {
    // Container 1000px, element right=300 → distFromRight=700, afterLeft=100
    expect(computeMirrorPositionDrift(1000, 300, 100)).toBe(600);
  });

  it('should detect partial mirroring', () => {
    // Container 1000px, element right=300 → distFromRight=700, afterLeft=680
    expect(computeMirrorPositionDrift(1000, 300, 680)).toBe(20);
  });

  it('should handle element at container edge', () => {
    // Element flush right: right=1000 → distFromRight=0, afterLeft=0 → perfect mirror
    expect(computeMirrorPositionDrift(1000, 1000, 0)).toBe(0);
  });

  it('should handle element flush left', () => {
    // Element flush left: right=200 → distFromRight=800, afterLeft=800
    expect(computeMirrorPositionDrift(1000, 200, 800)).toBe(0);
  });
});

describe('isShiftInheritedFromParent', () => {
  it('should return true when child drift matches parent drift within tolerance', () => {
    expect(isShiftInheritedFromParent(15, 15, 20)).toBe(true);
  });

  it('should return true when drift difference is just under tolerance', () => {
    expect(isShiftInheritedFromParent(30, 12, 20)).toBe(true); // |30-12|=18 < 20
  });

  it('should return false when drift difference exceeds tolerance', () => {
    expect(isShiftInheritedFromParent(50, 10, 20)).toBe(false); // |50-10|=40 > 20
  });

  it('should return false when parent drift is undefined (no parent tracked)', () => {
    expect(isShiftInheritedFromParent(15, undefined, 20)).toBe(false);
  });

  it('should return false when drift difference exactly equals tolerance', () => {
    // Boundary: |30-10|=20, not strictly less than 20
    expect(isShiftInheritedFromParent(30, 10, 20)).toBe(false);
  });

  it('should handle zero drifts', () => {
    expect(isShiftInheritedFromParent(0, 0, 20)).toBe(true);
  });
});

describe('findNearestTrackedAncestorDrift', () => {
  it('should return immediate parent drift when tracked', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);

    const drifts = new Map<HTMLElement, number>([[parent, 42]]);
    expect(findNearestTrackedAncestorDrift(child, drifts)).toBe(42);
  });

  it('should skip untracked intermediate elements', () => {
    const grandparent = document.createElement('div');
    const parent = document.createElement('div');
    const child = document.createElement('div');
    grandparent.appendChild(parent);
    parent.appendChild(child);

    const drifts = new Map<HTMLElement, number>([[grandparent, 30]]);
    expect(findNearestTrackedAncestorDrift(child, drifts)).toBe(30);
  });

  it('should return undefined when no ancestor is tracked', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);

    const drifts = new Map<HTMLElement, number>();
    expect(findNearestTrackedAncestorDrift(child, drifts)).toBeUndefined();
  });

  it('should return nearest ancestor drift, not a more distant one', () => {
    const grandparent = document.createElement('div');
    const parent = document.createElement('div');
    const child = document.createElement('div');
    grandparent.appendChild(parent);
    parent.appendChild(child);

    const drifts = new Map<HTMLElement, number>([
      [grandparent, 100],
      [parent, 50],
    ]);
    expect(findNearestTrackedAncestorDrift(child, drifts)).toBe(50);
  });

  it('should return undefined for element with no parent', () => {
    const orphan = document.createElement('div');
    const drifts = new Map<HTMLElement, number>();
    expect(findNearestTrackedAncestorDrift(orphan, drifts)).toBeUndefined();
  });
});

describe('shouldSkipInlineElement', () => {
  it('should return true for inline element with text-content parent', () => {
    const parent = document.createElement('p');
    parent.textContent = 'Hello ';
    const child = document.createElement('span');
    parent.appendChild(child);

    expect(shouldSkipInlineElement(child, 'inline')).toBe(true);
  });

  it('should return true for inline-block element with text-content parent', () => {
    const parent = document.createElement('p');
    parent.textContent = 'Text ';
    const child = document.createElement('span');
    parent.appendChild(child);

    expect(shouldSkipInlineElement(child, 'inline-block')).toBe(true);
  });

  it('should return false for block element even with text-content parent', () => {
    const parent = document.createElement('div');
    parent.textContent = 'Text';
    const child = document.createElement('div');
    parent.appendChild(child);

    expect(shouldSkipInlineElement(child, 'block')).toBe(false);
  });

  it('should return false for inline element without parent', () => {
    const orphan = document.createElement('span');
    expect(shouldSkipInlineElement(orphan, 'inline')).toBe(false);
  });

  it('should return false for inline element whose parent has no direct text', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    expect(shouldSkipInlineElement(child, 'inline')).toBe(false);
  });
});
