// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Page } from '@playwright/test';
import type { AuditReport, Issue } from '@pangaea-g11n/core';
import { promises as fs } from 'node:fs';
import { sendAuditMetrics } from './telemetry';
import { join } from 'path';

declare const CORE_IIFE_BUNDLE: string | undefined;

// Standard default threshold for analyzers that do not have explicit overrides.
export const ANALYZER_DEFAULT_THRESHOLD = 50;

export interface AuditThresholds {
  /** Overall globalization score threshold */
  globalizationScore?: number;
  /** Threshold for Right-To-Left layout analyzer */
  RTLAnalyzer?: number;
  /** Threshold for Encoding analyzer */
  EncodingAnalyzer?: number;
  /** Threshold for Layout Stability analyzer */
  LayoutStabilityAnalyzer?: number;
  /** Threshold for IME (Input Method Editor) analyzer */
  IMEAnalyzer?: number;
  /** Threshold for Language analyzer */
  LanguageAnalyzer?: number;
  /** Threshold for Collation analyzer */
  CollationAnalyzer?: number;
}

export interface RunAuditOptions {
  page: Page;
  thresholds: AuditThresholds;
  /**
   * Optional page identity used for artifact naming and report labels.
   * When omitted, runAudit operates in legacy mode and returns an AuditReport.
   */
  target?: PageTarget;
  /**
   * Optional directory to write result JSON and text output files.
   * When omitted, runAudit skips artifact writing.
   */
  resultArtifactsDir?: string;
  analyzerWeights?: Record<string, number>;
  errorSensitivity?: number;
  languageTarget?: string;
  /**
   * Fallback pass threshold for analyzers not explicitly listed in `thresholds`.
   * @default ANALYZER_DEFAULT_THRESHOLD (50)
   */
  defaultThreshold?: number;
  /**
   * Suppress the per-page text report when every analyzer score is 100.
   * @default true
   */
  suppressReportIfPerfect?: boolean;
  /**
   * Timeout (ms) for the core audit execution. Omit to run without a timeout cap.
   */
  timeoutMs?: number;
  /**
   * Retry once when a transient Playwright execution-context error is detected.
   * @default true
   */
  retryOnTransientContextError?: boolean;
  /**
   * Called before the audit starts. Use to navigate to the page and run
   * pre-flight checks. If this throws the audit is recorded as failed.
   */
  beforeAudit?: () => Promise<void>;
  /**
   * Called before the retry attempt. Use to wait for the page to recover
   * (e.g. waitForLoadState) after a transient context-destroyed error.
   */
  beforeRetry?: () => Promise<void>;
  /**
   * Optional callback invoked before the language analyzer phase.
   * Use this to switch the application locale via UI or other mechanisms.
   */
  changeLang?: () => Promise<void>;
  /**
   * Optional callback invoked after the language analyzer phase to restore
   * the original application locale.
   */
  revertLang?: () => Promise<void>;
  /**
   * Analyzer names that should execute in the locale-dependent phase.
   * @default ['LanguageAnalyzer', 'CollationAnalyzer']
   */
  localeDependentAnalyzerNames?: string[];
}

export type AuditIssue = {
  rule?: string;
  description?: string;
  severity?: string;
};

export interface MenuAuditResult {
  name: string;
  path: string;
  globalScore: number | null;
  analyzerScores: Record<string, number>;
  analyzerThresholdFailures: string[];
  thresholdFailures: string[];
  criticalIssues: AuditIssue[];
  totalIssues: number;
  audited: boolean;
  error?: string;
  /** Paths of written artifact files. Available after runAudit completes. */
  artifactFilePaths?: { resultFilePath: string; outputFilePath: string };
}

export interface PageTarget {
  name: string;
  path: string;
}

function createBaseResult(target: { name: string; path: string }): MenuAuditResult {
  return {
    name: target.name,
    path: target.path,
    globalScore: null,
    analyzerScores: {},
    analyzerThresholdFailures: [],
    thresholdFailures: [],
    criticalIssues: [],
    totalIssues: 0,
    audited: false,
  };
}

