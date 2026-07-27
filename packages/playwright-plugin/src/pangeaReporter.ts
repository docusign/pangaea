// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

export interface PangeaReporterOptions {
  /**
   * The attachment name to print when a test finishes.
   * @default "globalization-audit-output"
   */
  attachmentName?: string;
  /**
   * Suppress all Playwright test step output while preserving test-level lines.
   * @default true
   */
  suppressStepOutput?: boolean;
  /**
   * Additional RegExp patterns to suppress from terminal output.
   */
  suppressPatterns?: RegExp[];
}

class PangeaReporter implements Reporter {
  private readonly attachmentName: string;
  private readonly suppressStepOutput: boolean;
  private readonly suppressPatterns: RegExp[];
  private originalStdoutWrite?: typeof process.stdout.write;
  private auditOutputs: string[] = [];
  private lastChunkSuppressed = false;
  private consecutiveBlankChunks = 0;

  constructor(options?: PangeaReporterOptions) {
    this.attachmentName = options?.attachmentName ?? 'globalization-audit-output';
    this.suppressStepOutput = options?.suppressStepOutput ?? true;
    this.suppressPatterns = options?.suppressPatterns ?? [];
  }

  private restoreStdout = (): void => {
    if (this.originalStdoutWrite) {
      process.stdout.write = this.originalStdoutWrite;
      this.originalStdoutWrite = undefined;
    }
  };

  onBegin(): void {
    if (!this.suppressStepOutput && this.suppressPatterns.length === 0) return;

    this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.on('uncaughtException', this.restoreStdout);
    process.on('unhandledRejection', this.restoreStdout);

    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    (process.stdout.write as unknown) = function (
      chunk: Uint8Array | string,
      encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
      cb?: (err?: Error | null) => void,
    ): boolean {
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      const filtered = self.filter(text);
      const done = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
      if (filtered.length === 0) {
        done?.();
        return true;
      }
      return self.originalStdoutWrite!(filtered, done as BufferEncoding | undefined);
    };
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find((a) => a.name.startsWith(this.attachmentName));

    if (attachment?.path) {
      try {
        this.auditOutputs.push(readFileSync(attachment.path, 'utf-8'));
      } catch {
        // File may not be available yet on some runners.
      }
      return;
    }

    if (attachment?.body) {
      this.auditOutputs.push(attachment.body.toString());
    }
  }

  onEnd(_result: FullResult): void {
    this.restoreStdout();
    process.removeListener('uncaughtException', this.restoreStdout);
    process.removeListener('unhandledRejection', this.restoreStdout);

    if (this.auditOutputs.length > 0) {
      const write = process.stdout.write.bind(process.stdout);
      write('\n');
      for (const output of this.auditOutputs) {
        write(`${output}\n`);
      }
    }

    this.auditOutputs = [];
    this.lastChunkSuppressed = false;
    this.consecutiveBlankChunks = 0;
  }

  private filter(text: string): string {
    // Strip CSI sequences (including DEC private-mode like \u001b[?25l) and \r
    const csiRegex = new RegExp(String.raw`\u001b\[[\x20-\x3f]*[\x40-\x7e]`, 'g');
    const stripped = text.replace(csiRegex, '').replace(/\r/g, '');

    // No visible (non-whitespace) content: ANSI sequences, cursor moves,
    // carriage returns, newlines, or whitespace only.
    if (!/\S/.test(stripped)) {
      // Swallow trailing control sequences / whitespace after suppressed steps
      if (this.lastChunkSuppressed) return '';
      // Safety cap: prevent more than 2 consecutive blank/control-only chunks
      this.consecutiveBlankChunks++;
      if (this.consecutiveBlankChunks > 2) return '';
      return text;
    }

    // Visible content — reset blank-chunk counter
    this.consecutiveBlankChunks = 0;

    // Check if this visible chunk should be suppressed (step output or custom patterns)
    if (this.shouldSuppressChunk(stripped)) {
      this.lastChunkSuppressed = true;
      return '';
    }

    // Visible, non-suppressed content passes through
    this.lastChunkSuppressed = false;
    return text;
  }

  private shouldSuppressChunk(strippedText: string): boolean {
    if (this.suppressStepOutput) {
      // Step lines have › but NO file:line:col pattern.
      // Test lines always have file.ext:line:col.
      if (/›/.test(strippedText) && !/\.\w+:\d+:\d+/.test(strippedText)) {
        return true;
      }
    }

    return (
      this.suppressPatterns.length > 0 && this.suppressPatterns.some((p) => p.test(strippedText))
    );
  }
}

export default PangeaReporter;
