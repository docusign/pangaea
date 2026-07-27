// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Generates highlight functions for RTL, encoding, and overflow issues */

import { generateLegendFunction, LEGEND_CONFIGS } from './legendScript';

export function generateStandardHighlightFunction(): string {
  const legendFunction = generateLegendFunction();
  const rtlLegendItems = JSON.stringify(LEGEND_CONFIGS.rtlSymmetry);

  return `
    ${legendFunction}
    
    function performHighlight() {
      const isEncodingMojibake = issueType === 'encoding-mojibake';
      const isEncodingIssue = issueType && issueType.startsWith('encoding-');
      const isDirectOverflow = issueType === 'layout-direct-content-overflow';
      const isRtlAsymmetric = issueType === 'rtl-asymmetric-layout';
      
      if (isEncodingMojibake && metadata && metadata.mojibakeSelectors && metadata.mojibakeSelectors.length > 0) {
        handleMojibakeHighlight();
        return;
      }
      
      targetElement.classList.add('glob-audit-highlight');
      targetElement.style.outline = '3px solid #ef4444';
      targetElement.style.outlineOffset = '2px';

      // Get or create overlay container that won't affect page layout
      function getOverlayContainer() {
        let container = document.getElementById('glob-audit-overlay-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'glob-audit-overlay-container';
          container.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483647;';
          document.documentElement.appendChild(container);
        }
        return container;
      }
      
      let expectedOverlay = null;
      const containerWidth = (metadata && typeof metadata.containerWidth === 'number') ? metadata.containerWidth : null;
      const originalRight = (metadata && typeof metadata.originalRight === 'number') ? metadata.originalRight : null;
      
      if (containerWidth !== null && originalRight !== null && isRtlAsymmetric) {
        const overlayContainer = getOverlayContainer();
        expectedOverlay = document.createElement('div');
        expectedOverlay.className = 'glob-audit-overlay glob-audit-expected';
        expectedOverlay.style.position = 'fixed';
        expectedOverlay.style.border = '3px dashed #10b981';
        expectedOverlay.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
        expectedOverlay.style.zIndex = '9999';
        expectedOverlay.style.pointerEvents = 'none';
        expectedOverlay.style.boxSizing = 'border-box';
        overlayContainer.appendChild(expectedOverlay);
        
        // Create legend for RTL issues
        createLegend(${rtlLegendItems});
      }

      let rafId = null;
      const updatePositions = () => {
        const liveRect = targetElement.getBoundingClientRect();

        if (expectedOverlay && containerWidth !== null && originalRight !== null) {
          // Expected left position = mirror of original right position
          const expectedLeft = containerWidth - originalRight;
          expectedOverlay.style.left = expectedLeft + 'px';
          expectedOverlay.style.top = liveRect.top + 'px';
          expectedOverlay.style.width = liveRect.width + 'px';
          expectedOverlay.style.height = liveRect.height + 'px';
        }
        
        rafId = requestAnimationFrame(updatePositions);
      };
      
      updatePositions();
      window.__globAuditRafId = rafId;

      // Scroll element into view (safe here since no pseudolocalization in RTL highlight)
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

      setupCleanup(targetElement);
    }
  `;
}

/** Generates mojibake-specific multi-element highlighting */
export function generateMojibakeHighlightFunction(): string {
  return `
    function handleMojibakeHighlight() {
      const mojibakeSelectors = metadata.mojibakeSelectors;
      const mojibakeElements = [];
      const labels = [];
      
      // Get or create overlay container
      let overlayContainer = document.getElementById('glob-audit-overlay-container');
      if (!overlayContainer) {
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'glob-audit-overlay-container';
        overlayContainer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483647;';
        document.documentElement.appendChild(overlayContainer);
      }
      
      for (const selector of mojibakeSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            mojibakeElements.push(el);
            el.classList.add('glob-audit-highlight');
            el.style.outline = '3px solid #ef4444';
            el.style.outlineOffset = '2px';
            
            const label = document.createElement('div');
            label.className = 'glob-audit-overlay glob-audit-label';
            label.textContent = 'Mojibake Detected';
            label.style.position = 'fixed';
            label.style.backgroundColor = '#ef4444';
            label.style.color = 'white';
            label.style.padding = '2px 8px';
            label.style.borderRadius = '3px';
            label.style.fontSize = '12px';
            label.style.fontWeight = 'bold';
            label.style.whiteSpace = 'nowrap';
            label.style.zIndex = '10000';
            label.style.pointerEvents = 'none';
            overlayContainer.appendChild(label);
            labels.push({ element: el, label });
          }
        } catch (e) {}
      }
      
      if (mojibakeElements.length > 0) {
        let rafId = null;
        const updatePositions = () => {
          labels.forEach(({ element, label }) => {
            const rect = element.getBoundingClientRect();
            label.style.left = rect.left + 'px';
            label.style.top = (rect.top - 25) + 'px';
          });
          rafId = requestAnimationFrame(updatePositions);
        };
        
        updatePositions();
        window.__globAuditRafId = rafId;
        
        // Scroll first mojibake element into view
        mojibakeElements[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        
        const clearHighlights = () => {
          mojibakeElements.forEach(el => {
            el.classList.remove('glob-audit-highlight');
            el.style.removeProperty('outline');
            el.style.removeProperty('outline-offset');
          });
          
          const overlays = document.querySelectorAll('.glob-audit-overlay');
          overlays.forEach(el => el.remove());
          
          if (window.__globAuditHighlightTimeout) {
            clearTimeout(window.__globAuditHighlightTimeout);
            window.__globAuditHighlightTimeout = null;
          }
          
          if (window.__globAuditClickListener) {
            document.removeEventListener('click', window.__globAuditClickListener);
            window.__globAuditClickListener = null;
          }

          if (window.__globAuditRafId) {
            cancelAnimationFrame(window.__globAuditRafId);
            window.__globAuditRafId = null;
          }
        };
        
        window.__globAuditHighlightTimeout = setTimeout(clearHighlights, 10000);
        
        window.__globAuditClickListener = (e) => {
          const clickedOnHighlight = mojibakeElements.some(el => el.contains(e.target));
          if (!clickedOnHighlight) {
            clearHighlights();
          }
        };
        
        setTimeout(() => {
          document.addEventListener('click', window.__globAuditClickListener);
        }, 100);
      }
    }
  `;
}
