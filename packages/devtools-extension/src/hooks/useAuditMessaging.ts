// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AuditReport, AuditProgress } from '@pangaea-g11n/core';
import type { AuditMessage } from '../types';
import { DevToolsService } from '../services/devtoolsService';

interface UseAuditMessagingOptions {
  timeoutMs?: number;
}

interface UseAuditMessagingReturn {
  report: AuditReport | null;
  error: string | null;
  isLoading: boolean;
  progress: AuditProgress | null;
  runAudit: (opts: {
    runRTL: boolean;
    runEncoding: boolean;
    runLayoutStability: boolean;
    runIME: boolean;
    runLanguage: boolean;
    runCollation: boolean;
  }) => void;
  reset: () => void;
}

export function useAuditMessaging(options: UseAuditMessagingOptions = {}): UseAuditMessagingReturn {
  const { timeoutMs = 60000 } = options;
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<AuditProgress | null>(null);

  const activeRequestIdRef = useRef<string | null>(null);
  const auditTimeoutRef = useRef<number | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const isMountedRef = useRef(true);

  // Track remaining timeout when the inspected tab becomes inactive.
  // Chrome throttles/suspends inactive tabs, so the audit script stalls.
  // We pause the timer to avoid a false timeout, and resume when the tab is re-activated.
  const timeoutRemainingRef = useRef<number | null>(null);
  const timeoutStartedAtRef = useRef<number | null>(null);

  // Handle incoming messages
  const handleMessage = useCallback((msg: AuditMessage) => {
    if (msg.source !== 'glob-audit-extension') return;
    if (
      activeRequestIdRef.current &&
      msg.requestId &&
      msg.requestId !== activeRequestIdRef.current
    ) {
      return; // Ignore stale request messages
    }

    if (msg.type === 'GLOB_AUDIT_PROGRESS') {
      // Update progress without clearing timeout
      if (msg.progress) {
        setProgress(msg.progress);
      }
      return;
    }

    // Clear timeout
    if (auditTimeoutRef.current) {
      clearTimeout(auditTimeoutRef.current);
      auditTimeoutRef.current = null;
    }
    timeoutRemainingRef.current = null;
    timeoutStartedAtRef.current = null;

    if (msg.type === 'GLOB_AUDIT_RESULT') {
      setIsLoading(false);
      setProgress(null);
      setReport(msg.result as AuditReport);
    } else if (msg.type === 'GLOB_AUDIT_ERROR') {
      setIsLoading(false);
      setProgress(null);
      setError(`Error: ${msg.error}`);
      setReport(null);
    }
  }, []);

  // Reconnect logic
  const connectPort = useCallback(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;

    if (portRef.current) {
      portRef.current.onMessage.removeListener(handleMessage);
      portRef.current.onDisconnect.removeListener(handleDisconnect);
      portRef.current.disconnect();
    }

    const port = chrome.runtime.connect({ name: `devtools-${tabId}` });
    portRef.current = port;
    port.onMessage.addListener(handleMessage);
    port.onDisconnect.addListener(handleDisconnect);
  }, [handleMessage]);

  const handleDisconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    // Attempt silent reconnect
    setTimeout(() => {
      if (isMountedRef.current) {
        connectPort();
      }
    }, 100);
  }, [connectPort]);

  useEffect(() => {
    connectPort();
    return () => {
      isMountedRef.current = false;
      if (portRef.current) {
        portRef.current.onMessage.removeListener(handleMessage);
        portRef.current.onDisconnect.removeListener(handleDisconnect);
        portRef.current.disconnect();
        portRef.current = null;
      }
      if (auditTimeoutRef.current) {
        clearTimeout(auditTimeoutRef.current);
      }
    };
  }, [connectPort, handleDisconnect, handleMessage]);

  // Pause/resume the audit timeout when the inspected tab becomes inactive/active.
  // Chrome throttles inactive tabs, causing the audit script to stall.
  const startTimeout = useCallback((ms: number) => {
    if (auditTimeoutRef.current) {
      clearTimeout(auditTimeoutRef.current);
    }
    timeoutStartedAtRef.current = Date.now();
    timeoutRemainingRef.current = ms;
    auditTimeoutRef.current = window.setTimeout(() => {
      setIsLoading(false);
      setError(
        'Audit timed out. The page may not be responding. Please try refreshing the page and running the audit again.',
      );
      auditTimeoutRef.current = null;
      timeoutRemainingRef.current = null;
      timeoutStartedAtRef.current = null;
    }, ms);
  }, []);

  useEffect(() => {
    const inspectedTabId = chrome.devtools.inspectedWindow.tabId;

    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      if (!auditTimeoutRef.current && !timeoutRemainingRef.current) return;

      if (activeInfo.tabId === inspectedTabId) {
        // Inspected tab re-activated — resume the timeout with remaining time
        const remaining = timeoutRemainingRef.current;
        if (remaining && remaining > 0) {
          startTimeout(remaining);
        }
      } else {
        // Switched away from the inspected tab — pause the timeout
        if (auditTimeoutRef.current && timeoutStartedAtRef.current) {
          const elapsed = Date.now() - timeoutStartedAtRef.current;
          const remaining = (timeoutRemainingRef.current ?? timeoutMs) - elapsed;
          clearTimeout(auditTimeoutRef.current);
          auditTimeoutRef.current = null;
          timeoutRemainingRef.current = Math.max(remaining, 0);
          timeoutStartedAtRef.current = null;
        }
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [startTimeout, timeoutMs]);

  const runAudit = useCallback(
    (opts: {
      runRTL: boolean;
      runEncoding: boolean;
      runLayoutStability: boolean;
      runIME: boolean;
      runLanguage: boolean;
      runCollation: boolean;
    }) => {
      setIsLoading(true);
      setReport(null);
      setError(null);
      const requestId = uuidv4();
      activeRequestIdRef.current = requestId;

      if (auditTimeoutRef.current) {
        clearTimeout(auditTimeoutRef.current);
      }

      startTimeout(timeoutMs);

      DevToolsService.runGlobalizationAudit(
        {
          runRTL: opts.runRTL,
          runEncoding: opts.runEncoding,
          runLayoutStability: opts.runLayoutStability,
          runIME: opts.runIME,
          runLanguage: opts.runLanguage,
          runCollation: opts.runCollation,
        },
        requestId,
      );
    },
    [startTimeout, timeoutMs],
  );

  const reset = useCallback(() => {
    setReport(null);
    setError(null);
    setProgress(null);
    activeRequestIdRef.current = null;
    timeoutRemainingRef.current = null;
    timeoutStartedAtRef.current = null;
    if (auditTimeoutRef.current) {
      clearTimeout(auditTimeoutRef.current);
      auditTimeoutRef.current = null;
    }
  }, []);

  return { report, error, isLoading, progress, runAudit, reset };
}
