// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Script generators for highlight cleanup */

export function generateCleanupExistingScript(): string {
  return `
    const existingHighlights = document.querySelectorAll('.glob-audit-highlight');
    existingHighlights.forEach(el => {
      el.classList.remove('glob-audit-highlight');
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
    });
    
    // Clean up parent highlights
    const existingParentHighlights = document.querySelectorAll('.glob-audit-highlight-parent');
    existingParentHighlights.forEach(el => {
      el.classList.remove('glob-audit-highlight-parent');
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
    });
    
    document.querySelectorAll('.glob-audit-overlay').forEach(el => el.remove());
    
    // Remove overlay container
    const overlayContainer = document.getElementById('glob-audit-overlay-container');
    if (overlayContainer) overlayContainer.remove();
    
    if (window.__globAuditRafId) {
      cancelAnimationFrame(window.__globAuditRafId);
      window.__globAuditRafId = null;
    }
    if (window.__globAuditOriginalDir !== undefined) {
      if (window.__globAuditOriginalDir === null) {
        document.documentElement.removeAttribute('dir');
      } else {
        document.documentElement.setAttribute('dir', window.__globAuditOriginalDir);
      }
      window.__globAuditOriginalDir = undefined;
    }
    if (window.__globAuditOriginalTexts) {
      for (const { node, originalText } of window.__globAuditOriginalTexts) {
        node.textContent = originalText;
      }
      window.__globAuditOriginalTexts = null;
    }
    if (window.__globAuditOriginalOverflow) {
      document.documentElement.style.overflow = window.__globAuditOriginalOverflow.html;
      document.body.style.overflow = window.__globAuditOriginalOverflow.body;
      window.__globAuditOriginalOverflow = null;
    }
    window.__globAuditCleanup = null;
  `;
}

export function generateSetupCleanupFunction(): string {
  return `
    function setupCleanup(targetElement) {
      const clearHighlights = () => {
        if (targetElement.classList.contains('glob-audit-highlight')) {
          targetElement.classList.remove('glob-audit-highlight');
          targetElement.style.removeProperty('outline');
          targetElement.style.removeProperty('outline-offset');
        }
        
        // Clean up parent highlights
        const parentHighlights = document.querySelectorAll('.glob-audit-highlight-parent');
        parentHighlights.forEach(el => {
          el.classList.remove('glob-audit-highlight-parent');
          el.style.removeProperty('outline');
          el.style.removeProperty('outline-offset');
        });
        
        document.querySelectorAll('.glob-audit-overlay').forEach(el => el.remove());
        
        // Remove overlay container
        const overlayContainer = document.getElementById('glob-audit-overlay-container');
        if (overlayContainer) overlayContainer.remove();
        
        if (window.__globAuditOriginalDir !== undefined) {
          if (window.__globAuditOriginalDir === null) {
            document.documentElement.removeAttribute('dir');
          } else {
            document.documentElement.setAttribute('dir', window.__globAuditOriginalDir);
          }
          window.__globAuditOriginalDir = undefined;
        }
        if (window.__globAuditOriginalTexts) {
          for (const { node, originalText } of window.__globAuditOriginalTexts) {
            node.textContent = originalText;
          }
          window.__globAuditOriginalTexts = null;
        }
        if (window.__globAuditOriginalOverflow) {
          document.documentElement.style.overflow = window.__globAuditOriginalOverflow.html;
          document.body.style.overflow = window.__globAuditOriginalOverflow.body;
          window.__globAuditOriginalOverflow = null;
        }
        if (window.__globAuditRafId) {
          cancelAnimationFrame(window.__globAuditRafId);
          window.__globAuditRafId = null;
        }
        window.__globAuditCleanup = null;
      };
      
      // Store cleanup function globally so legend close button can call it
      window.__globAuditCleanup = clearHighlights;
    }
  `;
}
