// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Generates highlight with pseudolocalization for parent-overflow issues */

import { generatePseudolocalizationFunction } from './pseudolocalizationScript';
import { generateLegendFunction, LEGEND_CONFIGS } from './legendScript';

export function generateParentOverflowHighlightFunction(): string {
  const pseudolocFunction = generatePseudolocalizationFunction();
  const legendFunction = generateLegendFunction();
  const parentOverflowLegendItems = JSON.stringify(LEGEND_CONFIGS.parentOverflow);

  return `
    ${legendFunction}
    
    function performParentOverflowHighlight() {
      // Get parent selector from metadata
      const parentSelector = metadata && metadata.parentSelector;
      const parentElement = parentSelector ? document.querySelector(parentSelector) : targetElement.parentElement;
      
      if (!parentElement) {
        performHighlight();
        return;
      }
      
      // Scroll element into view FIRST (before pseudolocalization)
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      
      // Apply pseudolocalization to the full page to show the overflow
      const originalTexts = applyPseudolocalization(document.documentElement, false);
      window.__globAuditOriginalTexts = originalTexts;
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const elementRect = targetElement.getBoundingClientRect();
          const parentRect = parentElement.getBoundingClientRect();
          
          // Calculate overflow on each side
          const overflowRight = Math.max(0, elementRect.right - parentRect.right);
          const overflowLeft = Math.max(0, parentRect.left - elementRect.left);
          const overflowBottom = Math.max(0, elementRect.bottom - parentRect.bottom);
          const overflowTop = Math.max(0, parentRect.top - elementRect.top);
          
          // Highlight the parent with a subtle outline
          parentElement.classList.add('glob-audit-highlight-parent');
          parentElement.style.outline = '2px solid rgba(239, 68, 68, 0.7)';
          parentElement.style.outlineOffset = '0px';
          
          // Create a container for overlays that won't affect page layout
          let overlayContainer = document.getElementById('glob-audit-overlay-container');
          if (!overlayContainer) {
            overlayContainer = document.createElement('div');
            overlayContainer.id = 'glob-audit-overlay-container';
            overlayContainer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483647;';
            document.documentElement.appendChild(overlayContainer);
          }
          
          // Create overflow indicators for each side
          if (overflowRight > 0) {
            const overlay = document.createElement('div');
            overlay.className = 'glob-audit-overlay glob-audit-overflow-right';
            overlay.style.cssText = 'position:fixed;background:rgba(239,68,68,0.15);border:2px dashed rgba(239,68,68,0.6);z-index:9999;pointer-events:none;box-sizing:border-box;';
            overlayContainer.appendChild(overlay);
            
            const updateOverlay = () => {
              const er = targetElement.getBoundingClientRect();
              const pr = parentElement.getBoundingClientRect();
              overlay.style.left = pr.right + 'px';
              overlay.style.top = Math.max(er.top, pr.top) + 'px';
              overlay.style.width = Math.max(0, er.right - pr.right) + 'px';
              overlay.style.height = (Math.min(er.bottom, pr.bottom) - Math.max(er.top, pr.top)) + 'px';
            };
            updateOverlay();
            window.__globAuditUpdateOverflowRight = updateOverlay;
          }
          
          if (overflowLeft > 0) {
            const overlay = document.createElement('div');
            overlay.className = 'glob-audit-overlay glob-audit-overflow-left';
            overlay.style.cssText = 'position:fixed;background:rgba(239,68,68,0.15);border:2px dashed rgba(239,68,68,0.6);z-index:9999;pointer-events:none;box-sizing:border-box;';
            overlayContainer.appendChild(overlay);
            
            const updateOverlay = () => {
              const er = targetElement.getBoundingClientRect();
              const pr = parentElement.getBoundingClientRect();
              overlay.style.left = er.left + 'px';
              overlay.style.top = Math.max(er.top, pr.top) + 'px';
              overlay.style.width = Math.max(0, pr.left - er.left) + 'px';
              overlay.style.height = (Math.min(er.bottom, pr.bottom) - Math.max(er.top, pr.top)) + 'px';
            };
            updateOverlay();
            window.__globAuditUpdateOverflowLeft = updateOverlay;
          }
          
          if (overflowBottom > 0) {
            const overlay = document.createElement('div');
            overlay.className = 'glob-audit-overlay glob-audit-overflow-bottom';
            overlay.style.cssText = 'position:fixed;background:rgba(239,68,68,0.15);border:2px dashed rgba(239,68,68,0.6);z-index:9999;pointer-events:none;box-sizing:border-box;';
            overlayContainer.appendChild(overlay);
            
            const updateOverlay = () => {
              const er = targetElement.getBoundingClientRect();
              const pr = parentElement.getBoundingClientRect();
              overlay.style.left = Math.max(er.left, pr.left) + 'px';
              overlay.style.top = pr.bottom + 'px';
              overlay.style.width = (Math.min(er.right, pr.right) - Math.max(er.left, pr.left)) + 'px';
              overlay.style.height = Math.max(0, er.bottom - pr.bottom) + 'px';
            };
            updateOverlay();
            window.__globAuditUpdateOverflowBottom = updateOverlay;
          }
          
          if (overflowTop > 0) {
            const overlay = document.createElement('div');
            overlay.className = 'glob-audit-overlay glob-audit-overflow-top';
            overlay.style.cssText = 'position:fixed;background:rgba(239,68,68,0.15);border:2px dashed rgba(239,68,68,0.6);z-index:9999;pointer-events:none;box-sizing:border-box;';
            overlayContainer.appendChild(overlay);
            
            const updateOverlay = () => {
              const er = targetElement.getBoundingClientRect();
              const pr = parentElement.getBoundingClientRect();
              overlay.style.left = Math.max(er.left, pr.left) + 'px';
              overlay.style.top = er.top + 'px';
              overlay.style.width = (Math.min(er.right, pr.right) - Math.max(er.left, pr.left)) + 'px';
              overlay.style.height = Math.max(0, pr.top - er.top) + 'px';
            };
            updateOverlay();
            window.__globAuditUpdateOverflowTop = updateOverlay;
          }
          
          // Create legend
          createLegend(${parentOverflowLegendItems});
          
          let rafId = null;
          const updatePosition = () => {
            // Update overflow overlays on scroll
            if (window.__globAuditUpdateOverflowRight) window.__globAuditUpdateOverflowRight();
            if (window.__globAuditUpdateOverflowLeft) window.__globAuditUpdateOverflowLeft();
            if (window.__globAuditUpdateOverflowBottom) window.__globAuditUpdateOverflowBottom();
            if (window.__globAuditUpdateOverflowTop) window.__globAuditUpdateOverflowTop();
            
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
