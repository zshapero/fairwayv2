/**
 * Compute how many handicap strokes a player receives (or gives back) on a single hole.
 *
 * For a positive course handicap CH and a hole with stroke index HSI on an 18-hole course:
 *   strokes = floor(CH / 18) + (HSI <= (CH mod 18) ? 1 : 0)
 *
 * For a plus (negative) course handicap, the player gives strokes back starting from
 * the highest-numbered (easiest) stroke index. For CH = -k where 0 < k <= 18:
 *   strokes = HSI > 18 - k ? -1 : 0
 * For CH = -k where k > 18 the same logic stacks across full rounds.
 *
 * Reference: WHS Rules of Handicapping, Rule 6.2a / Appendix E (Stroke Allocation).
 *
 * @param courseHandicap   The player's course handicap (integer; may be negative for plus handicaps).
 * @param holeStrokeIndex  The hole's stroke index, 1 = hardest to 18 = easiest.
 * @param totalHoles       Number of holes on the course (default 18).
 * @returns The signed number of handicap strokes received on the hole.
 */
export function strokesReceivedOnHole(
  courseHandicap: number,
  holeStrokeIndex: number,
  totalHoles: number = 18,
): number {
  if (holeStrokeIndex < 1 || holeStrokeIndex > totalHoles) {
    throw new Error(
      `holeStrokeIndex must be between 1 and ${totalHoles}, received ${holeStrokeIndex}`,
    );
  }

  if (courseHandicap === 0) return 0;

  if (courseHandicap > 0) {
    const base = Math.floor(courseHandicap / totalHoles);
    const remainder = courseHandicap - base * totalHoles;
    return base + (holeStrokeIndex <= remainder ? 1 : 0);
  }

  // Plus handicap: strokes are given back starting at the easiest hole.
  const magnitude = -courseHandicap;
  const base = Math.floor(magnitude / totalHoles);
  const remainder = magnitude - base * totalHoles;
  // The easiest holes are HSI = totalHoles, totalHoles - 1, ...; these get the extra stroke back.
  const givesBackExtra = holeStrokeIndex > totalHoles - remainder ? 1 : 0;
  const total = base + givesBackExtra;
  return total === 0 ? 0 : -total;
}
