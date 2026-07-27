// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, AnalyzerStrategy } from '../../types/types';
import { safeFinder } from '../../utils/safeFinder';
import type { EncodingAnalyzerContext } from './types';

/**
 * Checks <meta charset> (HTML5) and <meta http-equiv="Content-Type"> (HTML4)
 * against the expected encoding.
 */
export class MetaCharsetStrategy implements AnalyzerStrategy<EncodingAnalyzerContext> {
  readonly name = 'MetaCharsetStrategy';

  analyze(context: EncodingAnalyzerContext): Issue[] {
    const issues: Issue[] = [];

    issues.push(...this.checkHtml5MetaCharset(context));
    issues.push(...this.checkHtml4MetaContentType(context));

    return issues;
  }

  private checkHtml5MetaCharset(context: EncodingAnalyzerContext): Issue[] {
    const meta = context.document.querySelector('meta[charset]');
    if (!meta) return [];

    const declared = meta.getAttribute('charset') ?? '';
    if (declared.toUpperCase() === context.expectedEncoding.toUpperCase()) return [];

    return [
      {
        id: crypto.randomUUID(),
        type: 'encoding-mismatch-meta-charset',
        severity: 'critical',
        message: `Meta charset is '${declared}' but expected '${context.expectedEncoding}'.`,
        elementSelector: safeFinder(meta),
        remediation: {
          docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-charset',
          suggestion: `Update meta charset to: <meta charset="${context.expectedEncoding}">`,
        },
      },
    ];
  }

  private checkHtml4MetaContentType(context: EncodingAnalyzerContext): Issue[] {
    const meta = context.document.querySelector('meta[http-equiv="Content-Type"]');
    if (!meta) return [];

    const content = meta.getAttribute('content') ?? '';
    const match = content.match(/charset=([^;]+)/i);
    if (!match) return [];

    const declared = match[1].trim();
    if (declared.toUpperCase() === context.expectedEncoding.toUpperCase()) return [];

    return [
      {
        id: crypto.randomUUID(),
        type: 'encoding-mismatch-meta-content-type',
        severity: 'critical',
        message: `Meta Content-Type charset is '${declared}' but expected '${context.expectedEncoding}'.`,
        elementSelector: safeFinder(meta),
        remediation: {
          docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv',
          suggestion: `Update meta Content-Type to: <meta http-equiv="Content-Type" content="text/html; charset=${context.expectedEncoding}">`,
        },
      },
    ];
  }
}
