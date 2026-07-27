// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { useEffect, useRef } from 'react';
import type { AuditMessage } from '../types';

/**
 * Hook that listens for HIGHLIGHT_CLEARED messages from the inspected page.
 * Called when the user closes the highlight legend.
 *
 * @param onHighlightCleared - Callback to invoke when highlight is cleared
 */
export function useHighlightCleared(onHighlightCleared: () => void): void {
  const callbackRef = useRef(onHighlightCleared);
  callbackRef.current = onHighlightCleared;

  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    const port = chrome.runtime.connect({ name: `devtools-highlight-${tabId}` });

    const handleMessage = (msg: AuditMessage) => {
      if (msg.source === 'glob-audit-extension' && msg.type === 'HIGHLIGHT_CLEARED') {
        callbackRef.current();
      }
    };

    port.onMessage.addListener(handleMessage);

    return () => {
      port.onMessage.removeListener(handleMessage);
      port.disconnect();
    };
  }, []);
}
