// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AuditMessage } from './types';

window.addEventListener('message', (event: MessageEvent<AuditMessage>) => {
  if (event.source !== window) return;
  if (event.data?.source !== 'glob-audit-extension') return;

  // Guard against contexts where chrome.runtime is not available
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.warn('[glob-audit] chrome.runtime not available in this context');
    return;
  }

  void chrome.runtime.sendMessage(event.data);
});