function getGlobalScoreThresholdFailure(
  report: Pick<AuditReport, 'globalizationScore'>,
  thresholds: AuditThresholds,
): string | null {
  if (thresholds.globalizationScore === undefined) {
    return null;
  }

  if (report.globalizationScore < thresholds.globalizationScore) {
    return `Overall globalization score (${report.globalizationScore}) is below threshold (${thresholds.globalizationScore})`;
  }

  return null;
}

function buildThresholdFailureSummary(failures: string[], report: AuditReport): string {
  return [
    'Globalization audit failed: One or more scores are below the configured thresholds',
    '',
    ...failures.map((f) => `  - ${f}`),
    '',
    `Overall Score: ${report.globalizationScore}/100`,
    `Issues Found: ${report.issues.length}`,
  ].join('\n');
}

function getThresholdFailures(
  report: AuditReport,
  thresholds: AuditThresholds,
  defaultThreshold: number,
): { analyzerFailures: string[]; failures: string[] } {
  const analyzerFailures = getAnalyzerThresholdFailures(
    report.analyzerScores ?? {},
    thresholds,
    defaultThreshold,
  );
  const globalFailure = getGlobalScoreThresholdFailure(report, thresholds);

  return {
    analyzerFailures,
    failures: globalFailure ? [globalFailure, ...analyzerFailures] : analyzerFailures,
  };
}

function getAnalyzerThresholdFailures(
  analyzerScores: Record<string, number>,
  thresholds: AuditThresholds,
  defaultThreshold: number,
): string[] {
  const thresholdOverrides = thresholds as Record<string, number | undefined>;

  return Object.entries(analyzerScores)
    .filter(([name, score]) => {
      const threshold = thresholdOverrides[name] ?? defaultThreshold;
      return score < threshold;
    })
    .map(([name, score]) => {
      const threshold = thresholdOverrides[name] ?? defaultThreshold;
      return `${name} score (${score}) is below threshold (${threshold})`;
    });
}

const DEFAULT_LANGUAGE_TARGET = 'en';
const DEFAULT_LOCALE_DEPENDENT_ANALYZERS = ['LanguageAnalyzer', 'CollationAnalyzer'] as const;

type BrowserAuditReport = {
  analyzerScores: Record<string, number>;
  globalizationScore: number;
  timestamp: string;
  url: string;
  issues: unknown[];
};

let coreBundleCache: string | null = null;

function normalizeAuditLanguageTarget(languageTarget?: string): string {
  const explicitTarget = languageTarget?.trim();
  const target = explicitTarget || DEFAULT_LANGUAGE_TARGET;
  return target.replace('_', '-');
}

function getCoreBundle(): string {
  if (!coreBundleCache) {
    const inlinedBundle =
      typeof CORE_IIFE_BUNDLE === 'string' && CORE_IIFE_BUNDLE.length > 0 ? CORE_IIFE_BUNDLE : '';
    coreBundleCache = inlinedBundle;
  }
  return coreBundleCache;
}

async function runWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function isTransientExecutionContextError(message: string): boolean {
  return (
    message.includes('Execution context was destroyed') ||
    message.includes('Cannot find context with specified id') ||
    message.includes('Most likely the page has been closed')
  );
}

/**
 * Extracts the function source starting at a given line/column in a script.
 * CDP listeners provide scriptId + lineNumber + columnNumber which point to the
 * start of the handler function within the full script source.
 *
 * Uses brace-matching to extract the complete function body.
 */
function extractFunctionSource(
  scriptSource: string,
  lineNumber: number,
  columnNumber: number,
): string {
  const lines = scriptSource.split('\n');
  // CDP lineNumber is 0-based
  if (lineNumber >= lines.length) return '';

  // Build substring starting from the handler position
  const startLine = lines[lineNumber];
  const fragment = startLine.slice(columnNumber) + '\n' + lines.slice(lineNumber + 1).join('\n');

  // Find the opening brace of the function
  const openBrace = fragment.indexOf('{');
  if (openBrace === -1) {
    // Arrow function without braces, e.g. `(e) => console.log(e)`
    // Return everything up to the first newline or semicolon
    const match = fragment.match(/^[^{}\n;]+/);
    return match ? match[0].trim() : '';
  }

  // Match braces to find the end of the function body
  let depth = 0;
  for (let i = 0; i < fragment.length; i++) {
    if (fragment[i] === '{') depth++;
    else if (fragment[i] === '}') {
      depth--;
      if (depth === 0) {
        return fragment.slice(0, i + 1).trim();
      }
    }
  }

  // If braces didn't balance, return what we have (up to a reasonable limit)
  return fragment.slice(0, 500).trim();
}

