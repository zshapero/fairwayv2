import * as roundsRepo from "@/core/db/repositories/rounds";
import type { Round } from "@/core/db/types";

export interface RoundMovementInputs {
  round: Round;
  priorDifferentials: number[];
  newDifferential: number;
}

/**
 * Load the inputs needed to compute the handicap movement caused by a single
 * completed round: the round itself, plus the differentials of every round
 * the same player completed before it (used as the "before" snapshot for
 * `calculateMovement`).
 */
export async function loadRoundMovementInputs(
  roundId: number,
): Promise<RoundMovementInputs | null> {
  const round = await roundsRepo.getRound(roundId);
  if (!round || round.differential == null || round.completed_at == null) return null;

  const completed = await roundsRepo.listCompletedRoundsForPlayer(round.player_id);
  const priorDifferentials = completed
    .filter((r) => r.id !== round.id && r.played_at < round.played_at)
    .map((r) => r.differential)
    .filter((d): d is number => typeof d === "number");

  return {
    round,
    priorDifferentials,
    newDifferential: round.differential,
  };
}

export interface RoundIndexBadge {
  roundId: number;
  delta: number | null;
}

/**
 * Compute the per-round index delta for every completed round of the player,
 * in chronological order. `delta` is null when an index couldn't be computed
 * on either side of the round.
 */
export async function loadRoundDeltasForPlayer(playerId: number): Promise<RoundIndexBadge[]> {
  const completed = await roundsRepo.listCompletedRoundsForPlayer(playerId);
  const sorted = [...completed].sort((a, b) => a.played_at.localeCompare(b.played_at));
  const result: RoundIndexBadge[] = [];

  // Walk forward, recomputing the index from the chronological list as we go.
  // This stays in sync with the WHS lookup table semantics implemented in
  // `handicapIndex` / `calculateMovement`.
  const { handicapIndex } = await import("@/core/handicap");
  const diffs: number[] = [];
  let prevIndex: number | null = null;
  for (const round of sorted) {
    if (round.differential == null) {
      result.push({ roundId: round.id, delta: null });
      continue;
    }
    diffs.push(round.differential);
    const next = handicapIndex(diffs);
    const delta = prevIndex != null && next != null ? next - prevIndex : null;
    result.push({ roundId: round.id, delta });
    prevIndex = next;
  }
  return result;
}
