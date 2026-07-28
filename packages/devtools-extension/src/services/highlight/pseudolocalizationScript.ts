// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/** Generates pseudolocalization function for layout flow highlights */

export function generatePseudolocalizationFunction(): string {
  return `
    function applyPseudolocalization(rootElement, isShrinkage) {
      const originalTexts = [];
      const pseudolocalizeText = window.globAudit?.default?.pseudolocalizeText;
      
      if (!pseudolocalizeText) {
        console.error('pseudolocalizeText not available in globAudit bundle');
        return originalTexts;
      }
      
      const textDisplayElements = new Set([
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'blockquote', 'pre',
        'li', 'dt', 'dd', 'figcaption', 'caption', 'legend', 'summary', 'address',
        'span', 'a', 'button', 'label', 'strong', 'em', 'b', 'i', 'u', 's',
        'code', 'kbd', 'samp', 'var', 'cite', 'abbr', 'time', 'mark', 'small',
        'sub', 'sup', 'q', 'dfn', 'ins', 'del', 'bdi', 'bdo', 'td', 'th',
        'option', 'textarea', 'output', 'article', 'section', 'nav', 'aside',
        'header', 'footer', 'main', 'figure', 'details'
      ]);
      
      const processedNodes = new WeakSet();
      const elements = [rootElement, ...Array.from(rootElement.querySelectorAll('*'))];
      
      for (const element of elements) {
        const tagName = element.tagName?.toLowerCase();
        if (!tagName || !textDisplayElements.has(tagName)) continue;
        
        const styles = window.getComputedStyle(element);
        if (styles.display === 'none' || styles.visibility === 'hidden') continue;
        
        for (const child of Array.from(element.childNodes)) {
          if (child.nodeType === 3 && child.textContent?.trim() && !processedNodes.has(child)) {
            const originalText = child.textContent;
            originalTexts.push({ node: child, originalText });
            processedNodes.add(child);
            
            // Use shared pseudolocalizeText function for consistent expansion
            child.textContent = pseudolocalizeText(originalText);
          }
        }
      }
      
      return originalTexts;
    }
  `;
}
