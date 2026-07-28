// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Analyzer, Issue, AnalyzerStrategy } from '../../types/types';
import { DocumentEncodingStrategy } from './documentEncodingStrategy';
import { MetaCharsetStrategy } from './metaCharsetStrategy';
import { MojibakeStrategy } from './mojibakeStrategy';
import type { EncodingAnalyzerContext } from './types';

export enum HtmlEncoding {
  UTF8 = 'UTF-8',
  UTF16LE = 'UTF-16LE',
  UTF16BE = 'UTF-16BE',
  ISO88591 = 'ISO-8859-1',
  WINDOWS1252 = 'Windows-1252',
  SHIFT_JIS = 'Shift_JIS',
  EUC_JP = 'EUC-JP',
  GB2312 = 'GB2312',
  GBK = 'GBK',
  BIG5 = 'Big5',
  EUC_KR = 'EUC-KR',
  ISO88592 = 'ISO-8859-2',
  ISO88595 = 'ISO-8859-5',
  ISO88596 = 'ISO-8859-6',
  ISO88597 = 'ISO-8859-7',
  ISO88598 = 'ISO-8859-8',
  WINDOWS1251 = 'Windows-1251',
  WINDOWS1256 = 'Windows-1256',
}

export interface EncodingAnalyzerOptions {
  encoding?: HtmlEncoding;
  mojibakeDetectionThreshold?: number;
}

/**
 * Detects encoding mismatches and mojibake in HTML documents.
 *
 * @example
 * const analyzer = new EncodingAnalyzer();
 * const issues = await analyzer.run(document.documentElement);
 */
export class EncodingAnalyzer implements Analyzer {
  public readonly name = 'EncodingAnalyzer';
  private readonly options: Required<EncodingAnalyzerOptions>;
  private readonly strategies: AnalyzerStrategy<EncodingAnalyzerContext>[];

  constructor(
    options: EncodingAnalyzerOptions = {},
    strategies?: AnalyzerStrategy<EncodingAnalyzerContext>[],
  ) {
    this.options = {
      encoding: options.encoding ?? HtmlEncoding.UTF8,
      mojibakeDetectionThreshold: options.mojibakeDetectionThreshold ?? 3,
    };
    this.strategies = strategies ?? [
      new DocumentEncodingStrategy(),
      new MetaCharsetStrategy(),
      new MojibakeStrategy(),
    ];
  }

  async run(rootElement: HTMLElement): Promise<Issue[]> {
    const context = this.buildContext(rootElement);
    const issues = await Promise.all(
      this.strategies.map((strategy) => Promise.resolve(strategy.analyze(context))),
    );
    return issues.flat();
  }

  private buildContext(rootElement: HTMLElement): EncodingAnalyzerContext {
    return {
      rootElement,
      elements: [],
      document: rootElement.ownerDocument,
      expectedEncoding: this.options.encoding,
      mojibakeDetectionThreshold: this.options.mojibakeDetectionThreshold,
    };
  }
}
