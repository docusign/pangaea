// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Waits for the browser to complete layout after DOM changes.
 * Uses a double requestAnimationFrame — the first schedules work before the
 * next paint, and the second ensures that paint and any resulting reflow have
 * completed.
 */
export function waitForLayout(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
