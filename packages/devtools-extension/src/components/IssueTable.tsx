// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import React from 'react';
import { StatusBadge } from '../ui';
import type { Issue, Severity } from '@pangaea/core';
import { ClickableElementSelector } from './ClickableElementSelector';

/**
 * Props for the IssueTable component
 */
interface IssueTableProps {
  /** Array of issues to display in the table */
  issues: Issue[];
  /** ID of the currently active/highlighted issue */
  activeIssueId: string | null;
  /** Callback when active issue changes */
  onActiveIssueChange: (id: string | null) => void;
}

/**
 * IssueTable component renders a reusable table for displaying audit issues
 * with consistent styling and interactive elements.
 *
 * Features:
 * - Displays issues in a structured table format
 * - Includes clickable element selectors for highlighting
 * - Shows severity badges with appropriate colors
 * - Alternating row colors for better readability
 * - Highlights active selector row when an element is being highlighted
 * - Responsive design with proper border and spacing
 *
 * @param props - The component props
 * @param props.issues - Array of issues to display
 * @param props.activeIssueId - ID of the currently active/highlighted issue
 * @param props.onActiveIssueChange - Callback when active issue changes
 * @returns A React component that renders an issues table
 *
 * @example
 * ```tsx
 * <IssueTable
 *   issues={rtlIssues}
 *   activeIssueId={activeId}
 *   onActiveIssueChange={setActiveId}
 * />
 * ```
 */
export const IssueTable: React.FC<IssueTableProps> = ({
  issues,
  activeIssueId,
  onActiveIssueChange,
}) => {
  /**
   * Helper function to get the appropriate status kind for severity badges
   * Severity levels: critical, serious, moderate, minor, info
   * @param severity - The severity level
   * @returns The corresponding status kind for the badge
   */
  const getSeverityStatus = (
    severity: Severity,
  ): 'warning' | 'emphasis' | 'promo' | 'subtle' | 'success' | 'alert' | 'promoSubtle' => {
    switch (severity) {
      case 'critical':
        return 'alert';
      case 'serious':
        return 'warning';
      case 'moderate':
        return 'emphasis';
      case 'minor':
        return 'promo';
      case 'info':
      default:
        return 'subtle';
    }
  };

  const styles = {
    container: {
      border: '1px solid #e1e5e9',
      borderRadius: '8px',
      overflow: 'hidden',
    } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse' } as React.CSSProperties,
    headerRow: { backgroundColor: '#f9fafb' } as React.CSSProperties,
    th: {
      padding: '12px',
      textAlign: 'left' as const,
      fontWeight: 'bold',
      borderBottom: '1px solid #e1e5e9',
    } as React.CSSProperties,
    td: {
      padding: '12px',
      borderBottom: '1px solid #e1e5e9',
      verticalAlign: 'top' as const,
    } as React.CSSProperties,
    row: (isEven: boolean, isActive: boolean): React.CSSProperties => ({
      backgroundColor: isActive ? '#dbeafe' : isEven ? '#ffffff' : '#f9fafb',
      borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
    }),
  };

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.headerRow}>
            <th style={styles.th}>Element Selector</th>
            <th style={styles.th}>Severity</th>
            <th style={styles.th}>Description</th>
            <th style={styles.th}>Suggestion</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={issue.id} style={styles.row(index % 2 === 0, activeIssueId === issue.id)}>
              <td style={styles.td}>
                <ClickableElementSelector
                  selector={issue.elementSelector}
                  metadata={{ ...issue.issueMetadata, issueType: issue.type }}
                  isActive={activeIssueId === issue.id}
                  onSelect={() => {
                    const isActivating = activeIssueId !== issue.id;
                    onActiveIssueChange(isActivating ? issue.id : null);
                    return isActivating;
                  }}
                />
              </td>
              <td style={styles.td}>
                <StatusBadge
                  text={(issue.severity ?? 'info').toUpperCase()}
                  kind={getSeverityStatus(issue.severity ?? 'info')}
                />
              </td>
              <td style={styles.td}>{issue.message || 'No description available'}</td>
              <td style={styles.td}>
                {issue.remediation?.suggestion || 'No suggestion available'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
