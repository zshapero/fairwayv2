export interface ScoreDifferentialInput {
  /** Adjusted Gross Score for the round. */
  adjustedGrossScore: number;
  /** Course Rating of the tee played. */
  courseRating: number;
  /** Slope Rating of the tee played (55-155). */
  slopeRating: number;
  /** Playing Conditions Calculation adjustment, default 0. Range -1 to +3. */
  pcc?: number;
}

/**
 * Score Differential measures how a player's adjusted gross score compares to
 * the course difficulty, normalized to a slope of 113.
 *
 *   differential = (113 / slopeRating) * (AGS - courseRating - PCC)
 *
 * Differentials are rounded to one decimal place per WHS Rule 5.1c.
 *
 * Reference: WHS Rules of Handicapping, Rule 5.1
 * (https://www.usga.org/handicapping/roh/2024-rules-of-handicapping.html).
 *
 * @param input AGS, course rating, slope rating, and optional PCC.
 * @returns The score differential rounded to one decimal place.
 */
export function scoreDifferential(input: ScoreDifferentialInput): number {
  const { adjustedGrossScore, courseRating, slopeRating, pcc = 0 } = input;
  if (slopeRating <= 0) {
    throw new Error("slopeRating must be greater than 0");
  }
  const raw = (113 / slopeRating) * (adjustedGrossScore - courseRating - pcc);
  return Math.round(raw * 10) / 10;
}
