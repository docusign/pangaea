// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Analyzer, AuditReport, Issue } from './types/types.js';
import { calculateAnalyzerScore, calculateOverallScore } from './scoring.js';

export interface AuditProgress {
  currentAnalyzer: string;
  completedAnalyzers: number;
  totalAnalyzers: number;
}

/**
 * Orchestrates the execution of all registered analyzers and generates a complete audit report.
 */
export class AuditRunner {
  /**
   * Run all registered analyzers and generate a comprehensive audit report
   * @param rootElement - The root DOM element to audit
   * @param url - The URL of the audited page
   * @param analyzers - Array of analyzers to run
   * @param analyzerWeights - Optional weights for each analyzer (defaults to equal weights)
   * @param errorSensitivity - Optional error sensitivity for score calculation (defaults to 5, range 1-10). Higher = stricter, Lower = more lenient.
   * @param onProgress - Optional callback to report progress during audit execution
   */
  static async runAudit(
    rootElement: HTMLElement,
    url: string,
    analyzers: Analyzer[],
    analyzerWeights?: Record<string, number>,
    analyzerErrorSensitivity?: Record<string, number>,
    onProgress?: (progress: AuditProgress) => void,
  ): Promise<AuditReport> {
    const analyzerScores: Record<string, number> = {};
    const allIssues: Issue[] = [];

    for (let i = 0; i < analyzers.length; i++) {
      const analyzer = analyzers[i];

      if (onProgress) {
        onProgress({
          currentAnalyzer: analyzer.name,
          completedAnalyzers: i,
          totalAnalyzers: analyzers.length,
        });
      }

      const issues = await analyzer.run(rootElement);
      allIssues.push(...issues);

      // Determine sensitivity: analyzer-specific overrides global sensitivity
      const perAnalyzerSensitivity = analyzerErrorSensitivity?.[analyzer.name] ?? 5;

      // Calculate score for this analyzer
      analyzerScores[analyzer.name] = calculateAnalyzerScore(issues, perAnalyzerSensitivity);
    }

    // Calculate overall globalization score
    const globalizationScore = calculateOverallScore(analyzerScores, analyzerWeights);

    return {
      analyzerScores,
      globalizationScore,
      timestamp: new Date().toISOString(),
      url,
      issues: allIssues,
    };
  }
}
