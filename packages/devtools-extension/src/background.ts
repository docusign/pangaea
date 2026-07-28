// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { AuditMessage } from './types';

// Store multiple ports per tab (e.g., main audit messaging + highlight listeners)
const panelsPorts: Record<number, chrome.runtime.Port[]> = {};

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith('devtools-')) return;

  // Extract tabId from port name (supports devtools-{tabId} and devtools-*-{tabId})
  const parts = port.name.split('-');
  const tabId = parseInt(parts[parts.length - 1], 10);

  if (isNaN(tabId)) return;

  if (!panelsPorts[tabId]) {
    panelsPorts[tabId] = [];
  }
  panelsPorts[tabId].push(port);

  port.onDisconnect.addListener(() => {
    const ports = panelsPorts[tabId];
    if (ports) {
      const index = ports.indexOf(port);
      if (index > -1) {
        ports.splice(index, 1);
      }
      if (ports.length === 0) {
        delete panelsPorts[tabId];
      }
    }
  });
});

chrome.runtime.onMessage.addListener((msg: AuditMessage, sender) => {
  const tabId = sender.tab?.id;
  if (tabId && panelsPorts[tabId]) {
    // Forward message to all connected ports for this tab
    for (const port of panelsPorts[tabId]) {
      port.postMessage(msg);
    }
  }
});
