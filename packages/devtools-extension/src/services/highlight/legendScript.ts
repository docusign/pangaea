// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Generates legend box for highlight visualizations */

export interface LegendItem {
  color: string;
  borderStyle: 'solid' | 'dashed';
  label: string;
}

/**
 * Generates a function that creates a legend box in the corner of the viewport.
 * The legend shows what each color/style represents and includes a close button.
 * Uses dir="ltr" to be immune to RTL direction changes.
 * Preserves position across highlight changes.
 */
export function generateLegendFunction(): string {
  return `
    function createLegend(items) {
      // Save position of existing legend before removing
      const existingLegend = document.getElementById('glob-audit-legend');
      let savedPosition = null;
      if (existingLegend) {
        savedPosition = {
          right: existingLegend.style.right,
          bottom: existingLegend.style.bottom
        };
        existingLegend.remove();
      } else if (window.__globAuditLegendPosition) {
        savedPosition = window.__globAuditLegendPosition;
      }
      
      const legend = document.createElement('div');
      legend.id = 'glob-audit-legend';
      legend.className = 'glob-audit-overlay';
      legend.setAttribute('dir', 'ltr'); // Immune to RTL changes
      legend.style.cssText = \`
        position: fixed;
        bottom: \${savedPosition ? savedPosition.bottom : '20px'};
        right: \${savedPosition ? savedPosition.right : '20px'};
        left: auto;
        background: rgba(30, 30, 30, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        z-index: 10001;
        pointer-events: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        min-width: 180px;
        cursor: move;
        user-select: none;
      \`;
      
      // Header with close button
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;';
      
      const title = document.createElement('span');
      title.style.cssText = 'font-weight: 600; font-size: 14px; color: #fff;';
      title.textContent = 'Legend';
      header.appendChild(title);
      
      const closeBtn = document.createElement('button');
      closeBtn.id = 'glob-audit-legend-close';
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = \`
        background: none;
        border: none;
        color: rgba(255,255,255,0.7);
        font-size: 16px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.2s;
      \`;
      closeBtn.onmouseenter = () => closeBtn.style.color = '#fff';
      closeBtn.onmouseleave = () => closeBtn.style.color = 'rgba(255,255,255,0.7)';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        if (window.__globAuditCleanup) {
          window.__globAuditCleanup();
        }
        window.postMessage({ source: 'glob-audit-extension', type: 'HIGHLIGHT_CLEARED' }, '*');
      };
      header.appendChild(closeBtn);
      legend.appendChild(header);
      
      // Legend items
      items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; margin: 6px 0;';
        
        const swatch = document.createElement('div');
        swatch.style.cssText = \`
          width: 20px;
          height: 14px;
          margin-right: 10px;
          border: 2px \${item.borderStyle} \${item.color};
          background: \${item.color}22;
          border-radius: 2px;
          flex-shrink: 0;
        \`;
        
        const label = document.createElement('span');
        label.style.cssText = 'color: rgba(255,255,255,0.9);';
        label.textContent = item.label;
        
        row.appendChild(swatch);
        row.appendChild(label);
        legend.appendChild(row);
      });
      
      // Make draggable
      let isDragging = false;
      let startX, startY, startRight, startBottom;
      
      legend.addEventListener('mousedown', (e) => {
        if (e.target === closeBtn) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startRight = parseInt(legend.style.right);
        startBottom = parseInt(legend.style.bottom);
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = startX - e.clientX;
        const deltaY = startY - e.clientY;
        legend.style.right = (startRight + deltaX) + 'px';
        legend.style.bottom = (startBottom + deltaY) + 'px';
      });
      
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          // Save position for next legend creation
          window.__globAuditLegendPosition = {
            right: legend.style.right,
            bottom: legend.style.bottom
          };
        }
        isDragging = false;
      });
      
      // Add to overlay container to avoid affecting page layout
      let overlayContainer = document.getElementById('glob-audit-overlay-container');
      if (!overlayContainer) {
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'glob-audit-overlay-container';
        overlayContainer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483647;';
        document.documentElement.appendChild(overlayContainer);
      }
      legend.style.pointerEvents = 'auto'; // Legend needs to be interactive
      overlayContainer.appendChild(legend);
      return legend;
    }
  `;
}

/** Legend configurations for different issue types */
export const LEGEND_CONFIGS = {
  rtlSymmetry: [
    { color: '#ef4444', borderStyle: 'solid', label: 'Current Position' },
    { color: '#10b981', borderStyle: 'dashed', label: 'Expected Position' },
  ],
  selfOverflow: [
    { color: '#ef4444', borderStyle: 'solid', label: 'Element Bounds' },
    { color: '#ef4444', borderStyle: 'dashed', label: 'Overflow Area' },
  ],
  parentOverflow: [
    { color: '#ef4444', borderStyle: 'solid', label: 'Parent Bounds' },
    { color: '#ef4444', borderStyle: 'dashed', label: 'Child Overflow' },
  ],
} as const;
