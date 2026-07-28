// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { AuditRunner } from './auditRunner';

export { AuditRunner } from './auditRunner';
export type { AuditProgress } from './auditRunner';
export { RTLAnalyzer } from './analyzers/rtl/rtlAnalyzer';
export { MirroringStrategy } from './analyzers/rtl/mirroringStrategy';
export type {
  RTLAnalyzerOptions,
  RTLAnalyzerContext,
  MirroringIssueMetadata,
} from './analyzers/rtl/types';
export { EncodingAnalyzer, HtmlEncoding } from './analyzers/encoding/encodingAnalyzer';
export type { EncodingAnalyzerOptions } from './analyzers/encoding/encodingAnalyzer';
export { DocumentEncodingStrategy } from './analyzers/encoding/documentEncodingStrategy';
export { MetaCharsetStrategy } from './analyzers/encoding/metaCharsetStrategy';
export { MojibakeStrategy } from './analyzers/encoding/mojibakeStrategy';
export type { EncodingAnalyzerContext, EncodingIssueType } from './analyzers/encoding/types';
export { LayoutStabilityAnalyzer } from './analyzers/layoutStability/layoutStabilityAnalyzer';
export { SelfOverflowAnalyzerStrategy } from './analyzers/layoutStability/selfOverflowAnalyzerStrategy';
export { ParentOverflowAnalyzerStrategy } from './analyzers/layoutStability/parentOverflowAnalyzerStrategy';
export type {
  LayoutStabilityAnalyzerOptions,
  LayoutStabilityAnalyzerContext,
  SelfOverflowIssueMetadata,
  ParentOverflowIssueMetadata,
} from './analyzers/layoutStability/types';
export { IMEAnalyzer } from './analyzers/ime/imeAnalyzer';
export { EventHandlerStrategy } from './analyzers/ime/eventHandlerStrategy';
export { ReactPropsStrategy } from './analyzers/ime/reactPropsStrategy';
export type { IMEAnalyzerOptions, IMEIssueType, GetEventListenersFn } from './analyzers/ime/types';
export { LanguageAnalyzer } from './analyzers/language/languageAnalyzer';
export { TextLanguageMismatchStrategy } from './analyzers/language/textLanguageMismatchStrategy';
export { LinkLanguageMismatchStrategy } from './analyzers/language/linkLanguageMismatchStrategy';
export type {
  LanguageAnalyzerOptions,
  LanguageAnalyzerContext,
  LanguageIssueType,
} from './analyzers/language/types';
export { CollationAnalyzer } from './analyzers/collation/collationAnalyzer';
export { ListSortOrderStrategy } from './analyzers/collation/listSortOrderStrategy';
export { SelectSortOrderStrategy } from './analyzers/collation/selectSortOrderStrategy';
export { TableSortOrderStrategy } from './analyzers/collation/tableSortOrderStrategy';
export type {
  CollationAnalyzerOptions,
  CollationAnalyzerContext,
  CollationIssueType,
  SortDirection,
  SortOrderAnalysis,
} from './analyzers/collation/types';
export { calculateAnalyzerScore, calculateOverallScore } from './scoring';
export type { Analyzer, AuditReport, Issue, RawIssue, Severity } from './types/types';

// Re-export pseudolocalize for use in devtools extension
export { pseudolocalize, defaultConfigurationJSON } from './utils/pseudolocalize';

// Shared text expansion utility
export { pseudolocalizeText } from './utils/pseudolocalizeText';

// Shared layout utilities
export { captureSnapshots } from './utils/captureSnapshots';
export { waitForLayout } from './utils/waitForLayout';

export default { AuditRunner };
