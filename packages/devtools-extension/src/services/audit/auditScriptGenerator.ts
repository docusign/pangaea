// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Generator for the audit execution script
 * This script runs in the context of the inspected window
 */

import type { AuditAnalyzers } from '../devtoolsService';

/**
 * Generates the script for running the globalization audit
 * @param analyzers - Configuration object specifying which analyzers to run
 * @param requestId - Unique ID for tracking this audit request
 * @returns The complete script string to be evaluated in the inspected window
 */
export function generateAuditScript(analyzers: AuditAnalyzers, requestId: string): string {
  const analyzerInstances = buildAnalyzerInstances(analyzers);
  const bundleUrl = chrome.runtime.getURL('injected/glob-audit-bundle.js');

  return `
    (function() {
      ${generateMessageHelper(requestId)}

      // Capture DevTools console utilities synchronously during eval,
      // before any async callbacks (e.g. script.onload) where they'd be unavailable.
      var _getEventListenersFn = typeof getEventListeners === 'function' ? getEventListeners : function() { return {}; };

      function runAudit() {
        try {
          const auditRunner = window.globAudit?.default?.Core?.AuditRunner;
          if (!auditRunner) {
            sendMessage('GLOB_AUDIT_ERROR', { error: 'globAudit AuditRunner not found' });
            return;
          }
          
          // Progress callback to report analyzer execution
          const onProgress = (progress) => {
            sendMessage('GLOB_AUDIT_PROGRESS', { progress });
          };
          
          auditRunner.runAudit(
            document.documentElement, 
            window.location.href, 
            [${analyzerInstances.join(',')}],
            undefined,
            undefined,
            onProgress
          )
            .then(result => sendMessage('GLOB_AUDIT_RESULT', { result }))
            .catch(err => sendMessage('GLOB_AUDIT_ERROR', { error: err.message || 'Unknown error' }));
        } catch (err) {
          sendMessage('GLOB_AUDIT_ERROR', { error: err.message || 'Failed to run audit' });
        }
      }

      if (!window.globAudit) {
        const script = document.createElement('script');
        script.src = "${bundleUrl}";
        script.type = 'application/javascript';
        script.charset = 'UTF-8';
        script.onload = runAudit;
        script.onerror = () => sendMessage('GLOB_AUDIT_ERROR', { error: 'Failed to load audit library' });
        document.documentElement.appendChild(script);
      } else {
        runAudit();
      }
    })()
  `;
}

/**
 * Builds the array of analyzer instance creation strings
 * @param analyzers - Configuration object specifying which analyzers to run
 * @returns Array of JavaScript expressions for creating analyzer instances
 */
function buildAnalyzerInstances(analyzers: AuditAnalyzers): string[] {
  const instances: string[] = [];

  if (analyzers.runRTL) {
    instances.push('new window.globAudit.default.RTLAnalyzer()');
  }

  if (analyzers.runLayoutStability) {
    instances.push('new window.globAudit.default.LayoutStabilityAnalyzer()');
  }

  if (analyzers.runEncoding) {
    instances.push('new window.globAudit.default.EncodingAnalyzer()');
  }

  // IME analyzer: uses getEventListeners captured at eval time (see generateAuditScript)
  if (analyzers.runIME) {
    instances.push(
      'new window.globAudit.default.IMEAnalyzer({ getEventListeners: _getEventListenersFn })',
    );
  }

  if (analyzers.runLanguage) {
    instances.push('new window.globAudit.default.LanguageAnalyzer()');
  }

  if (analyzers.runCollation) {
    instances.push('new window.globAudit.default.CollationAnalyzer()');
  }

  return instances;
}

/**
 * Generates the message helper function for the injected script
 * @param requestId - Unique ID for tracking this audit request
 * @returns JavaScript code for the sendMessage helper function
 */
function generateMessageHelper(requestId: string): string {
  return `
      function sendMessage(type, data) {
        window.postMessage({ source: 'glob-audit-extension', type: type, requestId: '${requestId}', ...data }, '*');
      }
  `;
}
