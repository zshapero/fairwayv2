import { getDatabase } from "@/core/db/database";
import * as coursesRepo from "@/core/db/repositories/courses";
import * as holeScoresRepo from "@/core/db/repositories/holeScores";
import * as playersRepo from "@/core/db/repositories/players";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as snapshotsRepo from "@/core/db/repositories/handicapSnapshots";
import * as teesRepo from "@/core/db/repositories/tees";
import * as teeHolesRepo from "@/core/db/repositories/teeHoles";
import type { HoleScore, TeeHole } from "@/core/db/types";
import { evaluateRules } from "@/core/recommendations/engine";
import { getBenchmarksFor, levelFor } from "@/core/recommendations/benchmarks";
import type {
  HandicapSnapshotPoint,
  RoundHole,
  RoundWithHoleScores,
} from "@/core/recommendations/types";

async function buildPlayerRoundDataset(
  playerId: number,
): Promise<RoundWithHoleScores[]> {
  const [completed, courses] = await Promise.all([
    roundsRepo.listCompletedRoundsForPlayer(playerId),
    coursesRepo.listCourses(),
  ]);
  const courseById = new Map(courses.map((c) => [c.id, c]));

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

  const holeScoreLists = await Promise.all(
    completed.map((r) => holeScoresRepo.listHoleScoresForRound(r.id)),
  );

  return completed.map((round, idx): RoundWithHoleScores => {
    const teeHoles = teeHoleCache.get(round.tee_id) ?? [];
    const teeMeta = teeCache.get(round.tee_id);
    const course = courseById.get(round.course_id);
    const teeHoleByNumber = new Map(teeHoles.map((h) => [h.hole_number, h]));
    const scores: HoleScore[] = holeScoreLists[idx] ?? [];
    const holes: RoundHole[] = scores
      .map((row): RoundHole | null => {
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
}

async function loadHandicapSnapshots(playerId: number): Promise<HandicapSnapshotPoint[]> {
  const snapshots = await snapshotsRepo.listSnapshotsForPlayer(playerId);
  return [...snapshots]
    .sort((a, b) => a.computed_at.localeCompare(b.computed_at))
    .map((s) => ({
      computed_at: s.computed_at,
      handicap_index: s.handicap_index,
    }));
}

function newRecommendationId(ruleId: string): string {
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
 * Run the recommendation engine for the player. Loads rounds, handicap
 * snapshots, and the player's current handicap index, builds the rule
 * context (with the bracket benchmarks attached), runs every rule, and
 * persists the result via `replaceForRule` semantics.
 */
export async function runEngine(playerId: number): Promise<RunEngineResult> {
  await getDatabase();
  const [dataset, snapshots, player, activeRuleIds] = await Promise.all([
    buildPlayerRoundDataset(playerId),
    loadHandicapSnapshots(playerId),
    playersRepo.getPlayer(playerId),
    recommendationsRepo.listActiveRuleIdsForPlayer(playerId),
  ]);

  const handicapIndex = player?.handicap_index ?? null;
  const benchmarks = getBenchmarksFor(handicapIndex);
  const level = levelFor(handicapIndex);

  const decision = evaluateRules(
    {
      rounds: dataset,
      benchmarks,
      handicapIndex,
      level,
      handicapSnapshots: snapshots,
    },
    activeRuleIds,
  );

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
      priority_score: output.priority,
      confidence: output.confidence,
      benchmark_value: output.benchmarkValue,
      benchmark_label: output.benchmarkLabel,
      player_value: output.playerValue,
      player_value_label: output.playerValueLabel,
      recommendation_type: output.type,
      selected_drill_variant_id: output.selectedDrillVariantId,
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
