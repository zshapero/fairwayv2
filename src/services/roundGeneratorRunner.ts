import { handicapIndex } from "@/core/handicap";
import { getDatabase } from "@/core/db/database";
import * as coursesRepo from "@/core/db/repositories/courses";
import * as teesRepo from "@/core/db/repositories/tees";
import * as teeHolesRepo from "@/core/db/repositories/teeHoles";
import { getOrCreateCurrentPlayer } from "./currentPlayer";
import {
  DEFAULT_SCENARIO_COUNTS,
  generateRoundsForScenario,
  type AvailableTee,
  type RoundSeed,
  type ScenarioKind,
} from "./roundGenerator";
import { runEngine } from "./recommendationsRunner";

export interface RunScenarioOptions {
  scenario: ScenarioKind;
  count?: number;
  targetHandicap?: number;
}

export interface RunScenarioResult {
  scenario: ScenarioKind;
  roundsCreated: number;
  finalHandicapIndex: number | null;
  recommendationsTriggered: number;
}

async function loadAvailableTees(): Promise<AvailableTee[]> {
  const courses = await coursesRepo.listCourses();
  const result: AvailableTee[] = [];
  for (const course of courses) {
    const tees = await teesRepo.listTeesForCourse(course.id);
    for (const tee of tees) {
      const holes = await teeHolesRepo.listTeeHoles(tee.id);
      if (holes.length === 0) continue;
      result.push({
        id: tee.id,
        course_id: tee.course_id,
        course_par: course.par,
        course_rating: tee.course_rating,
        slope_rating: tee.slope_rating,
        holes: holes.map((h) => ({
          hole_number: h.hole_number,
          par: h.par,
          stroke_index: h.stroke_index,
        })),
      });
    }
  }
  return result;
}

async function writeSeeds(seeds: readonly RoundSeed[], playerId: number): Promise<void> {
  const db = await getDatabase();
  const sortedSeeds = [...seeds].sort((a, b) => a.played_at.localeCompare(b.played_at));
  await db.withTransactionAsync(async () => {
    for (const seed of sortedSeeds) {
      const round = await db.runAsync(
        `INSERT INTO rounds
           (player_id, course_id, tee_id, played_at, pcc, is_nine_hole, completed_at, differential)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?);`,
        playerId,
        seed.course_id,
        seed.tee_id,
        seed.played_at,
        seed.played_at, // completed at play time for test data
        seed.differential,
      );
      const roundId = round.lastInsertRowId;
      // Look up par per hole so sand_save derivation matches the live repo.
      const teeHoles = await db.getAllAsync<{ hole_number: number; par: number }>(
        "SELECT hole_number, par FROM tee_holes WHERE tee_id = ?;",
        seed.tee_id,
      );
      const parByHole = new Map(teeHoles.map((th) => [th.hole_number, th.par]));
      for (const h of seed.perHole) {
        const holePar = parByHole.get(h.hole_number) ?? 4;
        const sandSave =
          h.hit_from_sand === 1 ? (h.gross_score <= holePar ? 1 : 0) : null;
        await db.runAsync(
          `INSERT INTO hole_scores (
             round_id, hole_number, gross_score, putts, fairway_hit,
             green_in_regulation, penalty_strokes, fairway_miss_direction,
             gir_miss_direction, hit_from_sand, sand_save
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          roundId,
          h.hole_number,
          h.gross_score,
          h.putts,
          h.fairway_hit,
          h.green_in_regulation,
          h.penalty_strokes,
          h.fairway_miss_direction,
          h.gir_miss_direction,
          h.hit_from_sand,
          sandSave,
        );
      }
    }
  });
}

async function rebuildHandicapSnapshots(playerId: number): Promise<number | null> {
  const db = await getDatabase();
  const rounds = await db.getAllAsync<{
    id: number;
    played_at: string;
    differential: number | null;
    completed_at: string | null;
  }>(
    "SELECT id, played_at, differential, completed_at FROM rounds WHERE player_id = ? AND completed_at IS NOT NULL ORDER BY played_at ASC;",
    playerId,
  );
  await db.runAsync(
    "DELETE FROM handicap_snapshots WHERE player_id = ?;",
    playerId,
  );
  const diffs: number[] = [];
  let lastIndex: number | null = null;
  await db.withTransactionAsync(async () => {
    for (const round of rounds) {
      if (round.differential != null) diffs.push(round.differential);
      const idx = handicapIndex(diffs);
      lastIndex = idx;
      await db.runAsync(
        "INSERT INTO handicap_snapshots (player_id, handicap_index, computed_at, rounds_used) VALUES (?, ?, ?, ?);",
        playerId,
        idx,
        round.played_at,
        diffs.length,
      );
    }
    await db.runAsync(
      "UPDATE players SET handicap_index = ? WHERE id = ?;",
      lastIndex,
      playerId,
    );
  });
  return lastIndex;
}

/**
 * High-level orchestration: load tees, generate seeds, write to SQLite,
 * rebuild handicap snapshots, then refresh the recommendation engine.
 */
export async function runScenario(opts: RunScenarioOptions): Promise<RunScenarioResult> {
  const player = await getOrCreateCurrentPlayer();
  const tees = await loadAvailableTees();
  if (tees.length === 0) {
    throw new Error(
      "No imported courses with tee data found. Import a course or seed demo data first.",
    );
  }
  const count = opts.count ?? DEFAULT_SCENARIO_COUNTS[opts.scenario];
  const seeds = generateRoundsForScenario(opts.scenario, count, {
    tees,
    targetHandicap: opts.targetHandicap,
  });
  await writeSeeds(seeds, player.id);
  const finalHandicapIndex = await rebuildHandicapSnapshots(player.id);
  const engineResult = await runEngine(player.id);
  return {
    scenario: opts.scenario,
    roundsCreated: seeds.length,
    finalHandicapIndex,
    recommendationsTriggered: engineResult.triggered,
  };
}

export async function clearAllRoundData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM player_drill_log;
    DELETE FROM recommendations;
    DELETE FROM hole_scores;
    DELETE FROM rounds;
    DELETE FROM handicap_snapshots;
    UPDATE players SET handicap_index = NULL;
  `);
}
