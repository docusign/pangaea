// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IMEAnalyzer } from './imeAnalyzer';
import type { AnalyzerStrategy, Issue } from '../../types/types';
import type { IMEAnalyzerContext, GetEventListenersFn } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

vi.mock('../../utils/isAnalyzableElement', () => ({
  isAnalyzableElement: vi.fn().mockReturnValue(true),
}));

const emptyGetEventListeners: GetEventListenersFn = () => ({});

describe('IMEAnalyzer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('constructor and options', () => {
    it('should have the correct name', () => {
      const analyzer = new IMEAnalyzer({ getEventListeners: emptyGetEventListeners });
      expect(analyzer.name).toBe('IMEAnalyzer');
    });

    it('should accept getEventListeners option', () => {
      const mockFn: GetEventListenersFn = () => ({});
      const analyzer = new IMEAnalyzer({ getEventListeners: mockFn });
      expect(analyzer).toBeDefined();
    });

    it('should implement the Analyzer interface', () => {
      const analyzer = new IMEAnalyzer({ getEventListeners: emptyGetEventListeners });
      expect(analyzer).toHaveProperty('name');
      expect(analyzer).toHaveProperty('run');
      expect(typeof analyzer.run).toBe('function');
    });
  });

  describe('run with default strategy', () => {
    it('should return no issues when no event listeners are registered', async () => {
      container.innerHTML = `
        <input type="text" />
        <textarea></textarea>
      `;

      const analyzer = new IMEAnalyzer({ getEventListeners: emptyGetEventListeners });
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(0);
    });

    it('should detect handlers missing isComposing check', async () => {
      container.innerHTML = '<input type="text" />';

      const mockGetEventListeners: GetEventListenersFn = vi.fn().mockReturnValue({
        keydown: [
          {
            listener: function handler(e: KeyboardEvent) {
              e.preventDefault();
            },
          },
        ],
      });

      const analyzer = new IMEAnalyzer({ getEventListeners: mockGetEventListeners });
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('ime-missing-isComposing-check');
    });

    it('should not flag handlers with isComposing check', async () => {
      container.innerHTML = '<input type="text" />';

      const mockGetEventListeners: GetEventListenersFn = vi.fn().mockReturnValue({
        keydown: [
          {
            listener: function handler(e: KeyboardEvent) {
              if (e.isComposing) return;
              e.preventDefault();
            },
          },
        ],
      });

      const analyzer = new IMEAnalyzer({ getEventListeners: mockGetEventListeners });
      const issues = await analyzer.run(container);

      expect(issues).toHaveLength(0);
    });
  });

  describe('run with custom strategies', () => {
    it('should call all strategies and merge results', async () => {
      const issue1: Issue = {
        id: '1',
        type: 'ime-missing-isComposing-check',
        elementSelector: '.el',
        severity: 'critical',
        message: 'Handler issue 1',
      };
      const issue2: Issue = {
        id: '2',
        type: 'ime-missing-isComposing-check',
        elementSelector: '.el2',
        severity: 'critical',
        message: 'Handler issue 2',
      };

      const strategy1: AnalyzerStrategy<IMEAnalyzerContext> = {
        name: 'strategy-1',
        analyze: vi.fn().mockReturnValue([issue1]),
      };
      const strategy2: AnalyzerStrategy<IMEAnalyzerContext> = {
        name: 'strategy-2',
        analyze: vi.fn().mockReturnValue([issue2]),
      };

      container.innerHTML = '<input type="text" />';
      const analyzer = new IMEAnalyzer({ getEventListeners: emptyGetEventListeners }, [
        strategy1,
        strategy2,
      ]);
      const issues = await analyzer.run(container);

      expect(strategy1.analyze).toHaveBeenCalledOnce();
      expect(strategy2.analyze).toHaveBeenCalledOnce();
      expect(issues).toHaveLength(2);
    });

    it('should pass correct context to strategies', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<IMEAnalyzerContext> = {
        name: 'inspect',
        analyze: analyzeFn,
      };

      const mockGEL: GetEventListenersFn = () => ({});
      container.innerHTML = '<input type="text" /><textarea></textarea>';
      const analyzer = new IMEAnalyzer({ getEventListeners: mockGEL }, [strategy]);
      await analyzer.run(container);

      const ctx = analyzeFn.mock.calls[0][0] as IMEAnalyzerContext;
      expect(ctx.rootElement).toBe(container);
      expect(ctx.elements).toHaveLength(2);
      expect(ctx.options.getEventListeners).toBe(mockGEL);
    });
  });

  describe('element collection', () => {
    it('should find text inputs and textareas', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<IMEAnalyzerContext> = {
        name: 'collect',
        analyze: analyzeFn,
      };

      container.innerHTML = `
        <input type="text" />
        <input type="search" />
        <input type="email" />
        <input type="url" />
        <input type="tel" />
        <input type="password" />
        <textarea></textarea>
        <input type="checkbox" />
        <input type="number" />
        <input type="button" />
      `;

      const analyzer = new IMEAnalyzer({ getEventListeners: emptyGetEventListeners }, [strategy]);
      await analyzer.run(container);

      const ctx = analyzeFn.mock.calls[0][0] as IMEAnalyzerContext;
      // text, search, email, url, tel, password, textarea = 7
      expect(ctx.elements).toHaveLength(7);
    });

    it('should find contenteditable elements', async () => {
      const analyzeFn = vi.fn().mockReturnValue([]);
      const strategy: AnalyzerStrategy<IMEAnalyzerContext> = {
        name: 'collect',
        analyze: analyzeFn,
      };

      container.innerHTML = `
        <div contenteditable="true"></div>
        <span contenteditable=""></span>
        <p contenteditable="false"></p>
        <input type="text" />
      `;

      const analyzer = new IMEAnalyzer({ getEventListeners: emptyGetEventListeners }, [strategy]);
      await analyzer.run(container);

      const ctx = analyzeFn.mock.calls[0][0] as IMEAnalyzerContext;
      // contenteditable="true", contenteditable="", input[type=text] = 3
      expect(ctx.elements).toHaveLength(3);
    });

    it('should return empty array for container with no inputs', async () => {
      container.innerHTML = '<p>No inputs here</p>';

      const analyzer = new IMEAnalyzer({ getEventListeners: emptyGetEventListeners });
      const issues = await analyzer.run(container);
      expect(issues).toHaveLength(0);
    });
  });

  describe('getEventListeners integration', () => {
    it('should call getEventListeners for each element', async () => {
      container.innerHTML = '<input type="text" /><textarea></textarea>';

      const mockGetEventListeners: GetEventListenersFn = vi.fn().mockReturnValue({});

      const analyzer = new IMEAnalyzer({ getEventListeners: mockGetEventListeners });
      await analyzer.run(container);

      expect(mockGetEventListeners).toHaveBeenCalledTimes(2);
    });

    it('should detect programmatic handlers missing isComposing check', async () => {
      container.innerHTML = '<input type="text" />';

      const mockGetEventListeners: GetEventListenersFn = vi.fn().mockReturnValue({
        keydown: [
          {
            listener: function handler(e: KeyboardEvent) {
              e.preventDefault();
            },
          },
        ],
      });

      const analyzer = new IMEAnalyzer({ getEventListeners: mockGetEventListeners });
      const issues = await analyzer.run(container);

      expect(mockGetEventListeners).toHaveBeenCalled();
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('ime-missing-isComposing-check');
    });
  });
});
