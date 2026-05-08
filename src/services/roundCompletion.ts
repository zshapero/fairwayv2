import { getDatabase } from "@/core/db/database";
import * as holeScoresRepo from "@/core/db/repositories/holeScores";
import * as playersRepo from "@/core/db/repositories/players";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as snapshotsRepo from "@/core/db/repositories/handicapSnapshots";

import {
  computeRoundSummary,
  type PerHoleEntry,
  type SummaryInput,
  type SummaryResult,
} from "./roundSummary";

export {
  computeRoundSummary,
  type PerHoleEntry,
  type SummaryInput,
  type SummaryResult,
} from "./roundSummary";

/**
 * Persist the in-progress round: save any unsaved hole scores, mark the round
 * complete with its differential, append a handicap snapshot, and update the
 * player's index. Returns the recomputed summary so the caller can display it.
 */
export async function saveCompletedRound(input: SummaryInput): Promise<SummaryResult> {
  const summary = computeRoundSummary(input);

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const entry of input.perHole as readonly PerHoleEntry[]) {
      await holeScoresRepo.upsertHoleScore({
        round_id: input.roundId,
        hole_number: entry.hole_number,
        gross_score: entry.gross_score,
        putts: entry.putts,
        fairway_hit: entry.fairway_hit,
        green_in_regulation: entry.green_in_regulation,
        penalty_strokes: entry.penalty_strokes,
      });
    }
    await roundsRepo.completeRound(input.roundId, summary.scoreDifferential);
    const allDifferentials = [...input.priorDifferentials, summary.scoreDifferential];
    await snapshotsRepo.recordSnapshot({
      player_id: input.playerId,
      handicap_index: summary.projectedHandicapIndex,
      rounds_used: allDifferentials.length,
    });
    await playersRepo.updatePlayerHandicapIndex(input.playerId, summary.projectedHandicapIndex);
  });

  return summary;
}
