// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Main highlight script generator - composes all highlight scripts */

import { SELF_OVERFLOW_TYPES, PARENT_OVERFLOW_TYPES } from './constants';
import { generateCleanupExistingScript, generateSetupCleanupFunction } from './cleanupScripts';
import { generateSelfOverflowHighlightFunction } from './selfOverflowHighlightScript';
import { generateParentOverflowHighlightFunction } from './parentOverflowHighlightScript';
import {
  generateMojibakeHighlightFunction,
  generateStandardHighlightFunction,
} from './standardHighlightScript';

export function generateHighlightScript(
  elementSelector: string,
  metadata?: Record<string, unknown>,
): string {
  const escapedSelector = elementSelector.replace(/'/g, "\\'");
  const metadataJson = metadata ? JSON.stringify(metadata) : 'null';
  const selfOverflowTypes = JSON.stringify(SELF_OVERFLOW_TYPES);
  const parentOverflowTypes = JSON.stringify(PARENT_OVERFLOW_TYPES);

  return `
    (function() {
      const SELF_OVERFLOW_TYPES = ${selfOverflowTypes};
      const PARENT_OVERFLOW_TYPES = ${parentOverflowTypes};
      
      ${generateCleanupExistingScript()}

      try {
        const targetElement = document.querySelector('${escapedSelector}');
        const metadata = ${metadataJson};
        
        if (targetElement) {
          const issueType = metadata && metadata.issueType;
          const isSelfOverflow = SELF_OVERFLOW_TYPES.includes(issueType);
          const isParentOverflow = PARENT_OVERFLOW_TYPES.includes(issueType);
          
          if (metadata && metadata.targetDir) {
            window.__globAuditOriginalDir = document.documentElement.getAttribute('dir');
            document.documentElement.setAttribute('dir', metadata.targetDir);
            requestAnimationFrame(() => requestAnimationFrame(() => performHighlight()));
          } else if (isParentOverflow) {
            performParentOverflowHighlight();
          } else if (isSelfOverflow) {
            performSelfOverflowHighlight();
          } else {
            performHighlight();
          }
          
          ${generateSelfOverflowHighlightFunction()}
          
          ${generateParentOverflowHighlightFunction()}
          
          ${generateStandardHighlightFunction()}
          
          ${generateMojibakeHighlightFunction()}
          
          ${generateSetupCleanupFunction()}
        }
      } catch (error) {
        console.error('Error highlighting element:', error);
      }
    })()
  `;
}
