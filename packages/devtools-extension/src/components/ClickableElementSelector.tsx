// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import React from 'react';
import { DevToolsService } from '../services/devtoolsService';

/**
 * Props for the ClickableElementSelector component
 */
interface ClickableElementSelectorProps {
  /** CSS selector string for the element to highlight when clicked */
  selector: string;
  /** Optional metadata containing position information for visualization */
  metadata?: Record<string, unknown>;
  /** Whether this selector is currently active/highlighted */
  isActive?: boolean;
  /** Callback when selector is clicked, returns true if activating, false if deactivating */
  onSelect?: () => boolean;
}

/**
 * ClickableElementSelector component renders a CSS selector as a clickable code element
 * that highlights the corresponding element on the inspected page when clicked.
 *
 * This component is commonly used in audit reports to allow users to quickly
 * locate problematic elements by clicking on their selectors.
 *
 * Features:
 * - Displays the CSS selector in a styled code block
 * - Changes background color on hover for visual feedback
 * - Highlights the target element on the page when clicked
 * - Shows active state with distinct styling when currently highlighted
 *
 * @param props - The component props
 * @param props.selector - CSS selector string for the element to highlight
 * @param props.isActive - Whether this selector is currently active/highlighted
 * @param props.onSelect - Callback when selector is clicked
 * @returns A React component that renders a clickable CSS selector
 *
 * @example
 * ```tsx
 * <ClickableElementSelector selector="div.problematic-element" />
 * ```
 */
export const ClickableElementSelector: React.FC<ClickableElementSelectorProps> = ({
  selector,
  metadata,
  isActive = false,
  onSelect,
}) => {
  /**
   * Handles highlighting of the element on the inspected page
   * @param elementSelector - CSS selector for the element to highlight
   * @param meta - Optional metadata for visualization
   */
  const handleClick = (elementSelector: string, meta?: Record<string, unknown>) => {
    const isActivating = onSelect?.() ?? true;
    if (isActivating) {
      DevToolsService.highlightElement(elementSelector, meta);
    } else {
      DevToolsService.clearHighlight();
    }
  };

  const baseColor = isActive ? '#dbeafe' : '#f3f4f6';
  const hoverColor = isActive ? '#bfdbfe' : '#e5e7eb';
  const borderStyle = isActive ? '2px solid #3b82f6' : 'none';

  return (
    <code
      style={{
        fontSize: '12px',
        backgroundColor: baseColor,
        padding: '2px 4px',
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        border: borderStyle,
        display: 'block',
        maxWidth: '400px',
        wordBreak: 'break-all',
        whiteSpace: 'normal',
      }}
      onClick={() => handleClick(selector, metadata)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = baseColor;
      }}
      title={selector}
    >
      {selector}
    </code>
  );
};
