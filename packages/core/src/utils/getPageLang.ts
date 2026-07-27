// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

// Extracts the page's language from the html element's lang attribute.
export function getPageLang(rootElement: HTMLElement): string {
  const doc = rootElement.ownerDocument;
  const htmlEl = doc.documentElement;
  return (htmlEl.getAttribute('lang') ?? '').trim().toLowerCase();
}
