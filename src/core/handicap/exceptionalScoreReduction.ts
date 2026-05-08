/**
 * Compute the Exceptional Score Reduction (ESR) for a single round.
 *
 * If a player's score differential is at least 7.0 strokes below their
 * Handicap Index at the time of the round, an additional reduction is applied
 * to all 20 differentials in their record:
 *   - 7.0 to 9.9 strokes below: -1.0
 *   - 10.0 or more strokes below: -2.0
 *   - Otherwise: 0
 *
 * Reference: WHS Rules of Handicapping, Rule 5.9
 * (https://www.usga.org/handicapping/roh/2024-rules-of-handicapping.html).
 *
 * @param differential          The score differential of the round.
 * @param handicapIndexAtTime   The player's Handicap Index when the round was played.
 * @returns The (signed, non-positive) reduction to apply to the player's record.
 */
export function exceptionalScoreReduction(
  differential: number,
  handicapIndexAtTime: number,
): number {
  const delta = handicapIndexAtTime - differential;
  if (delta >= 10) return -2;
  if (delta >= 7) return -1;
  return 0;
}
