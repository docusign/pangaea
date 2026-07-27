// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi } from 'vitest';
import { EventHandlerStrategy } from './eventHandlerStrategy';
import type { IMEAnalyzerContext, GetEventListenersFn } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

function createContext(
  elements: HTMLElement[],
  getEventListeners: GetEventListenersFn,
): IMEAnalyzerContext {
  return {
    rootElement: document.createElement('div'),
    elements,
    options: {
      getEventListeners,
    },
  };
}

/** Helper: getEventListeners that returns nothing */
const emptyGetEventListeners: GetEventListenersFn = () => ({});

describe('EventHandlerStrategy', () => {
  const strategy = new EventHandlerStrategy();

  it('should have the correct name', () => {
    expect(strategy.name).toBe('EventHandlerStrategy');
  });

  describe('handler detection', () => {
    it('should flag keydown handler without isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        keydown: [
          {
            listener: function handler(e: KeyboardEvent) {
              e.preventDefault();
            } as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('ime-missing-isComposing-check');
      expect(issues[0].severity).toBe('critical');
      expect(issues[0].message).toContain('keydown');

      document.body.removeChild(input);
    });

    it('should flag input handler without isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        input: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('ime-missing-isComposing-check');
      expect(issues[0].message).toContain('input');

      document.body.removeChild(input);
    });

    it('should not flag handler that checks isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        keydown: [
          {
            listener: function handler(e: KeyboardEvent) {
              if (e.isComposing) return;
              e.preventDefault();
            } as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should not flag element without handlers', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const issues = strategy.analyze(createContext([input], emptyGetEventListeners));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should flag multiple handlers missing isComposing on same element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        keydown: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
        input: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('keydown');
      expect(issues[0].message).toContain('input');

      document.body.removeChild(input);
    });

    it('should check beforeinput handlers', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        beforeinput: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('beforeinput');

      document.body.removeChild(input);
    });
  });

  describe('error handling', () => {
    it('should handle getEventListeners throwing an error', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => {
        throw new Error('Not available');
      };

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });
  });

  describe('composition event listener detection', () => {
    it('should not flag element that has compositionstart listener', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        keydown: [
          {
            listener: function handler(e: KeyboardEvent) {
              e.preventDefault();
            } as unknown as (...args: unknown[]) => void,
          },
        ],
        compositionstart: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should not flag element that has compositionend listener', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        input: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
        compositionend: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should still flag element with empty composition listener arrays', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        keydown: [
          {
            listener: function handler() {} as unknown as (...args: unknown[]) => void,
          },
        ],
        compositionstart: [],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));
      expect(issues).toHaveLength(1);

      document.body.removeChild(input);
    });
  });

  describe('event type deduplication', () => {
    it('should not duplicate event types when multiple handlers for same event lack isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const mockGetEventListeners: GetEventListenersFn = () => ({
        keydown: [
          {
            listener: function handler1() {} as unknown as (...args: unknown[]) => void,
          },
          {
            listener: function handler2() {} as unknown as (...args: unknown[]) => void,
          },
        ],
      });

      const issues = strategy.analyze(createContext([input], mockGetEventListeners));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(
        'Input may break IME composition for CJK languages. Missing isComposing check in: keydown handler',
      );

      document.body.removeChild(input);
    });
  });

  it('should include remediation info', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const mockGetEventListeners: GetEventListenersFn = () => ({
      keydown: [
        {
          listener: function handler() {} as unknown as (...args: unknown[]) => void,
        },
      ],
    });

    const issues = strategy.analyze(createContext([input], mockGetEventListeners));

    expect(issues[0].remediation).toBeDefined();
    expect(issues[0].remediation?.docsUrl).toContain('isComposing');
    expect(issues[0].remediation?.suggestion).toContain('isComposing');

    document.body.removeChild(input);
  });

  it('should return empty array when no elements', () => {
    const issues = strategy.analyze(createContext([], emptyGetEventListeners));
    expect(issues).toHaveLength(0);
  });
});
