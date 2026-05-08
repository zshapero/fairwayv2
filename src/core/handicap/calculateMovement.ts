import { exceptionalScoreReduction } from "./exceptionalScoreReduction";
import { handicapIndex } from "./handicapIndex";
import { lookupWhsRow } from "./whsTable";

export interface MovementResult {
  /** Handicap Index before this round (rounded to 0.1), or null if not yet established. */
  oldIndex: number | null;
  /** Handicap Index after this round, or null if still not enough rounds. */
  newIndex: number | null;
  /**
   * 1-based rank of this round's differential among the most recent 20
   * (after appending). 1 = best. In the case of ties, returns the best
   * possible rank for the new differential.
   */
  newDifferentialRank: number;
  /** True when the new differential lands in the lowest N used by the WHS table. */
  isCounting: boolean;
  /**
   * If a previously-counting differential fell out of the calculation as a
   * result of this round (either displaced from "lowest N" or aged out of
   * the 20-round window), that value. Null otherwise.
   */
  droppedDifferential: number | null;
  /** How many of the most recent ≤20 differentials were averaged before. */
  oldRoundsUsed: number;
  /** How many were averaged after. */
  newRoundsUsed: number;
  /** Magnitude of the Exceptional Score Reduction applied (0, 1, or 2). */
  triggeredEsr: 0 | 1 | 2;
}

const MAX_WINDOW = 20;

function lowestN(values: readonly number[], n: number): number[] {
  return [...values].sort((a, b) => a - b).slice(0, n);
}

function differentialsUsedFor(rounds: number): number {
  const row = lookupWhsRow(rounds);
  return row?.differentialsUsed ?? 0;
}

/**
 * Calculate how a single new round moves a player's Handicap Index, exposing
 * every input the WHS lookup considers so the UI can explain *why* the index
 * moved (or didn't): which differential dropped out of the calculation, where
 * the new round ranks among the last 20, and whether an Exceptional Score
 * Reduction was triggered.
 *
 * Reference: WHS Rules of Handicapping, Rules 5.2 (index calculation) and 5.9
 * (Exceptional Score Reduction).
 *
 * @param beforeDifferentials  Differentials of prior rounds in chronological
 *                             order (oldest first). Only the most recent 20
 *                             are considered.
 * @param newDifferential      The differential of the round being posted.
 * @returns The movement breakdown.
 */
export function calculateMovement(
  beforeDifferentials: readonly number[],
  newDifferential: number,
): MovementResult {
  const recentBefore = beforeDifferentials.slice(-MAX_WINDOW);
  const combined = [...beforeDifferentials, newDifferential];
  const recentAfter = combined.slice(-MAX_WINDOW);

  const oldRoundsUsed = differentialsUsedFor(recentBefore.length);
  const newRoundsUsed = differentialsUsedFor(recentAfter.length);

  const oldIndex = handicapIndex(recentBefore);
  const newIndex = handicapIndex(recentAfter);

  // Rank of new diff: count strictly-lower values, +1. Best possible position
  // when ties exist; gives a friendly "5th best of last 20" message.
  const strictlyLower = recentAfter.filter((d) => d < newDifferential).length;
  const newDifferentialRank = strictlyLower + 1;
  const isCounting = newRoundsUsed > 0 && newDifferentialRank <= newRoundsUsed;

  const oldUsedValues = lowestN(recentBefore, oldRoundsUsed);
  const newUsedValues = lowestN(recentAfter, newRoundsUsed);

  // Multiset diff: the first oldUsed value with no remaining copy in newUsed.
  let droppedDifferential: number | null = null;
  const newCounts = new Map<number, number>();
  for (const v of newUsedValues) {
    newCounts.set(v, (newCounts.get(v) ?? 0) + 1);
  }
  for (const v of oldUsedValues) {
    const remaining = newCounts.get(v) ?? 0;
    if (remaining > 0) {
      newCounts.set(v, remaining - 1);
    } else {
      droppedDifferential = v;
      break;
    }
  }

  // ESR only applies when the player already has an established Handicap Index.
  let triggeredEsr: 0 | 1 | 2 = 0;
  if (oldIndex !== null) {
    const reduction = exceptionalScoreReduction(newDifferential, oldIndex);
    triggeredEsr = (-reduction) as 0 | 1 | 2;
  }

  return {
    oldIndex,
    newIndex,
    newDifferentialRank,
    isCounting,
    droppedDifferential,
    oldRoundsUsed,
    newRoundsUsed,
    triggeredEsr,
  };
}
