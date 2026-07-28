// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, RawIssue, AnalyzerStrategy } from '../../types/types';
import type { IMEAnalyzerContext } from './types';
import { safeFinder } from '../../utils/safeFinder';

const REACT_EVENT_PROPS: Record<string, string> = {
  onKeyDown: 'keydown',
  onKeyUp: 'keyup',
  onKeyPress: 'keypress',
  onInput: 'input',
  onBeforeInput: 'beforeinput',
  // React's onChange is aliased to the native input event and fires on every
  // keystroke, so it can run mid-composition and needs the isComposing guard.
  onChange: 'change',
};

/**
 * Strategy that detects React event handlers on input elements that are missing
 * an `event.isComposing` check, which can break IME composition for CJK languages.
 *
 * Accesses React's internal fiber/props on DOM elements to inspect handler source
 * for the isComposing guard. Works with React 16+ (__reactInternalInstance$),
 * React 17+ (__reactProps$), and React 18+ (__reactFiber$).
 */
export class ReactPropsStrategy implements AnalyzerStrategy<IMEAnalyzerContext> {
  readonly name = 'ReactPropsStrategy';
  readonly issueType = 'ime-missing-isComposing-check';

  /**
   * Detects IME issues and returns formatted issues.
   * Internally separates detection (`detect`) from presentation (`formatIssue`).
   */
  analyze(context: IMEAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  /**
   * Pure detection — one issue per element, collecting all React handlers missing isComposing.
   */
  private detect(context: IMEAnalyzerContext): RawIssue[] {
    const issues: RawIssue[] = [];

    for (const element of context.elements) {
      const props = this.getReactProps(element);
      if (!props) continue;

      const failingEventTypes: string[] = [];

      for (const [propName, eventType] of Object.entries(REACT_EVENT_PROPS)) {
        const handler = props[propName];
        if (typeof handler !== 'function') continue;

        const source = handler.toString();
        if (!/isComposing/.test(source)) {
          failingEventTypes.push(eventType);
        }
      }

      if (failingEventTypes.length > 0) {
        issues.push({
          type: this.issueType,
          severity: 'critical',
          elementSelector: safeFinder(element),
          issueMetadata: { eventTypes: failingEventTypes },
        });
      }
    }

    return issues;
  }

  /**
   * Extracts React props from the element's internal fiber/props key.
   * Tries __reactProps$ (React 17+), __reactFiber$ (React 18+),
   * then __reactInternalInstance$ (React 16) as fallbacks.
   */
  private getReactProps(element: HTMLElement): Record<string, unknown> | null {
    const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
    if (propsKey) {
      return (element as unknown as Record<string, Record<string, unknown>>)[propsKey];
    }

    const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$'));
    if (fiberKey) {
      const fiber = (
        element as unknown as Record<string, { memoizedProps?: Record<string, unknown> }>
      )[fiberKey];
      return fiber?.memoizedProps ?? null;
    }

    const instanceKey = Object.keys(element).find((key) =>
      key.startsWith('__reactInternalInstance$'),
    );
    if (instanceKey) {
      const instance = (
        element as unknown as Record<string, { memoizedProps?: Record<string, unknown> }>
      )[instanceKey];
      return instance?.memoizedProps ?? null;
    }

    return null;
  }

  /**
   * Formats a raw issue into a full Issue with human-readable message and remediation.
   */
  private formatIssue(raw: RawIssue): Issue {
    const eventTypes = (raw.issueMetadata?.eventTypes ?? []) as string[];
    const details = eventTypes.map((t) => `${t} handler`).join(', ');

    return {
      ...raw,
      id: crypto.randomUUID(),
      message: `Input may break IME composition for CJK languages. Missing isComposing check in React handler: ${details}`,
      remediation: {
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing',
        suggestion:
          'Add event.isComposing check in keyboard/input event handlers before modifying input value or calling preventDefault().',
      },
    };
  }
}
