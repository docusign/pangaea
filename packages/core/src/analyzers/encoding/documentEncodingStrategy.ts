// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, AnalyzerStrategy } from '../../types/types';
import type { EncodingAnalyzerContext } from './types';

/**
 * Checks that document.characterSet matches the expected encoding.
 */
export class DocumentEncodingStrategy implements AnalyzerStrategy<EncodingAnalyzerContext> {
  readonly name = 'DocumentEncodingStrategy';

  analyze(context: EncodingAnalyzerContext): Issue[] {
    const actual = context.document.characterSet.toUpperCase();
    const expected = context.expectedEncoding.toUpperCase();
    if (actual === expected) {
      return [];
    }

    return [
      {
        id: crypto.randomUUID(),
        type: 'encoding-mismatch-document',
        severity: 'critical',
        message: `Document character set is '${context.document.characterSet}' but expected '${context.expectedEncoding}'.`,
        elementSelector: 'html',
        remediation: {
          docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/Document/characterSet',
          suggestion: `Ensure the document is served with the correct '${context.expectedEncoding}' encoding.`,
        },
      },
    ];
  }
}
