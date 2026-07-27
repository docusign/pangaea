// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Generates highlight with pseudolocalization for self-overflow issues */

import { generatePseudolocalizationFunction } from './pseudolocalizationScript';
import { generateLegendFunction, LEGEND_CONFIGS } from './legendScript';

export function generateSelfOverflowHighlightFunction(): string {
  const pseudolocFunction = generatePseudolocalizationFunction();
  const legendFunction = generateLegendFunction();
  const selfOverflowLegendItems = JSON.stringify(LEGEND_CONFIGS.selfOverflow);

  return `
    ${legendFunction}
    
    function performSelfOverflowHighlight() {
      // Scroll element into view FIRST (before pseudolocalization)
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      
      // Apply pseudolocalization to the full page to show the overflow
      const originalTexts = applyPseudolocalization(document.documentElement, false);
      window.__globAuditOriginalTexts = originalTexts;
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Calculate overflow after pseudolocalization
          const overflowX = targetElement.scrollWidth - targetElement.clientWidth;
          const overflowY = targetElement.scrollHeight - targetElement.clientHeight;
          const rect = targetElement.getBoundingClientRect();
          
          // Highlight the element with outline
          targetElement.classList.add('glob-audit-highlight');
          targetElement.style.outline = '3px solid rgba(239, 68, 68, 0.7)';
          targetElement.style.outlineOffset = '2px';
          
          // Create a container for overlays that won't affect page layout
          let overlayContainer = document.getElementById('glob-audit-overlay-container');
          if (!overlayContainer) {
            overlayContainer = document.createElement('div');
            overlayContainer.id = 'glob-audit-overlay-container';
            overlayContainer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483647;';
            document.documentElement.appendChild(overlayContainer);
          }
          
          // Create overflow indicator for X (right side)
          if (overflowX > 0) {
            const overflowXOverlay = document.createElement('div');
            overflowXOverlay.className = 'glob-audit-overlay glob-audit-overflow-x';
            overflowXOverlay.style.position = 'fixed';
            overflowXOverlay.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            overflowXOverlay.style.border = '2px dashed #ef4444';
            overflowXOverlay.style.zIndex = '9999';
            overflowXOverlay.style.pointerEvents = 'none';
            overflowXOverlay.style.boxSizing = 'border-box';
            overlayContainer.appendChild(overflowXOverlay);
            
            // Position to the right of the element's visible bounds
            const updateOverflowX = () => {
              const r = targetElement.getBoundingClientRect();
              overflowXOverlay.style.left = (r.right) + 'px';
              overflowXOverlay.style.top = r.top + 'px';
              overflowXOverlay.style.width = overflowX + 'px';
              overflowXOverlay.style.height = r.height + 'px';
            };
            updateOverflowX();
            window.__globAuditUpdateOverflowX = updateOverflowX;
          }
          
          // Create overflow indicator for Y (bottom side)
          if (overflowY > 0) {
            const overflowYOverlay = document.createElement('div');
            overflowYOverlay.className = 'glob-audit-overlay glob-audit-overflow-y';
            overflowYOverlay.style.position = 'fixed';
            overflowYOverlay.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            overflowYOverlay.style.border = '2px dashed #ef4444';
            overflowYOverlay.style.zIndex = '9999';
            overflowYOverlay.style.pointerEvents = 'none';
            overflowYOverlay.style.boxSizing = 'border-box';
            overlayContainer.appendChild(overflowYOverlay);
            
            // Position below the element's visible bounds
            const updateOverflowY = () => {
              const r = targetElement.getBoundingClientRect();
              overflowYOverlay.style.left = r.left + 'px';
              overflowYOverlay.style.top = (r.bottom) + 'px';
              overflowYOverlay.style.width = r.width + 'px';
              overflowYOverlay.style.height = overflowY + 'px';
            };
            updateOverflowY();
            window.__globAuditUpdateOverflowY = updateOverflowY;
          }
          
          // Create legend
          createLegend(${selfOverflowLegendItems});
          
          let rafId = null;
          const updatePosition = () => {
            // Update overflow overlays on scroll
            if (window.__globAuditUpdateOverflowX) window.__globAuditUpdateOverflowX();
            if (window.__globAuditUpdateOverflowY) window.__globAuditUpdateOverflowY();
            
            rafId = requestAnimationFrame(updatePosition);
          };
          
          updatePosition();
          window.__globAuditRafId = rafId;
          setupCleanup(targetElement);
        });
      });
    }
    
    ${pseudolocFunction}
  `;
}
