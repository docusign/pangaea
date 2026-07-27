// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import type { Issue, Severity } from './types/types.js';

// Scoring constants (tweak here to adjust algorithm behavior)
const SERIOUS_BASE_DEDUCTION = 5; // base points per serious issue (no diminishing returns)
const MODERATE_BASE_DEDUCTION = 3; // base points for moderate issues per type (with sqrt decay)
const MINOR_BASE_DEDUCTION = 2; // base points for minor issues (with sqrt decay, pooled across all types)
const SENSITIVITY_NEUTRAL = 5; // neutral sensitivity (multiplier = 1x)

/**
 * Calculate score for a single analyzer (0–100, where 100 is perfect).
 *
 * Severity levels: 'critical', 'serious', 'moderate', 'minor', 'info'
 *
 * Rules and algorithm:
 * - Hard stop for critical: If any issue with severity `critical` exists, the analyzer score is 0.
 *   This reflects the high blast radius of critical globalization defects (e.g., wrong charset causing mojibake).
 * - Severity-based deductions:
 *   - Serious: Linear deduction (no diminishing returns). Each serious issue deducts `SERIOUS_BASE_DEDUCTION`.
 *   - Moderate: Per-type diminishing returns. For each type: `MODERATE_BASE_DEDUCTION * sqrt(count)`.
 *   - Minor: Pooled diminishing returns across ALL types. Total: `MINOR_BASE_DEDUCTION * sqrt(totalMinorCount)`.
 *   - Info: No impact on score.
 * - Sensitivity: multiply the total deduction by `(errorSensitivity / 5)`.
 *   - 5 = neutral (1x), 10 = strict (2x), 1 = lenient (0.2x).
 *   Sensitivity is specified per analyzer via `analyzerErrorSensitivity` in `AuditRunner.runAudit`.
 * - Final score: `round(100 - adjustedDeduction)`, clamped to `[0, 100]`.
 *   An analyzer can score 0 if it detects widespread issues across many types.
 */
export function calculateAnalyzerScore(issues: Issue[], errorSensitivity: number = 5): number {
  if (issues.length === 0) {
    return 100;
  }

  // Critical-zero rule: any critical immediately yields score 0
  for (const issue of issues) {
    if (issue.severity === 'critical') {
      return 0;
    }
  }

  // Track counts by severity
  let totalSeriousCount = 0;
  let totalMinorCount = 0; // pooled across all types
  const moderateCountsByType = new Map<string, number>();

  for (const issue of issues) {
    const sev: Severity = issue.severity ?? 'info';
    if (sev === 'info') continue; // info has zero impact

    const type = issue.type;

    if (sev === 'serious') {
      totalSeriousCount++;
    } else if (sev === 'moderate') {
      moderateCountsByType.set(type, (moderateCountsByType.get(type) ?? 0) + 1);
    } else if (sev === 'minor') {
      totalMinorCount++; // pooled across all types
    }
  }

  // Compute deductions
  let totalDeduction = 0;

  // Serious: linear (no diminishing returns)
  totalDeduction += SERIOUS_BASE_DEDUCTION * totalSeriousCount;

  // Moderate: per-type diminishing returns (sqrt)
  for (const count of moderateCountsByType.values()) {
    totalDeduction += MODERATE_BASE_DEDUCTION * Math.sqrt(count);
  }

  // Minor: pooled diminishing returns across all types (sqrt)
  if (totalMinorCount > 0) {
    totalDeduction += MINOR_BASE_DEDUCTION * Math.sqrt(totalMinorCount);
  }

  const sensitivityMultiplier = errorSensitivity / SENSITIVITY_NEUTRAL;
  const adjustedDeduction = totalDeduction * sensitivityMultiplier;

  const score = Math.round(100 - adjustedDeduction);
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate overall globalization score from individual analyzer scores.
 * Uses weighted average if weights are provided, otherwise simple average.
 */
export function calculateOverallScore(
  analyzerScores: Record<string, number>,
  analyzerWeights?: Record<string, number>,
): number {
  const analyzerNames = Object.keys(analyzerScores);

  if (analyzerNames.length === 0) {
    return 100;
  }

  if (!analyzerWeights) {
    const scores = Object.values(analyzerScores);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average);
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const analyzerName of analyzerNames) {
    const score = analyzerScores[analyzerName];
    const weight = analyzerWeights[analyzerName] ?? 1;

    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 100;
  }

  const weightedAverage = weightedSum / totalWeight;
  return Math.round(weightedAverage);
}
