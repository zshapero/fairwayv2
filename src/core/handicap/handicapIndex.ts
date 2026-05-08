import { lookupWhsRow } from "./whsTable";

/**
 * Compute a player's Handicap Index from their recent score differentials.
 *
 * Uses the most recent 20 differentials (or fewer if not yet established) and
 * averages the lowest `differentialsUsed` per the WHS lookup table, then
 * applies the table adjustment.
 *
 * The result is rounded to one decimal place. Returns null if fewer than 3
 * acceptable scores are available (no Handicap Index established yet).
 *
 * Reference: WHS Rules of Handicapping, Rule 5.2.
 *
 * @param differentials  Score differentials in chronological order
 *                       (oldest first, newest last). Only the most recent 20
 *                       are considered.
 * @returns The Handicap Index rounded to 0.1, or null if not established.
 */
export function handicapIndex(differentials: readonly number[]): number | null {
  if (differentials.length < 3) return null;

  const recent = differentials.slice(-20);
  const row = lookupWhsRow(recent.length);
  if (!row) return null;

  const sorted = [...recent].sort((a, b) => a - b);
  const lowest = sorted.slice(0, row.differentialsUsed);
  const average = lowest.reduce((sum, d) => sum + d, 0) / lowest.length;
  const index = average + row.adjustment;
  return Math.round(index * 10) / 10;
}
