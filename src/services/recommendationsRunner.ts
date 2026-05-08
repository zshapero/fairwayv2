import { getDatabase } from "@/core/db/database";
import * as coursesRepo from "@/core/db/repositories/courses";
import * as holeScoresRepo from "@/core/db/repositories/holeScores";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as teesRepo from "@/core/db/repositories/tees";
import * as teeHolesRepo from "@/core/db/repositories/teeHoles";
import type { HoleScore, TeeHole } from "@/core/db/types";
import { evaluateRules } from "@/core/recommendations/engine";
import type {
  RoundHole,
  RoundWithHoleScores,
} from "@/core/recommendations/types";

async function buildPlayerRoundDataset(
  playerId: number,
): Promise<RoundWithHoleScores[]> {
  const [completed, courses, tees] = await Promise.all([
    roundsRepo.listCompletedRoundsForPlayer(playerId),
    coursesRepo.listCourses(),
    Promise.resolve(null as null),
  ]);
  // listCompletedRoundsForPlayer returns chronological (oldest first).
  void tees;

  const courseById = new Map(courses.map((c) => [c.id, c]));

  // Pull per-tee data in parallel; cache so we don't re-fetch the same tee.
  const teeHoleCache = new Map<number, TeeHole[]>();
  const teeCache = new Map<number, { course_rating: number; slope_rating: number }>();

  const teeIds = Array.from(new Set(completed.map((r) => r.tee_id)));
  await Promise.all(
    teeIds.map(async (teeId) => {
      const holes = await teeHolesRepo.listTeeHoles(teeId);
      teeHoleCache.set(teeId, holes);
    }),
  );

  const courseTeeIds = Array.from(new Set(completed.map((r) => r.course_id)));
  await Promise.all(
    courseTeeIds.map(async (courseId) => {
      const teesForCourse = await teesRepo.listTeesForCourse(courseId);
      for (const tee of teesForCourse) {
        teeCache.set(tee.id, {
          course_rating: tee.course_rating,
          slope_rating: tee.slope_rating,
        });
      }
    }),
  );

  // Hole scores per round; fire in parallel.
  const holeScoreLists = await Promise.all(
    completed.map((r) => holeScoresRepo.listHoleScoresForRound(r.id)),
  );

  const dataset: RoundWithHoleScores[] = completed.map((round, idx) => {
    const teeHoles = teeHoleCache.get(round.tee_id) ?? [];
    const teeMeta = teeCache.get(round.tee_id);
    const course = courseById.get(round.course_id);
    const teeHoleByNumber = new Map(teeHoles.map((h) => [h.hole_number, h]));
    const scores: HoleScore[] = holeScoreLists[idx] ?? [];
    const holes: RoundHole[] = scores
      .map((row) => {
        const teeHole = teeHoleByNumber.get(row.hole_number);
        if (!teeHole) return null;
        return {
          hole_number: row.hole_number,
          par: teeHole.par,
          stroke_index: teeHole.stroke_index,
          gross_score: row.gross_score,
          putts: row.putts,
          fairway_hit: row.fairway_hit,
          green_in_regulation: row.green_in_regulation,
          penalty_strokes: row.penalty_strokes,
          fairway_miss_direction: row.fairway_miss_direction,
          gir_miss_direction: row.gir_miss_direction,
          hit_from_sand: row.hit_from_sand,
          sand_save: row.sand_save,
        };
      })
      .filter((h): h is RoundHole => h !== null)
      .sort((a, b) => a.hole_number - b.hole_number);
    return {
      id: round.id,
      player_id: round.player_id,
      course_id: round.course_id,
      tee_id: round.tee_id,
      played_at: round.played_at,
      differential: round.differential,
      course_par: course?.par ?? 72,
      course_rating: teeMeta?.course_rating ?? 72,
      slope_rating: teeMeta?.slope_rating ?? 113,
      holes,
    };
  });

  return dataset;
}

function newRecommendationId(ruleId: string): string {
  // Stable enough for a single device: rule-prefix + ms + a small random suffix.
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `${ruleId}_${Date.now()}_${rand}`;
}

export interface RunEngineResult {
  triggered: number;
  dismissed: number;
}

/**
 * Run the recommendation engine for the player: load rounds, evaluate every
 * rule, and persist via the repository. For each rule that triggers, the
 * existing active recommendation (if any) is replaced so users always see the
 * latest math. Rules that no longer trigger have their active recommendation
 * dismissed.
 */
export async function runEngine(playerId: number): Promise<RunEngineResult> {
  await getDatabase();
  const dataset = await buildPlayerRoundDataset(playerId);
  const activeRuleIds = await recommendationsRepo.listActiveRuleIdsForPlayer(playerId);
  const decision = evaluateRules(dataset, activeRuleIds);

  for (const output of decision.toCreate) {
    await recommendationsRepo.replaceForRule({
      id: newRecommendationId(output.ruleId),
      player_id: playerId,
      rule_id: output.ruleId,
      title: output.title,
      summary: output.summary,
      detail: output.detail,
      drill: output.drill,
      triggering_round_ids: output.triggeringRoundIds,
      threshold_value: output.thresholdValue,
      threshold_label: output.thresholdLabel,
    });
  }
  for (const ruleId of decision.toDismiss) {
    await recommendationsRepo.dismissActiveByRule(playerId, ruleId);
  }

  return {
    triggered: decision.toCreate.length,
    dismissed: decision.toDismiss.length,
  };
}
