// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Computes the effective overflow threshold for a given dimension.
 * Returns the greater of the pixel floor or the percentage-based value.
 *
 * @param dimension - Element or parent dimension in pixels (width or height)
 * @param percentThreshold - Threshold as a percentage of the dimension
 * @param pixelThreshold - Absolute pixel floor
 * @returns Threshold value in pixels
 */
export function computeOverflowThreshold(
  dimension: number,
  percentThreshold: number,
  pixelThreshold: number,
): number {
  return Math.max(pixelThreshold, (percentThreshold / 100) * dimension);
}
