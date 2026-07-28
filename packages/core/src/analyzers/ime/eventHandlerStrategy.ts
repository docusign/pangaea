// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, RawIssue, AnalyzerStrategy } from '../../types/types';
import type { IMEAnalyzerContext } from './types';
import { safeFinder } from '../../utils/safeFinder';

const KEYBOARD_EVENTS = ['keydown', 'keyup', 'keypress'];
const INPUT_EVENTS = ['input', 'beforeinput'];
const COMPOSITION_EVENTS = ['compositionstart', 'compositionend'];

/**
 * Detects event handlers on input elements that are missing an
 * `event.isComposing` check, which can break IME composition for CJK languages.
 *
 * Skips elements that have `compositionstart` or `compositionend` listeners,
 * as these indicate the developer is managing IME state explicitly.
 *
 * @example
 * const strategy = new EventHandlerStrategy();
 * const issues = strategy.analyze(context);
 */
export class EventHandlerStrategy implements AnalyzerStrategy<IMEAnalyzerContext> {
  readonly name = 'EventHandlerStrategy';
  readonly issueType = 'ime-missing-isComposing-check';

  /**
   * Detects IME issues and returns formatted issues.
   *
   * @param context - The analyzer context containing elements and options
   * @returns Array of issues found in the analyzed elements
   */
  analyze(context: IMEAnalyzerContext): Issue[] {
    const rawIssues = this.detect(context);
    return rawIssues.map((raw) => this.formatIssue(raw));
  }

  /**
   * Iterates over context elements and emits a raw issue for each element
   * that has keyboard/input handlers missing an `isComposing` guard.
   * Elements with composition event listeners are skipped.
   * @private
   */
  private detect(context: IMEAnalyzerContext): RawIssue[] {
    const issues: RawIssue[] = [];

    for (const element of context.elements) {
      let listeners: Record<string, { listener: (...args: unknown[]) => void }[]>;
      try {
        listeners = context.options.getEventListeners(element);
      } catch {
        continue;
      }

      const hasCompositionListeners = COMPOSITION_EVENTS.some(
        (eventType) => listeners[eventType] && listeners[eventType].length > 0,
      );
      if (hasCompositionListeners) {
        continue;
      }

      const failingEventTypes = new Set<string>();

      for (const eventType of [...KEYBOARD_EVENTS, ...INPUT_EVENTS]) {
        const eventListeners = listeners[eventType] || [];
        for (const info of eventListeners) {
          if (!info.listener) continue;
          const source = info.listener.toString();
          if (!/isComposing/.test(source)) {
            failingEventTypes.add(eventType);
          }
        }
      }

      if (failingEventTypes.size > 0) {
        issues.push({
          type: this.issueType,
          severity: 'critical',
          elementSelector: safeFinder(element),
          issueMetadata: { eventTypes: [...failingEventTypes] },
        });
      }
    }

    return issues;
  }

  /**
   * Transforms a raw detection result into a full Issue with human-readable
   * message and remediation link.
   * @private
   */
  private formatIssue(raw: RawIssue): Issue {
    const eventTypes = (raw.issueMetadata?.eventTypes ?? []) as string[];
    const details = eventTypes.map((t) => `${t} handler`).join(', ');

    return {
      ...raw,
      id: crypto.randomUUID(),
      message: `Input may break IME composition for CJK languages. Missing isComposing check in: ${details}`,
      remediation: {
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing',
        suggestion:
          'Add event.isComposing check in keyboard/input event handlers before modifying input value or calling preventDefault().',
      },
    };
  }
}
