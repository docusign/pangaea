// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi } from 'vitest';
import { ReactPropsStrategy } from './reactPropsStrategy';
import type { IMEAnalyzerContext } from './types';

vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

function createContext(elements: HTMLElement[]): IMEAnalyzerContext {
  return {
    rootElement: document.createElement('div'),
    elements,
    options: {
      getEventListeners: () => ({}),
    },
  };
}

function attachReactProps(element: HTMLElement, props: Record<string, unknown>): void {
  (element as unknown as Record<string, unknown>)['__reactProps$abc123'] = props;
}

function attachReactFiber(element: HTMLElement, memoizedProps: Record<string, unknown>): void {
  (element as unknown as Record<string, unknown>)['__reactFiber$abc123'] = { memoizedProps };
}

describe('ReactPropsStrategy', () => {
  const strategy = new ReactPropsStrategy();

  it('should have the correct name', () => {
    expect(strategy.name).toBe('ReactPropsStrategy');
  });

  describe('React props detection', () => {
    it('should flag onKeyDown handler without isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onKeyDown: function handler(e: KeyboardEvent) {
          e.preventDefault();
        },
      });

      const issues = strategy.analyze(createContext([input]));

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('ime-missing-isComposing-check');
      expect(issues[0].message).toContain('keydown');

      document.body.removeChild(input);
    });

    it('should flag onInput handler without isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onInput: function handler() {},
      });

      const issues = strategy.analyze(createContext([input]));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('input');

      document.body.removeChild(input);
    });

    it('should not flag handler that checks isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onKeyDown: function handler(e: KeyboardEvent) {
          if (e.isComposing) return;
          e.preventDefault();
        },
      });

      const issues = strategy.analyze(createContext([input]));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should skip elements without React props', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const issues = strategy.analyze(createContext([input]));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should flag multiple handlers missing isComposing on same element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onKeyDown: function handler() {},
        onInput: function handler() {},
      });

      const issues = strategy.analyze(createContext([input]));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('keydown');
      expect(issues[0].message).toContain('input');

      document.body.removeChild(input);
    });

    it('should check onBeforeInput handlers', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onBeforeInput: function handler() {},
      });

      const issues = strategy.analyze(createContext([input]));

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('beforeinput');

      document.body.removeChild(input);
    });

    it('should ignore non-keyboard/input React props', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onClick: function handler() {},
        onFocus: function handler() {},
      });

      const issues = strategy.analyze(createContext([input]));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should flag onChange handler without isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onChange: function handler() {},
      });

      const issues = strategy.analyze(createContext([input]));

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('ime-missing-isComposing-check');
      expect(issues[0].message).toContain('change');

      document.body.removeChild(input);
    });

    it('should not flag onChange handler that checks isComposing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactProps(input, {
        onChange: function handler(e: { nativeEvent: { isComposing: boolean } }) {
          if (e.nativeEvent.isComposing) return;
        },
      });

      const issues = strategy.analyze(createContext([input]));
      expect(issues).toHaveLength(0);

      document.body.removeChild(input);
    });
  });

  describe('React fiber fallback', () => {
    it('should detect handlers from __reactFiber$ memoizedProps', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      attachReactFiber(input, {
        onKeyDown: function handler(e: KeyboardEvent) {
          e.preventDefault();
        },
      });

      const issues = strategy.analyze(createContext([input]));

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('ime-missing-isComposing-check');

      document.body.removeChild(input);
    });
  });

  it('should include remediation info', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    attachReactProps(input, {
      onKeyDown: function handler() {},
    });

    const issues = strategy.analyze(createContext([input]));

    expect(issues[0].remediation).toBeDefined();
    expect(issues[0].remediation?.docsUrl).toContain('isComposing');
    expect(issues[0].remediation?.suggestion).toContain('isComposing');

    document.body.removeChild(input);
  });

  it('should return empty array when no elements', () => {
    const issues = strategy.analyze(createContext([]));
    expect(issues).toHaveLength(0);
  });
});
