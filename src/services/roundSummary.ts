import {
  adjustedGrossScore,
  courseHandicap,
  handicapIndex,
  scoreDifferential,
  strokesReceivedOnHole,
} from "@/core/handicap";
import type { TeeHole } from "@/core/db/types";

export interface PerHoleEntry {
  hole_number: number;
  gross_score: number;
  putts: number | null;
  fairway_hit: number | null;
  green_in_regulation: number | null;
  penalty_strokes: number | null;
}

export interface SummaryInput {
  playerId: number;
  roundId: number;
  teeHoles: readonly TeeHole[];
  courseRating: number;
  slopeRating: number;
  par: number;
  pcc?: number;
  /** Player's Handicap Index at the time of the round (null if not yet established). */
  handicapIndexBefore: number | null;
  perHole: readonly PerHoleEntry[];
  /** Differentials of all completed prior rounds (chronological, oldest first). */
  priorDifferentials: readonly number[];
}

export interface SummaryResult {
  grossScore: number;
  adjustedGrossScore: number;
  scoreDifferential: number;
  handicapIndexBefore: number | null;
  projectedHandicapIndex: number | null;
  courseHandicap: number;
  strokesReceivedPerHole: number[];
}

/**
 * Compute the displayable round summary without writing anything. Pure logic
 * so the summary screen and the save path agree on the numbers, and so the
 * math is unit-testable without touching the SQLite layer.
 */
export function computeRoundSummary(input: SummaryInput): SummaryResult {
  const sortedHoles = [...input.teeHoles].sort((a, b) => a.hole_number - b.hole_number);
  const pars = sortedHoles.map((h) => h.par);
  const strokeIndexes = sortedHoles.map((h) => h.stroke_index);

  const ch =
    input.handicapIndexBefore != null
      ? courseHandicap({
          handicapIndex: input.handicapIndexBefore,
          slopeRating: input.slopeRating,
          courseRating: input.courseRating,
          par: input.par,
        })
      : 0;

  const strokesReceivedPerHole = strokeIndexes.map((hsi) => strokesReceivedOnHole(ch, hsi));

  const scoresByHole = new Map(input.perHole.map((p) => [p.hole_number, p]));
  const grossScores = sortedHoles.map((hole) => {
    const entry = scoresByHole.get(hole.hole_number);
    return entry ? entry.gross_score : hole.par;
  });

  const grossScore = grossScores.reduce((sum, g) => sum + g, 0);
  const ags = adjustedGrossScore({ grossScores, pars, strokesReceivedPerHole });
  const differential = scoreDifferential({
    adjustedGrossScore: ags,
    courseRating: input.courseRating,
    slopeRating: input.slopeRating,
    pcc: input.pcc ?? 0,
  });

  const projected = handicapIndex([...input.priorDifferentials, differential]);

  return {
    grossScore,
    adjustedGrossScore: ags,
    scoreDifferential: differential,
    handicapIndexBefore: input.handicapIndexBefore,
    projectedHandicapIndex: projected,
    courseHandicap: ch,
    strokesReceivedPerHole,
  };
}
