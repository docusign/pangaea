// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import React, { useState } from 'react';
import { InkDocuSignTheme, Theme } from './ui';
import { AuditConfiguration } from './components/AuditConfiguration';
import { AuditReport as AuditReportComponent } from './components/AuditReport';
import { printReport } from './utils/printReport';
import { useAuditMessaging } from './hooks/useAuditMessaging';
import { DevToolsService } from './services/devtoolsService';

export const App: React.FC = () => {
  const { report, error, isLoading, progress, runAudit, reset } = useAuditMessaging();
  const [runRTL, setRunRTL] = useState(true);
  const [runLayoutStability, setRunLayoutStability] = useState(true);
  const [runEncoding, setRunEncoding] = useState(true);
  const [runIME, setRunIME] = useState(true);
  const [runLanguage, setRunLanguage] = useState(true);
  const [runCollation, setRunCollation] = useState(true);

  const toggleRTL = () => setRunRTL((prev) => !prev);
  const toggleLayoutStability = () => setRunLayoutStability((prev) => !prev);
  const toggleEncoding = () => setRunEncoding((prev) => !prev);
  const toggleIME = () => setRunIME((prev) => !prev);
  const toggleLanguage = () => setRunLanguage((prev) => !prev);
  const toggleCollation = () => setRunCollation((prev) => !prev);

  const runGlobalizationAudit = () => {
    runAudit({ runRTL, runEncoding, runLayoutStability, runIME, runLanguage, runCollation });
  };

  // Function to print the current page as PDF
  const downloadPDF = () => {
    if (!report) return;
    printReport();
  };

  // Function to go back to audit configuration
  const goBackToConfig = () => {
    DevToolsService.clearHighlight();
    reset();
  };

  return (
    <Theme docuSignTheme={InkDocuSignTheme} enableFontFaceDeclarations enableGlobalCss>
      {/* Print-specific styles */}
      <style>
        {`
          @media print {
            /* Hide non-essential elements when printing */
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {!report ? (
          <AuditConfiguration
            runRTL={runRTL}
            runLayoutStability={runLayoutStability}
            runEncoding={runEncoding}
            runIME={runIME}
            runLanguage={runLanguage}
            runCollation={runCollation}
            toggleRTL={toggleRTL}
            toggleLayoutStability={toggleLayoutStability}
            toggleEncoding={toggleEncoding}
            toggleIME={toggleIME}
            toggleLanguage={toggleLanguage}
            toggleCollation={toggleCollation}
            onRunAudit={runGlobalizationAudit}
            isLoading={isLoading}
            error={error}
            progress={progress}
          />
        ) : (
          <AuditReportComponent
            report={report}
            onDownloadPDF={downloadPDF}
            onGoBack={goBackToConfig}
            ranRTL={runRTL}
            ranLayoutStability={runLayoutStability}
            ranEncoding={runEncoding}
            ranIME={runIME}
            ranLanguage={runLanguage}
            ranCollation={runCollation}
          />
        )}
      </div>
    </Theme>
  );
};
