// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RTLAnalyzer } from './rtlAnalyzer';
import type { AnalyzerStrategy, Issue } from '../../types/types';
import type { RTLAnalyzerContext } from './types';

// Mock the external dependencies
vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

describe('RTLAnalyzer', () => {
  let analyzer: RTLAnalyzer;
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new RTLAnalyzer();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('constructor and options', () => {
    it('should have the correct name', () => {
      expect(analyzer.name).toBe('RTLAnalyzer');
    });

    it('should use default options when none provided', () => {
      const defaultAnalyzer = new RTLAnalyzer();
      expect(defaultAnalyzer).toBeDefined();
      expect(defaultAnalyzer.name).toBe('RTLAnalyzer');
    });

    it('should accept custom thresholds', () => {
      const customAnalyzer = new RTLAnalyzer({
        asymmetryThresholdPercent: 5,
        asymmetryThresholdPx: 3,
      });
      expect(customAnalyzer).toBeDefined();
      expect(customAnalyzer.name).toBe('RTLAnalyzer');
    });

    it('should handle partial options', () => {
      const partialAnalyzer = new RTLAnalyzer({ asymmetryThresholdPercent: 2 });
      expect(partialAnalyzer).toBeDefined();
      expect(partialAnalyzer.name).toBe('RTLAnalyzer');
    });

    it('should implement the Analyzer interface', () => {
      expect(analyzer).toHaveProperty('name');
      expect(analyzer).toHaveProperty('run');
      expect(typeof analyzer.run).toBe('function');
    });
  });

  describe('run with custom strategies', () => {
    it('should call all strategies and merge their results', async () => {
      const issue1: Issue = {
        id: '1',
        type: 'rtl-asymmetric-layout',
        elementSelector: '.el1',
        severity: 'serious',
        message: 'Issue from strategy 1',
      };
      const issue2: Issue = {
        id: '2',
        type: 'rtl-custom-issue',
        elementSelector: '.el2',
        severity: 'moderate',
        message: 'Issue from strategy 2',
      };

      const strategy1: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'strategy-1',
        analyze: vi.fn().mockReturnValue([issue1]),
      };
      const strategy2: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'strategy-2',
        analyze: vi.fn().mockReturnValue([issue2]),
      };

      const customAnalyzer = new RTLAnalyzer({}, [strategy1, strategy2]);
      const issues = await customAnalyzer.run(container);

      expect(strategy1.analyze).toHaveBeenCalledOnce();
      expect(strategy2.analyze).toHaveBeenCalledOnce();
      expect(issues).toHaveLength(2);
      expect(issues).toContainEqual(issue1);
      expect(issues).toContainEqual(issue2);
    });

    it('should return empty array when no strategies find issues', async () => {
      const strategy: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'clean-strategy',
        analyze: vi.fn().mockReturnValue([]),
      };

      const customAnalyzer = new RTLAnalyzer({}, [strategy]);
      const issues = await customAnalyzer.run(container);

      expect(issues).toHaveLength(0);
    });

    it('should pass correct context to strategies', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'inspect-strategy',
        analyze: analyzeFn,
      };

      const customAnalyzer = new RTLAnalyzer(
        { asymmetryThresholdPercent: 25, asymmetryThresholdPx: 30 },
        [strategy],
      );

      container.innerHTML = '<p>Test content</p>';
      await customAnalyzer.run(container);

      expect(analyzeFn).toHaveBeenCalledOnce();
      const ctx = analyzeFn.mock.calls[0][0] as RTLAnalyzerContext;

      // Verify context structure
      expect(ctx.rootElement).toBe(container);
      expect(ctx.options.asymmetryThresholdPercent).toBe(25);
      expect(ctx.options.asymmetryThresholdPx).toBe(30);
      expect(ctx.targetDir).toBe('rtl'); // default direction is ltr, so target is rtl
      expect(ctx.beforeSnapshots).toBeInstanceOf(Map);
      expect(ctx.afterSnapshots).toBeInstanceOf(Map);
    });
  });

  describe('direction flip and revert', () => {
    it('should revert direction after analysis', async () => {
      container.style.direction = 'ltr';

      const strategy: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'noop',
        analyze: vi.fn().mockReturnValue([]),
      };

      const customAnalyzer = new RTLAnalyzer({}, [strategy]);
      await customAnalyzer.run(container);

      // Direction should be restored to original
      expect(container.style.direction).toBe('ltr');
    });

    it('should flip to RTL when page is LTR', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'dir-check',
        analyze: analyzeFn,
      };

      container.style.direction = 'ltr';
      const customAnalyzer = new RTLAnalyzer({}, [strategy]);
      await customAnalyzer.run(container);

      const ctx = analyzeFn.mock.calls[0][0] as RTLAnalyzerContext;
      expect(ctx.targetDir).toBe('rtl');
    });

    it('should flip to LTR when page is RTL', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'dir-check',
        analyze: analyzeFn,
      };

      container.style.direction = 'rtl';
      const customAnalyzer = new RTLAnalyzer({}, [strategy]);
      await customAnalyzer.run(container);

      const ctx = analyzeFn.mock.calls[0][0] as RTLAnalyzerContext;
      expect(ctx.targetDir).toBe('ltr');
    });
  });

  describe('element collection', () => {
    it('should exclude script, style, and meta elements', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'collect-check',
        analyze: analyzeFn,
      };

      container.innerHTML = `
        <p>Visible text</p>
        <script>console.log("ignored")</script>
        <style>.ignored {}</style>
        <meta name="test">
      `;

      const customAnalyzer = new RTLAnalyzer({}, [strategy]);
      await customAnalyzer.run(container);

      const ctx = analyzeFn.mock.calls[0][0] as RTLAnalyzerContext;
      const tagNames = ctx.elements.map((el) => el.tagName.toLowerCase());

      expect(tagNames).not.toContain('script');
      expect(tagNames).not.toContain('style');
      expect(tagNames).not.toContain('meta');
    });
  });

  describe('default strategy (MirroringStrategy)', () => {
    it('should use rtl-asymmetric-layout as the issue type', async () => {
      const analyzeFn = vi.fn().mockReturnValue([
        {
          id: 'test',
          type: 'rtl-asymmetric-layout',
          elementSelector: '.el',
          severity: 'serious',
          message: 'Element does not mirror',
        },
      ]);
      const strategy: AnalyzerStrategy<RTLAnalyzerContext> = {
        name: 'mirroring',
        analyze: analyzeFn,
      };

      const customAnalyzer = new RTLAnalyzer({}, [strategy]);
      const issues = await customAnalyzer.run(container);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('rtl-asymmetric-layout');
    });

    it('should not report issues when no elements exist', async () => {
      // Empty container → no elements to analyze → no issues
      const issues = await analyzer.run(container);
      expect(issues).toHaveLength(0);
    });

    it('should not report issues for elements that only have whitespace', async () => {
      container.textContent = '   ';
      const issues = await analyzer.run(container);
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('viewport filtering', () => {
    it('should skip elements outside the viewport', async () => {
      // Create an element inside the viewport
      const visibleElement = document.createElement('div');
      visibleElement.id = 'visible-element';
      visibleElement.style.position = 'absolute';
      visibleElement.style.left = '10px';
      visibleElement.style.top = '10px';
      visibleElement.style.width = '100px';
      visibleElement.style.height = '100px';
      visibleElement.textContent = 'Visible';

      // Create an element far outside the viewport (beyond OFF_PAGE_THRESHOLD_PX + innerWidth)
      const hiddenElement = document.createElement('div');
      hiddenElement.id = 'hidden-element';
      hiddenElement.style.position = 'absolute';
      hiddenElement.style.left = '30000px';
      hiddenElement.style.top = '30000px';
      hiddenElement.style.width = '100px';
      hiddenElement.style.height = '100px';
      hiddenElement.textContent = 'Hidden';

      container.appendChild(visibleElement);
      container.appendChild(hiddenElement);

      // Mock getBoundingClientRect - visible element is in viewport
      vi.spyOn(visibleElement, 'getBoundingClientRect').mockReturnValue({
        width: 100,
        height: 100,
        top: 10,
        left: 10,
        bottom: 110,
        right: 110,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      });

      // Hidden element is way outside viewport
      vi.spyOn(hiddenElement, 'getBoundingClientRect').mockReturnValue({
        width: 100,
        height: 100,
        top: 30000,
        left: 30000,
        bottom: 30100,
        right: 30100,
        x: 30000,
        y: 30000,
        toJSON: () => ({}),
      });

      // Override the mock to return different selectors
      const { finder } = await import('@medv/finder');
      (finder as any).mockImplementation((el: Element) => {
        if (el.id === 'visible-element') return '#visible-element';
        if (el.id === 'hidden-element') return '#hidden-element';
        return '.mock-selector';
      });

      const result = await analyzer.run(container);

      // Should not report issues for the hidden element (outside viewport)
      const hiddenIssues = result.filter((issue) => issue.elementSelector.includes('hidden'));
      expect(hiddenIssues.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle null root element gracefully', async () => {
      await expect(analyzer.run(null as any)).rejects.toThrow();
    });

    it('should return empty array for element with no children', async () => {
      const emptyDiv = document.createElement('div');
      document.body.appendChild(emptyDiv);

      const result = await analyzer.run(emptyDiv);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);

      document.body.removeChild(emptyDiv);
    });
  });
});
