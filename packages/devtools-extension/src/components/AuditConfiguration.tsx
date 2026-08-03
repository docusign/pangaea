// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import React from 'react';
import { Button, Checkbox, CheckboxGroup, Heading, Banner, ProgressBar } from '../ui';
import type { AuditProgress } from '@pangaea-g11n/core';

/**
 * Props for the AuditConfiguration component
 */
interface AuditConfigurationProps {
  /** Whether the RTL (Right-to-Left) analyzer is enabled */
  runRTL: boolean;
  /** Whether the Layout Stability analyzer is enabled */
  runLayoutStability: boolean;
  /** Whether the Encoding analyzer is enabled */
  runEncoding: boolean;
  /** Whether the IME analyzer is enabled */
  runIME: boolean;
  /** Whether the Language analyzer is enabled */
  runLanguage: boolean;
  /** Whether the Collation analyzer is enabled */
  runCollation: boolean;
  /** Callback function to toggle the RTL analyzer on/off */
  toggleRTL: () => void;
  /** Callback function to toggle the Layout Stability analyzer on/off */
  toggleLayoutStability: () => void;
  /** Callback function to toggle the Encoding analyzer on/off */
  toggleEncoding: () => void;
  /** Callback function to toggle the IME analyzer on/off */
  toggleIME: () => void;
  /** Callback function to toggle the Language analyzer on/off */
  toggleLanguage: () => void;
  /** Callback function to toggle the Collation analyzer on/off */
  toggleCollation: () => void;
  /** Callback function to initiate the audit process */
  onRunAudit: () => void;
  /** Whether an audit is currently running */
  isLoading: boolean;
  /** Error message to display, if any */
  error: string | null;
  /** Progress information about the current audit */
  progress: AuditProgress | null;
}

/**
 * AuditConfiguration component provides a user interface for configuring
 * and initiating globalization audits. It allows users to:
 * - Select which analyzers to run (RTL, Layout Stability, Encoding, IME)
 * - Choose the resolution for testing
 * - Initiate the audit process
 * - View any errors that occur
 *
 * @param props - The component props
 * @returns A React component that renders the audit configuration interface
 */
export const AuditConfiguration: React.FC<AuditConfigurationProps> = ({
  runRTL,
  runLayoutStability,
  runEncoding,
  runIME,
  runLanguage,
  runCollation,
  toggleRTL,
  toggleLayoutStability,
  toggleEncoding,
  toggleIME,
  toggleLanguage,
  toggleCollation,
  onRunAudit,
  isLoading,
  error,
  progress,
}) => {
  const { version } = chrome.runtime.getManifest();

  return (
    <>
      <Heading
        level="1"
        text={
          <>
            Pangæa DevTools
            <sub style={{ fontSize: '12px', fontWeight: 'bold', marginLeft: '4px' }}>
              v{version}
            </sub>
          </>
        }
      />
      <div style={{ margin: '24px 0', width: '100%', textAlign: 'left' }}>
        <CheckboxGroup legend="Select analyzers to run:">
          <Checkbox
            label="RTL"
            checked={runRTL}
            onChange={toggleRTL}
            description="Analyzes right-to-left language support and layout symmetry"
          />
          <Checkbox
            label="Layout Stability"
            checked={runLayoutStability}
            onChange={toggleLayoutStability}
            description="Detects self-overflow issues when text expands beyond element bounds"
          />
          <Checkbox
            label="Encoding"
            checked={runEncoding}
            onChange={toggleEncoding}
            description="Checks character encoding issues and mojibake detection"
          />
          <Checkbox
            label="IME"
            checked={runIME}
            onChange={toggleIME}
            description="Checks Input Method Editor support for CJK languages"
          />
          <Checkbox
            label={
              <>
                Language{' '}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#d97706',
                    backgroundColor: '#fef3c7',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    marginLeft: '4px',
                    verticalAlign: 'middle',
                  }}
                >
                  Experimental
                </span>
              </>
            }
            checked={runLanguage}
            onChange={toggleLanguage}
            description="Detects text and link language mismatches with the page language"
          />
          <Checkbox
            label="Collation"
            checked={runCollation}
            onChange={toggleCollation}
            description="Detects unsorted lists, selects, and table columns that ignore locale-aware collation"
          />
        </CheckboxGroup>
      </div>
      <Button
        onClick={onRunAudit}
        disabled={isLoading}
        loading={isLoading}
        text={isLoading ? 'Running audit...' : 'Generate'}
        kind="primary"
      />

      {progress && (
        <div style={{ marginTop: '16px', width: '100%' }}>
          <ProgressBar
            label={`Running ${progress.currentAnalyzer}`}
            value={progress.completedAnalyzers}
            max={progress.totalAnalyzers}
            kind="info"
            content={`${Math.round((progress.completedAnalyzers / progress.totalAnalyzers) * 100)}%`}
          />
        </div>
      )}
      {error && (
        <div style={{ marginTop: '8px' }}>
          <Banner kind="danger" visible>
            {error}
          </Banner>
        </div>
      )}
    </>
  );
};