/**
 * Pre-collects event listeners for all input/textarea elements via CDP.
 *
 * Uses Chrome DevTools Protocol's `DOMDebugger.getEventListeners` to retrieve
 * programmatic listeners that can't be detected from DOM attributes alone.
 * Each element is tagged with a `data-__gel-id` attribute for correlation.
 *
 * When `handler.description` is unavailable (common in headless Playwright),
 * falls back to `Debugger.getScriptSource` to extract function source from
 * the script at the listener's line/column position.
 *
 * @returns A serializable map: { elementId: { eventType: [functionSource, ...] } }
 *          Returns empty object on non-Chromium browsers or if CDP is unavailable.
 */
async function collectEventListeners(
  page: Page,
): Promise<Record<string, Record<string, string[]>>> {
  let client: Awaited<ReturnType<ReturnType<Page['context']>['newCDPSession']>> | undefined;
  try {
    client = await page.context().newCDPSession(page);
  } catch {
    // CDP not available (e.g., Firefox, WebKit)
    return {};
  }

  try {
    // Enable Debugger domain and capture script metadata (start offsets)
    const scriptMeta = new Map<string, { startLine: number; startColumn: number }>();
    client.on(
      'Debugger.scriptParsed',
      (params: { scriptId: string; startLine: number; startColumn: number }) => {
        scriptMeta.set(params.scriptId, {
          startLine: params.startLine,
          startColumn: params.startColumn,
        });
      },
    );
    await client.send('Debugger.enable');

    // Cache of script sources by scriptId
    const scriptCache = new Map<string, string>();

    // Tag elements with unique IDs for correlation between CDP and page contexts
    const elementCount = await page.evaluate(() => {
      const elements = document.querySelectorAll(
        'input, textarea, [contenteditable="true"], [contenteditable=""]',
      );
      elements.forEach((el, i) => {
        el.setAttribute('data-__gel-id', String(i));
      });
      return elements.length;
    });

    const listenerMap: Record<string, Record<string, string[]>> = {};

    for (let i = 0; i < elementCount; i++) {
      try {
        const { result } = (await client.send('Runtime.evaluate', {
          expression: `document.querySelector('[data-__gel-id="${i}"]')`,
          returnByValue: false,
        })) as { result: { objectId?: string } };

        if (result.objectId) {
          const { listeners } = (await client.send('DOMDebugger.getEventListeners', {
            objectId: result.objectId,
          })) as {
            listeners: Array<{
              type: string;
              scriptId?: string;
              lineNumber?: number;
              columnNumber?: number;
              handler?: { objectId?: string; description?: string };
            }>;
          };

          const grouped: Record<string, string[]> = {};
          for (const listener of listeners) {
            // Try handler.description first (available in some CDP contexts)
            let source = listener.handler?.description || '';

            // Fall back to extracting source from script via Debugger.getScriptSource
            if (!source && listener.scriptId && listener.lineNumber !== undefined) {
              try {
                if (!scriptCache.has(listener.scriptId)) {
                  const { scriptSource } = (await client.send('Debugger.getScriptSource', {
                    scriptId: listener.scriptId,
                  })) as { scriptSource: string };
                  scriptCache.set(listener.scriptId, scriptSource);
                }
                const fullSource = scriptCache.get(listener.scriptId) || '';

                // Convert document-level line/col to script-relative offsets
                const meta = scriptMeta.get(listener.scriptId);
                const relLine = meta ? listener.lineNumber - meta.startLine : listener.lineNumber;
                const relCol =
                  meta && listener.lineNumber === meta.startLine
                    ? (listener.columnNumber ?? 0) - meta.startColumn
                    : (listener.columnNumber ?? 0);

                source = extractFunctionSource(fullSource, relLine, relCol);
              } catch {
                // Script source unavailable
              }
            }

            if (source) {
              if (!grouped[listener.type]) grouped[listener.type] = [];
              grouped[listener.type].push(source);
            }
          }

          if (Object.keys(grouped).length > 0) {
            listenerMap[String(i)] = grouped;
          }
        }
      } catch {
        // Skip elements that fail
      }
    }

    await client.send('Debugger.disable').catch(() => {});

    return listenerMap;
  } catch {
    return {};
  } finally {
    if (client) {
      await client.detach().catch(() => {});
    }
  }
}

