// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Utility function to print/save the audit report as PDF
 *
 * This function handles:
 * - Expanding all accordions temporarily
 * - Collecting all CSS styles from the page
 * - Creating a new window with the complete HTML
 * - Triggering the print dialog
 * - Restoring accordion states to original
 */

/**
 * Expands all collapsed accordion items by clicking them
 * @returns Array of elements that were expanded (so we can restore them)
 */
const expandAccordions = (): Element[] => {
  // Look for all elements with aria-expanded="false"
  const collapsedElements = Array.from(document.querySelectorAll('[aria-expanded="false"]'));
  // Click each one with a small delay between clicks
  collapsedElements.forEach((element, index) => {
    setTimeout(() => {
      try {
        (element as HTMLElement).click();
        console.warn(`Clicked accordion item ${index + 1}/${collapsedElements.length}`);
      } catch (e) {
        console.warn('Could not click element:', e);
      }
    }, index * 50); // 50ms delay between each click
  });

  // Return the elements so we can collapse them back later
  return collapsedElements;
};

/**
 * Restores accordion states by clicking them back to collapsed
 * @param elements - Array of elements to restore
 */
const restoreAccordions = (elements: Element[]): void => {
  elements.forEach((element, index) => {
    setTimeout(() => {
      try {
        (element as HTMLElement).click();
        console.warn(`Restored accordion item ${index + 1}/${elements.length}`);
      } catch (e) {
        console.warn('Could not restore element:', e);
      }
    }, index * 50);
  });
};

/**
 * Collects all CSS styles from the current page
 * @returns String containing all CSS rules
 */
const collectStyles = (): string => {
  return Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        // Can't access cross-origin stylesheets
        console.warn('Could not access stylesheet:', styleSheet.href);
        return '';
      }
    })
    .join('\n');
};

/**
 * Prints the current audit report page
 * Opens a new window with all content and styles, then triggers print dialog
 */
export const printReport = (): void => {
  // First, expand all accordions by finding and clicking on them
  // Track which ones we expanded so we can restore them later
  const expandedElements = expandAccordions();

  // Wait for all accordions to expand before capturing content
  // Calculate wait time based on number of items (50ms per item + 500ms buffer)
  const waitTime = Math.max(500, expandedElements.length * 50 + 500);

  setTimeout(() => {
    // Collect all stylesheet contents
    const styles = collectStyles();

    // Get the body content
    const bodyContent = document.body.innerHTML;

    // Create a complete HTML document with all styles
    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Docusign Pangæa Audit Report</title>
          <style>
            ${styles}
            /* Force all accordions to be expanded and hide non-print elements */
            @media print {
              /* Hide elements marked as no-print */
              .no-print {
                display: none !important;
              }
              
              /* Force accordion buttons to be hidden */
              [role="button"][aria-expanded] {
                display: none !important;
              }
              
              /* Force accordion content to be visible */
              [aria-hidden="true"] {
                display: block !important;
                visibility: visible !important;
                height: auto !important;
                opacity: 1 !important;
              }
            }
          </style>
        </head>
        <body>
          ${bodyContent}
        </body>
      </html>
    `;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Restore accordions immediately after capturing content
    restoreAccordions(expandedElements);

    // Open in a new window where print() will work
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Clean up the object URL after printing
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 500);
      };
    }
  }, waitTime);
};
