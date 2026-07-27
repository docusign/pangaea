// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Service for handling Chrome DevTools inspected window operations
 */

import { generateAuditScript } from './audit';
import { generateHighlightScript } from './highlight';

export interface AuditAnalyzers {
  runRTL: boolean;
  runEncoding: boolean;
  runLayoutStability: boolean;
  runIME: boolean;
  runLanguage: boolean;
  runCollation: boolean;
}

export class DevToolsService {
  /**
   * Runs the globalization audit in the inspected window
   * @param analyzers - Configuration object specifying which analyzers to run
   * @param requestId - Unique ID for tracking this audit request
   */
  static runGlobalizationAudit(analyzers: AuditAnalyzers, requestId: string): void {
    const auditScript = generateAuditScript(analyzers, requestId);
    chrome.devtools.inspectedWindow.eval(auditScript);
  }

  /**
   * Highlights an element on the inspected page
   * @param elementSelector - CSS selector for the element to highlight
   * @param metadata - Optional metadata containing position information for expected overlay
   */
  static highlightElement(elementSelector: string, metadata?: Record<string, unknown>): void {
    const highlightScript = generateHighlightScript(elementSelector, metadata);
    chrome.devtools.inspectedWindow.eval(highlightScript);
  }

  /**
   * Clears all highlights from the inspected page
   */
  static clearHighlight(): void {
    const clearScript = `
      if (window.__globAuditCleanup) {
        window.__globAuditCleanup();
      }
    `;
    chrome.devtools.inspectedWindow.eval(clearScript);
  }
}
