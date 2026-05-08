/**
 * WHS lookup table for computing a Handicap Index from the player's recent
 * score differentials.
 *
 * For a player with N acceptable scores in their record (3 <= N <= 20), the
 * Handicap Index is computed by averaging the lowest `differentialsUsed` of
 * the lowest `differentialsConsidered` recent rounds (typically the most
 * recent 20), then applying `adjustment`.
 *
 * Reference: WHS Rules of Handicapping, Rule 5.2a, Table 5.2a-1
 * (https://www.usga.org/handicapping/roh/2024-rules-of-handicapping.html).
 */
export interface WhsLookupRow {
  /** Number of recent differentials this row applies to. */
  rounds: number;
  /** How many of the lowest differentials are averaged. */
  differentialsUsed: number;
  /** Adjustment added to the average (negative reduces the index). */
  adjustment: number;
}

export const WHS_LOOKUP: readonly WhsLookupRow[] = [
  { rounds: 3, differentialsUsed: 1, adjustment: -2.0 },
  { rounds: 4, differentialsUsed: 1, adjustment: -1.0 },
  { rounds: 5, differentialsUsed: 1, adjustment: 0 },
  { rounds: 6, differentialsUsed: 2, adjustment: -1.0 },
  { rounds: 7, differentialsUsed: 2, adjustment: 0 },
  { rounds: 8, differentialsUsed: 2, adjustment: 0 },
  { rounds: 9, differentialsUsed: 3, adjustment: 0 },
  { rounds: 10, differentialsUsed: 3, adjustment: 0 },
  { rounds: 11, differentialsUsed: 3, adjustment: 0 },
  { rounds: 12, differentialsUsed: 4, adjustment: 0 },
  { rounds: 13, differentialsUsed: 4, adjustment: 0 },
  { rounds: 14, differentialsUsed: 4, adjustment: 0 },
  { rounds: 15, differentialsUsed: 5, adjustment: 0 },
  { rounds: 16, differentialsUsed: 5, adjustment: 0 },
  { rounds: 17, differentialsUsed: 6, adjustment: 0 },
  { rounds: 18, differentialsUsed: 6, adjustment: 0 },
  { rounds: 19, differentialsUsed: 7, adjustment: 0 },
  { rounds: 20, differentialsUsed: 8, adjustment: 0 },
];

export function lookupWhsRow(rounds: number): WhsLookupRow | undefined {
  const clamped = Math.min(20, Math.max(0, Math.floor(rounds)));
  return WHS_LOOKUP.find((row) => row.rounds === clamped);
}
