// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import React, { useState } from 'react';
import { Button, Heading, Accordion, Meter } from '../ui';
import type { AuditReport as AuditReportType } from '@pangaea/glob-audit-core';
import { IssueTable } from './IssueTable';
import { useHighlightCleared } from '../hooks/useHighlightCleared';

/**
 * Props for the AuditReport component
 */
interface AuditReportProps {
  /** The audit report data to display */
  report: AuditReportType;
  /** Callback function to handle PDF download */
  onDownloadPDF: () => void;
  /** Callback function to go back to audit configuration */
  onGoBack: () => void;
  /** Whether RTL analyzer was executed */
  ranRTL?: boolean;
  /** Whether Layout Stability analyzer was executed */
  ranLayoutStability?: boolean;
  /** Whether Encoding analyzer was executed */
  ranEncoding?: boolean;
  /** Whether IME analyzer was executed */
  ranIME?: boolean;
  /** Whether Language analyzer was executed */
  ranLanguage?: boolean;
  /** Whether Collation analyzer was executed */
  ranCollation?: boolean;
}

/**
 * AuditReport component renders the complete globalization audit report
 * including issues and detailed analysis for each analyzer.
 *
 * Features:
 * - Shows individual analyzer scores (RTL, Layout Stability, Encoding, IME)
 * - Groups and displays issues by analyzer type
 * - Provides clickable selectors for element highlighting
 * - PDF export functionality via browser's print dialog
 *
 * @param props - The component props
 * @param props.report - The audit report data containing scores and issues
 * @param props.onDownloadPDF - Callback function triggered when print/save as PDF is clicked
 * @param props.onGoBack - Callback function triggered when back button is clicked
 * @returns A React component that renders the complete audit report
 *
 * @example
 * ```tsx
 * <AuditReport
 *   report={auditData}
 *   onDownloadPDF={() => window.print()}
 *   onGoBack={() => setReport(null)}
 * />
 * ```
 */
