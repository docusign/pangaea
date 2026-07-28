// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AnalyzerContext } from '../../types/types';

export interface EventListenerInfo {
  listener: (...args: unknown[]) => void;
  [key: string]: unknown;
}

/** Retrieves event listeners registered on an element. */
export type GetEventListenersFn = (element: Element) => Record<string, EventListenerInfo[]>;

export interface IMEAnalyzerOptions {
  /** Function to retrieve event listeners — from DevTools console API or CDP. */
  getEventListeners: GetEventListenersFn;
}

export type IMEIssueType = 'ime-missing-isComposing-check';

export interface IMEAnalyzerContext extends AnalyzerContext {
  options: IMEAnalyzerOptions;
}
