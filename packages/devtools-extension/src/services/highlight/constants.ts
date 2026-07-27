// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Constants for element highlighting */

export const SELF_OVERFLOW_TYPES = ['layout-stability-self-overflow'] as const;

export const PARENT_OVERFLOW_TYPES = ['layout-stability-parent-overflow'] as const;

export const TEXT_DISPLAY_ELEMENTS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'blockquote',
  'pre',
  'li',
  'dt',
  'dd',
  'figcaption',
  'caption',
  'legend',
  'summary',
  'address',
  'span',
  'a',
  'button',
  'label',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'code',
  'kbd',
  'samp',
  'var',
  'cite',
  'abbr',
  'time',
  'mark',
  'small',
  'sub',
  'sup',
  'q',
  'dfn',
  'ins',
  'del',
  'bdi',
  'bdo',
  'td',
  'th',
  'option',
  'textarea',
  'output',
  'article',
  'section',
  'nav',
  'aside',
  'header',
  'footer',
  'main',
  'figure',
  'details',
]);

export const HIGHLIGHT_STYLES = {
  problem: {
    outline: '3px solid #ef4444',
    outlineOffset: '2px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    backgroundColorStrong: 'rgba(239, 68, 68, 0.15)',
    backgroundColorLight: 'rgba(239, 68, 68, 0.03)',
    labelBg: '#ef4444',
  },
  expected: {
    border: '3px dashed #10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.03)',
    labelBg: '#10b981',
  },
  before: {
    border: '3px dashed #3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    labelBg: '#3b82f6',
  },
} as const;

export const LABEL_BASE_STYLES = {
  position: 'absolute',
  color: 'white',
  padding: '2px 8px',
  borderRadius: '3px',
  fontSize: '12px',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
} as const;

/**
 * Timeout duration for auto-clearing highlights (in ms)
 */
export const HIGHLIGHT_TIMEOUT_MS = 10000;

/**
 * Delay before adding click listener to prevent immediate clearing (in ms)
 */
export const CLICK_LISTENER_DELAY_MS = 100;
