// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LayoutStabilityAnalyzer } from './layoutStabilityAnalyzer';
import type { AnalyzerStrategy, Issue } from '../../types/types';
import type { LayoutStabilityAnalyzerContext } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

vi.mock('../../utils/pseudolocalizeText', () => ({
  pseudolocalizeText: vi.fn((text: string) => text + '___expanded'),
}));

describe('LayoutStabilityAnalyzer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should have the correct name', () => {
      const analyzer = new LayoutStabilityAnalyzer();
      expect(analyzer.name).toBe('LayoutStabilityAnalyzer');
    });

    it('should use default strategies when none provided', () => {
      const analyzer = new LayoutStabilityAnalyzer();
      expect(analyzer).toBeDefined();
    });

    it('should accept custom options', () => {
      const analyzer = new LayoutStabilityAnalyzer({
        overflowDeltaPercentThreshold: 10,
        overflowDeltaPixelThreshold: 20,
      });
      expect(analyzer).toBeDefined();
    });

    it('should accept custom strategies', () => {
      const customStrategy: AnalyzerStrategy<LayoutStabilityAnalyzerContext> = {
        name: 'custom',
        analyze: vi.fn().mockReturnValue([]),
      };
      const analyzer = new LayoutStabilityAnalyzer({}, [customStrategy]);
      expect(analyzer).toBeDefined();
    });
  });

  describe('run', () => {
    it('should return empty array for container with no elements', async () => {
      container.innerHTML = '';

      const analyzer = new LayoutStabilityAnalyzer();
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(0);
    });

    it('should call strategies and return merged issues', async () => {
      const issue1: Issue = {
        id: '1',
        type: 'layout-stability-self-overflow',
        elementSelector: '.el1',
        severity: 'serious',
        message: 'Self overflow',
      };
      const issue2: Issue = {
        id: '2',
        type: 'layout-stability-parent-overflow',
        elementSelector: '.el2',
        severity: 'serious',
        message: 'Parent overflow',
      };

      const strategy1: AnalyzerStrategy<LayoutStabilityAnalyzerContext> = {
        name: 'strategy-1',
        analyze: vi.fn().mockReturnValue([issue1]),
      };
      const strategy2: AnalyzerStrategy<LayoutStabilityAnalyzerContext> = {
        name: 'strategy-2',
        analyze: vi.fn().mockReturnValue([issue2]),
      };

      container.innerHTML = '<div>Some text</div>';

      const analyzer = new LayoutStabilityAnalyzer({}, [strategy1, strategy2]);
      const issues = await analyzer.run(container);

      expect(strategy1.analyze).toHaveBeenCalledOnce();
      expect(strategy2.analyze).toHaveBeenCalledOnce();
      expect(issues).toHaveLength(2);
      expect(issues).toContainEqual(issue1);
      expect(issues).toContainEqual(issue2);
    });

    it('should pass context with correct shape to strategies', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<LayoutStabilityAnalyzerContext> = {
        name: 'inspect',
        analyze: analyzeFn,
      };

      container.innerHTML = '<p>Hello world</p>';

      const analyzer = new LayoutStabilityAnalyzer(
        { overflowDeltaPercentThreshold: 8, overflowDeltaPixelThreshold: 15 },
        [strategy],
      );
      await analyzer.run(container);

      expect(analyzeFn).toHaveBeenCalledOnce();
      const ctx = analyzeFn.mock.calls[0][0] as LayoutStabilityAnalyzerContext;
      expect(ctx.rootElement).toBe(container);
      expect(ctx.elements).toBeDefined();
      expect(ctx.beforeSnapshots).toBeInstanceOf(Map);
      expect(ctx.afterSnapshots).toBeInstanceOf(Map);
      expect(ctx.options.overflowDeltaPercentThreshold).toBe(8);
      expect(ctx.options.overflowDeltaPixelThreshold).toBe(15);
    });

    it('should collect elements excluding non-visual elements', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<LayoutStabilityAnalyzerContext> = {
        name: 'collect',
        analyze: analyzeFn,
      };

      container.innerHTML = `
        <div>Visible text</div>
        <script>console.log('ignored')</script>
        <style>.ignored{}</style>
        <p>Another visible</p>
      `;

      const analyzer = new LayoutStabilityAnalyzer({}, [strategy]);
      await analyzer.run(container);

      const ctx = analyzeFn.mock.calls[0][0] as LayoutStabilityAnalyzerContext;
      // Should include container + div + p (script and style excluded)
      // Exact count depends on isAnalyzableElement filter, but scripts/styles should be excluded
      const tagNames = ctx.elements.map((el) => el.tagName.toLowerCase());
      expect(tagNames).not.toContain('script');
      expect(tagNames).not.toContain('style');
    });

    it('should revert pseudolocalization after analysis', async () => {
      const strategy: AnalyzerStrategy<LayoutStabilityAnalyzerContext> = {
        name: 'noop',
        analyze: vi.fn().mockReturnValue([]),
      };

      container.innerHTML = '<p>Original text</p>';
      const originalText = container.querySelector('p')!.textContent;

      const analyzer = new LayoutStabilityAnalyzer({}, [strategy]);
      await analyzer.run(container);

      // Text should be reverted to original
      expect(container.querySelector('p')!.textContent).toBe(originalText);
    });

    it('should handle strategy returning empty array', async () => {
      const strategy: AnalyzerStrategy<LayoutStabilityAnalyzerContext> = {
        name: 'empty',
        analyze: vi.fn().mockReturnValue([]),
      };

      container.innerHTML = '<div>Text</div>';
      const analyzer = new LayoutStabilityAnalyzer({}, [strategy]);
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(0);
    });
  });

  describe('implements Analyzer interface', () => {
    it('should have name and run method', () => {
      const analyzer = new LayoutStabilityAnalyzer();
      expect(typeof analyzer.name).toBe('string');
      expect(typeof analyzer.run).toBe('function');
    });
  });
});
