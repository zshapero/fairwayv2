import type { ConfidenceLevel } from "@/core/db/types";

export type { ConfidenceLevel };

/**
 * Translate a rule trigger into a confidence label that the UI can display.
 *
 * - "high" when the sample is large (≥12) AND the metric is well past the
 *   expected day-to-day noise (>1.5×).
 * - "emerging" when the sample is too small (<8) OR the metric is barely
 *   beyond noise (<0.5×) — the pattern is real-but-tentative.
 * - "moderate" everywhere else.
 *
 * @param sampleSize             Rounds (or holes, depending on the rule) used
 *                               to evaluate the trigger.
 * @param distanceFromThreshold  How far past the threshold the player landed,
 *                               in the metric's natural units.
 * @param expectedNoise          The rule's estimate of typical round-to-round
 *                               variation in the same units.
 */
export function computeConfidence(
  sampleSize: number,
  distanceFromThreshold: number,
  expectedNoise: number,
): ConfidenceLevel {
  const noise = Math.max(expectedNoise, Number.EPSILON);
  if (sampleSize >= 12 && distanceFromThreshold > 1.5 * noise) return "high";
  if (sampleSize < 8 || distanceFromThreshold < 0.5 * noise) return "emerging";
  return "moderate";
}
