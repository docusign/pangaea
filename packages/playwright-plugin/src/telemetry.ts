// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

import type { AuditReport } from '@pangaea/core';

declare const LIBRARY_VERSION: string;

const SERVICE_NAME = 'pangaea-playwright';

/**
 * Returns the OTLP logs endpoint from the environment, or `undefined` when none
 * is configured. Telemetry is opt-in: there is no default collector, so nothing
 * is sent unless the consumer explicitly sets `OTEL_EXPORTER_OTLP_ENDPOINT`.
 */
function getOtlpLogsEndpoint(): string | undefined {
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, '');
  return base ? `${base}/v1/logs` : undefined;
}

/**
 * Reads the `name` field from the consumer's nearest package.json
 * (starting from cwd), falling back to CI env vars or 'unknown'.
 */
function getRepoId(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as {
      name?: string;
    };
    if (pkg.name) return pkg.name;
  } catch (e) {
    console.warn('package.json not readable — falling through:', e);
  }
  return (
    process.env.BUILD_REPOSITORY_NAME ??
    process.env.GITHUB_REPOSITORY ??
    process.env.CI_PROJECT_PATH ??
    'unknown'
  );
}

let loggerProvider: LoggerProvider | undefined;

function getLoggerProvider(endpoint: string): LoggerProvider {
  if (loggerProvider) return loggerProvider;

  const exporter = new OTLPLogExporter({
    url: endpoint,
    headers: {},
  });

  loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({ 'service.name': SERVICE_NAME }),
    processors: [new SimpleLogRecordProcessor({ exporter })],
  });

  return loggerProvider;
}

/**
 * Emits a single structured log record with all analyzer scores as attributes,
 * then waits for the HTTP request to complete before returning.
 *
 * Telemetry is opt-in and controlled via env vars (no consumer code required):
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — collector base URL; when unset, nothing is sent
 *   OTEL_SDK_DISABLED=true       — disables all telemetry
 */
export async function sendAuditMetrics(
  report: AuditReport,
  status: 'pass' | 'fail',
): Promise<void> {
  if (process.env.OTEL_SDK_DISABLED === 'true') return;

  const endpoint = getOtlpLogsEndpoint();
  if (!endpoint) return; // opt-in: no collector configured, so emit nothing

  const provider = getLoggerProvider(endpoint);
  const logger = provider.getLogger('@pangaea/playwright');

  const attributes: Record<string, string | number> = {
    repo_id: getRepoId(),
    library_version: LIBRARY_VERSION,
    status,
    env_type: process.env.CI ? 'ci' : 'local',
    url: report.url,
    ...Object.fromEntries(
      Object.entries(report.analyzerScores).map(([analyzer, score]) => [
        `analyzer.${analyzer}.score`,
        score,
      ]),
    ),
  };

  logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: 'glob_audit.run',
    attributes,
  });

  await provider.forceFlush();
}