async function runAuditPhase(
  page: Page,
  params: {
    weightsJson: string;
    sensitivity?: number;
    listenerData: Record<string, Record<string, string[]>>;
    useListenerData: boolean;
    analyzerNames: string[];
  },
): Promise<BrowserAuditReport | null> {
  return page.evaluate(
    async ({
      weightsJson,
      sensitivity,
      listenerData,
      useListenerData,
      analyzerNames,
    }: typeof params) => {
      type AnalyzerInstance = { name: string; run: (root: HTMLElement) => Promise<unknown[]> };
      type AnalyzerCtor = new (options?: Record<string, unknown>) => AnalyzerInstance;
      type RuntimeApi = {
        AuditRunner: {
          runAudit: (
            rootElement: HTMLElement,
            url: string,
            analyzers: AnalyzerInstance[],
            analyzerWeights?: Record<string, number>,
            errorSensitivity?: number,
          ) => Promise<{
            analyzerScores: Record<string, number>;
            globalizationScore: number;
            timestamp: string;
            url: string;
            issues: unknown[];
          }>;
        };
      } & Record<string, unknown>;

      const runtime = (window as unknown as { GlobalizationAudit: RuntimeApi }).GlobalizationAudit;
      const { AuditRunner } = runtime;

      // Build a getEventListeners function from pre-collected CDP data
      const getEventListeners =
        useListenerData && listenerData
          ? (element: Element) => {
              const id = element.getAttribute('data-__gel-id');
              if (!id || !listenerData[id]) return {};

              const result: Record<string, { listener: (...args: unknown[]) => void }[]> = {};
              for (const [eventType, sources] of Object.entries(listenerData[id])) {
                result[eventType] = sources.map((source) => ({
                  listener: Object.assign(() => {}, {
                    toString: () => source,
                  }) as (...args: unknown[]) => void,
                }));
              }
              return result;
            }
          : undefined;

      const weights: Record<string, number> | undefined =
        weightsJson && weightsJson.length > 0
          ? (JSON.parse(weightsJson) as Record<string, number>)
          : undefined;

      function createAnalyzerInstances(analyzerNamesToCreate: string[]) {
        const imeAnalyzerName = 'IMEAnalyzer';

        return analyzerNamesToCreate
          .map((analyzerName) => {
            const Analyzer = runtime[analyzerName] as AnalyzerCtor | undefined;
            if (!Analyzer) {
              return null;
            }

            if (analyzerName === imeAnalyzerName) {
              return new Analyzer({ getEventListeners: getEventListeners ?? (() => ({})) });
            }

            return new Analyzer();
          })
          .filter(
            (
              analyzer,
            ): analyzer is { name: string; run: (root: HTMLElement) => Promise<unknown[]> } =>
              analyzer !== null,
          );
      }

      if (analyzerNames.length === 0) {
        return null;
      }

      const instances = createAnalyzerInstances(analyzerNames);
      if (instances.length === 0) {
        return null;
      }

      return AuditRunner.runAudit(
        document.documentElement,
        window.location.href,
        instances,
        weights,
        sensitivity,
      );
    },
    params,
  );
}