export const AuditReport: React.FC<AuditReportProps> = ({
  report,
  onDownloadPDF,
  onGoBack,
  ranRTL = true,
  ranLayoutStability = true,
  ranEncoding = true,
  ranIME = true,
  ranLanguage = true,
  ranCollation = true,
}) => {
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);

  // Clear active issue when highlight is cleared (e.g., legend close button)
  useHighlightCleared(() => setActiveIssueId(null));

  /**
   * Helper function to get color based on score
   * @param score - The score value (0-100)
   * @returns Color hex string based on score range
   */
  const getScoreColor = (score: number | undefined): string => {
    if (score === undefined || isNaN(score)) return '#6b7280'; // gray for N/A
    if (score >= 80) return '#10b981'; // green for good scores
    if (score >= 60) return '#f59e0b'; // orange for medium scores
    return '#ef4444'; // red for poor scores
  };

  /**
   * Renders an analyzer section with issues grouped by type in an accordion
   * @param issues - Array of issues to render
   * @param emptyMessage - Message to display when no issues are found
   * @param analyzerRan - Whether the analyzer was executed
   * @returns JSX element containing the accordion with grouped issues or empty message
   */
  const renderAnalyzerIssues = (
    issues: AuditReportType['issues'],
    emptyMessage: string,
    analyzerRan: boolean,
  ): React.ReactElement => {
    if (issues.length === 0) {
      const color = analyzerRan ? '#10b981' : '#6b7280';
      return <p style={{ color, fontWeight: 'bold' }}>{emptyMessage}</p>;
    }

    // Group issues by type
    const issuesByType = issues.reduce(
      (acc, issue) => {
        if (!acc[issue.type]) {
          acc[issue.type] = [];
        }
        acc[issue.type].push(issue);
        return acc;
      },
      {} as Record<string, typeof issues>,
    );

    return (
      <Accordion>
        {Object.entries(issuesByType).map(([issueType, issueGroup]) => (
          <Accordion.Item
            key={issueType}
            title={`${issueType} (${issueGroup.length} ${issueGroup.length === 1 ? 'issue' : 'issues'})`}
          >
            <div style={{ padding: '16px 0' }}>
              <IssueTable
                issues={issueGroup}
                activeIssueId={activeIssueId}
                onActiveIssueChange={setActiveIssueId}
              />
            </div>
          </Accordion.Item>
        ))}
      </Accordion>
    );
  };

  return (
    <>
      {/* Main Title with Download Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: 16,
          width: '100%',
        }}
      >
        <div style={{ flex: 1 }}>
          <Heading level="1" text="Pangæa Audit Report" />
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={onGoBack} text="Back" size="medium" kind="secondary" />
          <Button onClick={onDownloadPDF} text="Print/Save as PDF" size="medium" kind="primary" />
        </div>
      </div>

      {/* Meter Components for Each Analyzer */}
      <div style={{ width: '100%', marginBottom: 16 }}>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '16px' }}
        >
          <div>
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `2px solid ${getScoreColor(report.analyzerScores['RTLAnalyzer'])}`,
                backgroundColor: `${getScoreColor(report.analyzerScores['RTLAnalyzer'])}20`,
              }}
            >
              <Meter
                kind="semantic"
                value={report.analyzerScores['RTLAnalyzer'] || 0}
                min={0}
                low={60}
                high={80}
                optimum={100}
                max={100}
                label="RTL"
                content={`${report.analyzerScores['RTLAnalyzer'] || 0}/100`}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `2px solid ${getScoreColor(report.analyzerScores['LayoutStabilityAnalyzer'])}`,
                backgroundColor: `${getScoreColor(report.analyzerScores['LayoutStabilityAnalyzer'])}20`,
              }}
            >
              <Meter
                kind="semantic"
                min={0}
                low={60}
                high={80}
                optimum={100}
                value={report.analyzerScores['LayoutStabilityAnalyzer'] || 0}
                max={100}
                label="Layout Stability"
                content={`${report.analyzerScores['LayoutStabilityAnalyzer'] || 0}/100`}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `2px solid ${getScoreColor(report.analyzerScores['EncodingAnalyzer'])}`,
                backgroundColor: `${getScoreColor(report.analyzerScores['EncodingAnalyzer'])}20`,
              }}
            >
              <Meter
                kind="semantic"
                min={0}
                low={60}
                high={80}
                optimum={100}
                value={report.analyzerScores['EncodingAnalyzer'] || 0}
                max={100}
                label="Encoding"
                content={`${report.analyzerScores['EncodingAnalyzer'] || 0}/100`}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `2px solid ${getScoreColor(report.analyzerScores['IMEAnalyzer'])}`,
                backgroundColor: `${getScoreColor(report.analyzerScores['IMEAnalyzer'])}20`,
              }}
            >
              <Meter
                kind="semantic"
                min={0}
                low={60}
                high={80}
                optimum={100}
                value={report.analyzerScores['IMEAnalyzer'] || 0}
                max={100}
                label="IME"
                content={`${report.analyzerScores['IMEAnalyzer'] || 0}/100`}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `2px solid ${getScoreColor(report.analyzerScores['LanguageAnalyzer'])}`,
                backgroundColor: `${getScoreColor(report.analyzerScores['LanguageAnalyzer'])}20`,
              }}
            >
              <Meter
                kind="semantic"
                min={0}
                low={60}
                high={80}
                optimum={100}
                value={report.analyzerScores['LanguageAnalyzer'] || 0}
                max={100}
                label="Language"
                content={`${report.analyzerScores['LanguageAnalyzer'] || 0}/100`}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `2px solid ${getScoreColor(report.analyzerScores['CollationAnalyzer'])}`,
                backgroundColor: `${getScoreColor(report.analyzerScores['CollationAnalyzer'])}20`,
              }}
            >
              <Meter
                kind="semantic"
                min={0}
                low={60}
                high={80}
                optimum={100}
                value={report.analyzerScores['CollationAnalyzer'] || 0}
                max={100}
                label="Collation"
                content={`${report.analyzerScores['CollationAnalyzer'] || 0}/100`}
              />
            </div>
          </div>
        </div>
      </div>

      <hr style={{ marginTop: 16, width: '100%', alignSelf: 'stretch' }} />

      {/* RTL Analysis Section */}
      <div className="section-break" style={{ width: '100%', marginTop: 16 }}>
        {/* If the RTL analyzer wasn't selected, we surface 'Analyzer did not run.' instead of 'No RTL issues found.' */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
          <Heading level="2" text="RTL" />
          <div
            style={{
              backgroundColor: getScoreColor(report.analyzerScores['RTLAnalyzer']),
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: '30px',
              textAlign: 'center',
            }}
          >
            {report.analyzerScores['RTLAnalyzer']?.toString() || '0'}
          </div>
        </div>

        {renderAnalyzerIssues(
          report.issues.filter((issue) => issue.type.toLowerCase().startsWith('rtl')),
          ranRTL ? 'No RTL issues found.' : 'Analyzer did not run.',
          ranRTL,
        )}
      </div>

      <hr style={{ marginTop: 16, width: '100%', alignSelf: 'stretch' }} />

      {/* Layout Stability Analysis Section */}
      <div className="section-break" style={{ width: '100%', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
          <Heading level="2" text="Layout Stability" />
          <div
            style={{
              backgroundColor: getScoreColor(report.analyzerScores['LayoutStabilityAnalyzer']),
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: '30px',
              textAlign: 'center',
            }}
          >
            {report.analyzerScores['LayoutStabilityAnalyzer']?.toString() || '0'}
          </div>
        </div>

        {renderAnalyzerIssues(
          report.issues.filter((issue) => issue.type.startsWith('layout-stability')),
          ranLayoutStability ? 'No Layout Stability issues found.' : 'Analyzer did not run.',
          ranLayoutStability,
        )}
      </div>

      <hr style={{ marginTop: 16, width: '100%', alignSelf: 'stretch' }} />

      {/* Encoding Analysis Section */}
      <div className="section-break" style={{ width: '100%', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
          <Heading level="2" text="Encoding" />
          <div
            style={{
              backgroundColor: getScoreColor(report.analyzerScores['EncodingAnalyzer']),
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: '30px',
              textAlign: 'center',
            }}
          >
            {report.analyzerScores['EncodingAnalyzer']?.toString() || '0'}
          </div>
        </div>

        {renderAnalyzerIssues(
          report.issues.filter((issue) => issue.type.toLowerCase().includes('encoding')),
          ranEncoding ? 'No Encoding issues found.' : 'Analyzer did not run.',
          ranEncoding,
        )}
      </div>

      <hr style={{ marginTop: 16, width: '100%', alignSelf: 'stretch' }} />

      {/* IME Analysis Section */}
      <div className="section-break" style={{ width: '100%', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
          <Heading level="2" text="IME" />
          <div
            style={{
              backgroundColor: getScoreColor(report.analyzerScores['IMEAnalyzer']),
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: '30px',
              textAlign: 'center',
            }}
          >
            {report.analyzerScores['IMEAnalyzer']?.toString() || '0'}
          </div>
        </div>

        {renderAnalyzerIssues(
          report.issues.filter((issue) => issue.type.toLowerCase().startsWith('ime')),
          ranIME ? 'No IME issues found.' : 'Analyzer did not run.',
          ranIME,
        )}
      </div>

      <hr style={{ marginTop: 16, width: '100%', alignSelf: 'stretch' }} />

      {/* Language Analysis Section */}
      <div className="section-break" style={{ width: '100%', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
          <Heading level="2" text="Language" />
          <div
            style={{
              backgroundColor: getScoreColor(report.analyzerScores['LanguageAnalyzer']),
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: '30px',
              textAlign: 'center',
            }}
          >
            {report.analyzerScores['LanguageAnalyzer']?.toString() || '0'}
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#d97706',
              backgroundColor: '#fef3c7',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            Experimental
          </span>
        </div>

        {renderAnalyzerIssues(
          report.issues.filter((issue) => issue.type.toLowerCase().startsWith('language')),
          ranLanguage ? 'No Language issues found.' : 'Analyzer did not run.',
          ranLanguage,
        )}
      </div>

      <hr style={{ marginTop: 16, width: '100%', alignSelf: 'stretch' }} />

      {/* Collation Analysis Section */}
      <div className="section-break" style={{ width: '100%', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
          <Heading level="2" text="Collation" />
          <div
            style={{
              backgroundColor: getScoreColor(report.analyzerScores['CollationAnalyzer']),
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: '30px',
              textAlign: 'center',
            }}
          >
            {report.analyzerScores['CollationAnalyzer']?.toString() || '0'}
          </div>
        </div>

        {renderAnalyzerIssues(
          report.issues.filter((issue) => issue.type.toLowerCase().startsWith('collation')),
          ranCollation ? 'No Collation issues found.' : 'Analyzer did not run.',
          ranCollation,
        )}
      </div>
    </>
  );
};
