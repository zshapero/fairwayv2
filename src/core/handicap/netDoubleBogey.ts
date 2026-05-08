/**
 * Net Double Bogey is the maximum hole score allowed for handicap purposes.
 *
 * Formula: par + 2 + strokesReceived (handicap strokes the player gets on the hole).
 *
 * Reference: WHS Rules of Handicapping, Rule 3.1 (Maximum Hole Score).
 *
 * @param par           The par for the hole (typically 3, 4, or 5).
 * @param strokesReceived The number of handicap strokes the player receives on this hole.
 *                      May be negative for plus handicaps (strokes given back).
 * @returns The net double bogey score cap for the hole.
 */
export function netDoubleBogey(par: number, strokesReceived: number): number {
  return par + 2 + strokesReceived;
}