async function runAuditCore(
  page: Page,
  options: {
    thresholds: AuditThresholds;
    analyzerWeights?: Record<string, number>;
    errorSensitivity?: number;
    languageTarget?: string;
    changeLang?: () => Promise<void>;
    revertLang?: () => Promise<void>;
    localeDependentAnalyzerNames?: string[];
  },
): Promise<AuditReport> {
  try {
    const {
      thresholds,
      analyzerWeights,
      errorSensitivity,
      languageTarget,
      changeLang,
      revertLang,
      localeDependentAnalyzerNames,
    } = options;
    const normalizedLanguageTarget = normalizeAuditLanguageTarget(languageTarget);
    const disabledAnalyzers = new Set<string>(
      Object.entries(thresholds)
        .filter(
          ([analyzerName, threshold]) => analyzerName !== 'globalizationScore' && threshold === 0,
        )
        .map(([analyzerName]) => analyzerName),
    );

    const coreBundle = getCoreBundle();
    if (!coreBundle) {
      throw new Error(
        'Core engine bundle not found. Make sure @pangaea-g11n/core is built and available.',
      );
    }

    const currentUrl = page.url();

    await page.addInitScript(`
      ${coreBundle}
      window.GlobalizationAudit = GlobalizationAudit;
    `);

    await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const injectionCheck = (await page.evaluate(() => {
      return {
        isLoaded:
          typeof (window as { GlobalizationAudit?: unknown }).GlobalizationAudit !== 'undefined',
        exports: Object.keys(
          (window as { GlobalizationAudit?: Record<string, unknown> }).GlobalizationAudit || {},
        ),
      };
    })) as { isLoaded: boolean; exports: string[] };

    if (!injectionCheck.isLoaded) {
      throw new Error('Failed to inject GlobalizationAudit into the page');
    }

    // Collect programmatic event listeners via CDP analysis.
    // Retry once after a short settle delay when first pass is empty.
    let eventListenerData = await collectEventListeners(page);
    if (Object.keys(eventListenerData).length === 0) {
      await page.waitForTimeout(500);
      eventListenerData = await collectEventListeners(page);
    }
    const hasListenerData = Object.keys(eventListenerData).length > 0;

    const allAnalyzerNames = injectionCheck.exports.filter((name) => name.endsWith('Analyzer'));
    const localeDependentSet = new Set(
      localeDependentAnalyzerNames?.length && localeDependentAnalyzerNames.length > 0
        ? localeDependentAnalyzerNames
        : [...DEFAULT_LOCALE_DEPENDENT_ANALYZERS],
    );

    const nonLanguageAnalyzerNames = allAnalyzerNames.filter(
      (name) => !localeDependentSet.has(name) && !disabledAnalyzers.has(name),
    );
    const languageAnalyzerNames = allAnalyzerNames.filter(
      (name) => localeDependentSet.has(name) && !disabledAnalyzers.has(name),
    );

    let nonLanguageReport: BrowserAuditReport | null = null;
    let languageReport: BrowserAuditReport | null = null;
    let changeLangError: Error | null = null;
    let revertLangError: Error | null = null;
    const hasLocaleSwitch = Boolean(changeLang && revertLang);

    try {
      // Phase 1: Run non-language analyzers in default English
      nonLanguageReport = await runAuditPhase(page, {
        weightsJson: analyzerWeights ? JSON.stringify(analyzerWeights) : '',
        sensitivity: errorSensitivity,
        listenerData: eventListenerData,
        useListenerData: hasListenerData,
        analyzerNames: nonLanguageAnalyzerNames,
      });

      // Phase 2: Call changeLang callback if provided, then run language analyzer
      if (languageAnalyzerNames.length > 0) {
        if (hasLocaleSwitch) {
          try {
            await changeLang!();
          } catch (error) {
            changeLangError = error instanceof Error ? error : new Error(String(error));
            throw new Error(
              `Language switching callback (changeLang) failed: ${changeLangError.message}. Audit cannot proceed to language phase.`,
            );
          }
        }

        languageReport = await runAuditPhase(page, {
          weightsJson: analyzerWeights ? JSON.stringify(analyzerWeights) : '',
          sensitivity: errorSensitivity,
          listenerData: eventListenerData,
          useListenerData: hasListenerData,
          analyzerNames: languageAnalyzerNames,
        });
      }
    } finally {
      // Phase 3: Call revertLang callback if provided
      if (hasLocaleSwitch) {
        try {
          await revertLang!();
        } catch (error) {
          revertLangError = error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    // If revertLang failed, throw an error with context
    if (revertLangError) {
      throw new Error(
        `Audit completed but revert language callback (revertLang) failed: ${revertLangError.message}`,
      );
    }

    // Merge analyzer results from both phases
    const mergedAnalyzerScores: Record<string, number> = {
      ...(nonLanguageReport?.analyzerScores ?? {}),
      ...(languageReport?.analyzerScores ?? {}),
    };
    const mergedIssues = [...(nonLanguageReport?.issues ?? []), ...(languageReport?.issues ?? [])];

    // Compute merged globalization score in the browser where calculateOverallScore is available
    const mergedReport = (await page.evaluate(
      (params: { analyzerScores: Record<string, number>; weights?: Record<string, number> }) => {
        const globalizationAudit = (
          window as unknown as {
            GlobalizationAudit?: {
              calculateOverallScore?: (
                analyzerScores: Record<string, number>,
                weights?: Record<string, number>,
              ) => number;
            };
          }
        ).GlobalizationAudit;
        const calculateOverallScore = globalizationAudit?.calculateOverallScore;
        if (typeof calculateOverallScore !== 'function') {
          throw new Error('calculateOverallScore is not available in GlobalizationAudit');
        }
        return {
          analyzerScores: params.analyzerScores,
          globalizationScore: calculateOverallScore(params.analyzerScores, params.weights),
          timestamp: new Date().toISOString(),
          url: window.location.href,
          issues: [] as unknown[],
        };
      },
      { analyzerScores: mergedAnalyzerScores, weights: analyzerWeights },
    )) as {
      analyzerScores: Record<string, number>;
      globalizationScore: number;
      timestamp: string;
      url: string;
      issues: unknown[];
    };

    const report = Object.assign(mergedReport, {
      issues: mergedIssues,
      languageTarget: normalizedLanguageTarget,
    }) as AuditReport & { languageTarget?: string };

    // Clean up data attributes used for event listener correlation
    if (hasListenerData) {
      await page
        .evaluate(() => {
          document
            .querySelectorAll('[data-__gel-id]')
            .forEach((el) => el.removeAttribute('data-__gel-id'));
        })
        .catch(() => {});
    }

    return report;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Audit execution failed: ${String(error)}`);
  }
}

/**
 * Runs a globalization audit.
 *
 * When `target` is provided, returns a structured `MenuAuditResult` and reports
 * threshold failures in the result. When `target` is omitted, preserves the
 * legacy contract by returning `AuditReport` and throwing on threshold failure.
 *
 * @example
 * ```typescript
 * const result = await runAudit({
 *   page,
 *   target: { name: 'Plan and Billing', path: '/billing' },
 *   thresholds: { RTLAnalyzer: 60, EncodingAnalyzer: 60 },
 *   resultArtifactsDir: join(process.cwd(), 'reports'),
 *   timeoutMs: 150_000,
 *   beforeAudit: async () => { await page.goto('https://example.com/billing'); },
 * });
 * if (!result.audited) throw new Error(result.error);
 * ```
 */
export function runAudit(
  options: RunAuditOptions & { target: PageTarget },
): Promise<MenuAuditResult>;
export function runAudit(options: RunAuditOptions): Promise<AuditReport>;
export async function runAudit(options: RunAuditOptions): Promise<MenuAuditResult | AuditReport> {
  const {
    page,
    target,
    thresholds,
    resultArtifactsDir,
    analyzerWeights,
    errorSensitivity,
    languageTarget,
    defaultThreshold = ANALYZER_DEFAULT_THRESHOLD,
    suppressReportIfPerfect = true,
    timeoutMs,
    retryOnTransientContextError = true,
    beforeAudit,
    beforeRetry,
    changeLang,
    revertLang,
    localeDependentAnalyzerNames,
  } = options;
  const isStructuredMode = target !== undefined;
  const resolvedTarget = target ?? { name: 'Audited Page', path: '' };

  const coreOptions = {
    thresholds,
    analyzerWeights,
    errorSensitivity,
    languageTarget,
    changeLang,
    revertLang,
    localeDependentAnalyzerNames,
  };
  const baseResult = createBaseResult(resolvedTarget);

  try {
    if (beforeAudit) {
      await beforeAudit();
    }

    let report: AuditReport;
    try {
      const auditPromise = runAuditCore(page, coreOptions);
      report = timeoutMs
        ? await runWithTimeout(
            auditPromise,
            timeoutMs,
            `Page audit for "${resolvedTarget.name}" exceeded ${timeoutMs / 1000}s`,
          )
        : await auditPromise;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!retryOnTransientContextError || !isTransientExecutionContextError(message)) {
        throw error;
      }
      if (beforeRetry) await beforeRetry();
      const retryPromise = runAuditCore(page, coreOptions);
      report = timeoutMs
        ? await runWithTimeout(
            retryPromise,
            timeoutMs,
            `Page audit retry for "${resolvedTarget.name}" exceeded ${timeoutMs / 1000}s`,
          )
        : await retryPromise;
    }

    const result = mapAuditReportToResult(baseResult, report, thresholds, defaultThreshold);
    const thresholdFailures = result.thresholdFailures ?? result.analyzerThresholdFailures ?? [];

    const telemetryStatus = thresholdFailures.length > 0 ? 'fail' : 'pass';
    await sendAuditMetrics(report, telemetryStatus).catch(() => {});

    if (!isStructuredMode) {
      if (thresholdFailures.length > 0) {
        throw new Error(buildThresholdFailureSummary(thresholdFailures, report));
      }

      return report;
    }

    const auditReportText = formatAuditReport(report, {
      name: resolvedTarget.name,
      pagePath: resolvedTarget.path,
      suppressIfPerfect: suppressReportIfPerfect,
      localeDependentAnalyzerNames,
    });

    if (!resultArtifactsDir) {
      return result;
    }

    const artifactPaths = getArtifactPaths(resultArtifactsDir, resolvedTarget);
    await fs.mkdir(resultArtifactsDir, { recursive: true });
    await fs.writeFile(
      artifactPaths.resultFilePath,
      JSON.stringify({ ...result, artifactFilePaths: artifactPaths }, null, 2),
      'utf8',
    );
    await fs.writeFile(artifactPaths.outputFilePath, auditReportText, 'utf8');

    return { ...result, artifactFilePaths: artifactPaths };
  } catch (err) {
    if (!isStructuredMode) {
      if (err instanceof Error) {
        throw err;
      }

      throw new Error(String(err));
    }

    const failureResult: MenuAuditResult = {
      ...baseResult,
      audited: false,
      error: err instanceof Error ? err.message : String(err),
    };

    if (!resultArtifactsDir) {
      return failureResult;
    }

    const artifactPaths = getArtifactPaths(resultArtifactsDir, resolvedTarget);
    await fs.mkdir(resultArtifactsDir, { recursive: true }).catch(() => {});
    await fs
      .writeFile(
        artifactPaths.resultFilePath,
        JSON.stringify({ ...failureResult, artifactFilePaths: artifactPaths }, null, 2),
        'utf8',
      )
      .catch(() => {});
    await fs.writeFile(artifactPaths.outputFilePath, '', 'utf8').catch(() => {});
    return { ...failureResult, artifactFilePaths: artifactPaths };
  }
}

interface FormatAuditReportOptions {
  /** Human-readable page name, e.g. "Plan and Billing" */
  name?: string;
  /** Route path relative to widget root, e.g. "/billing" */
  pagePath?: string;
  /** Returns an empty string when every executed analyzer score is 100. */
  suppressIfPerfect?: boolean;
  /** Analyzer names that should be tagged with the active locale in output labels. */
  localeDependentAnalyzerNames?: string[];
}

const ISSUE_SEVERITY_ORDER = ['critical', 'serious', 'moderate', 'minor', 'info'] as const;

type IssueSeverity = (typeof ISSUE_SEVERITY_ORDER)[number];

function groupIssuesBySeverity(issues: Issue[]): Record<IssueSeverity, Issue[]> {
  const grouped: Record<IssueSeverity, Issue[]> = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
    info: [],
  };

  issues.forEach((issue) => {
    const severity = (issue.severity ?? 'info') as IssueSeverity;
    grouped[severity].push(issue);
  });

  return grouped;
}

function hasPerfectAnalyzerScores(report: AuditReport): boolean {
  const analyzerScores = Object.values(report.analyzerScores);

  if (analyzerScores.length === 0) {
    return false;
  }

  return analyzerScores.every((score) => score === 100);
}

function shouldIncludeAuditReport(
  report: AuditReport,
  options?: Pick<FormatAuditReportOptions, 'suppressIfPerfect'>,
): boolean {
  return !(options?.suppressIfPerfect && hasPerfectAnalyzerScores(report));
}

/**
 * Formats a human-readable audit report string.
 * Consumers can decide when/how to log to avoid test-reporter interleaving.
 */
function formatAuditReport(report: AuditReport, options?: FormatAuditReportOptions): string {
  if (!shouldIncludeAuditReport(report, options)) {
    return '';
  }

  const lines: string[] = [];
  const reportExt = report as AuditReport & { languageTarget?: string };
  const languageTarget = reportExt.languageTarget?.trim() ?? '';
  const localeDependentSet = new Set(
    options?.localeDependentAnalyzerNames?.length
      ? options.localeDependentAnalyzerNames
      : [...DEFAULT_LOCALE_DEPENDENT_ANALYZERS],
  );

  lines.push('\n' + '='.repeat(80));
  lines.push('GLOBALIZATION AUDIT REPORT');
  lines.push('='.repeat(80));
  if (options?.name !== undefined || options?.pagePath !== undefined) {
    const nameVal = options.name ?? '';
    const pathVal = options.pagePath ? `(${options.pagePath})` : '';
    lines.push(`Name(/Path): ${nameVal}${pathVal}`);
  }
  lines.push(`URL: ${report.url}`);
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push('-'.repeat(80));

  lines.push('\nAnalyzer Scores:');
  Object.entries(report.analyzerScores).forEach(([analyzer, rawScore]) => {
    const score = typeof rawScore === 'number' ? rawScore : 0;
    const analyzerLabel =
      localeDependentSet.has(analyzer) && languageTarget
        ? `${analyzer}(${languageTarget})`
        : analyzer;
    const status = score >= 70 ? '✓' : score >= 50 ? '⚠' : '✗';
    lines.push(`  ${status} ${analyzerLabel}: ${score}/100`);
  });

  if (report.issues.length > 0) {
    lines.push(`\nIssues Found: ${report.issues.length}`);
    lines.push('-'.repeat(80));

    const issuesBySeverity = groupIssuesBySeverity(report.issues);

    ISSUE_SEVERITY_ORDER.forEach((severity) => {
      const issues = issuesBySeverity[severity];
      if (issues.length > 0) {
        lines.push(`\n${severity.toUpperCase()} (${issues.length}):`);
        issues.forEach((issue, index) => {
          lines.push(`  ${index + 1}. [${issue.type}] ${issue.message || 'No description'}`);
          lines.push(`     Element: ${issue.elementSelector}`);
          if (issue.remediation) {
            lines.push(`     Suggestion: ${issue.remediation.suggestion}`);
            if (issue.remediation.docsUrl) {
              lines.push(`     Docs: ${issue.remediation.docsUrl}`);
            }
          }
        });
      }
    });
  } else {
    lines.push('\n✓ No issues found!');
  }

  lines.push('\n' + '='.repeat(80) + '\n');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Path and artifact utilities
// ---------------------------------------------------------------------------

function toSafeFileSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getSafePageId(target: Pick<PageTarget, 'name' | 'path'>): string {
  return `${toSafeFileSegment(target.name)}-${toSafeFileSegment(target.path)}`;
}

function getArtifactPaths(
  baseDir: string,
  target: Pick<PageTarget, 'name' | 'path'>,
): { resultFilePath: string; outputFilePath: string } {
  const safePageId = getSafePageId(target);
  return {
    resultFilePath: join(baseDir, `audit-result-${safePageId}.json`),
    outputFilePath: join(baseDir, `globalization-audit-output-${safePageId}.txt`),
  };
}

// ---------------------------------------------------------------------------
// Report mapping and summary composition
// ---------------------------------------------------------------------------

function mapAuditReportToResult(
  baseResult: MenuAuditResult,
  report: AuditReport,
  thresholds: AuditThresholds,
  defaultThreshold: number,
): MenuAuditResult {
  const issues = (report.issues ?? []) as AuditIssue[];
  const { analyzerFailures, failures } = getThresholdFailures(report, thresholds, defaultThreshold);

  return {
    ...baseResult,
    globalScore: report.globalizationScore ?? null,
    analyzerScores: report.analyzerScores ?? {},
    analyzerThresholdFailures: analyzerFailures,
    thresholdFailures: failures,
    criticalIssues: issues.filter((i) => i.severity === 'critical'),
    totalIssues: issues.length,
    audited: true,
    error: failures.length > 0 ? buildThresholdFailureSummary(failures, report) : undefined,
  };
}
