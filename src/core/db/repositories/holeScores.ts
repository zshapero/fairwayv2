import { getDatabase } from "../database";
import type { HoleScore } from "../types";

export async function listHoleScoresForRound(roundId: number): Promise<HoleScore[]> {
  const db = await getDatabase();
  return db.getAllAsync<HoleScore>(
    "SELECT * FROM hole_scores WHERE round_id = ? ORDER BY hole_number ASC;",
    roundId,
  );
}

export interface UpsertHoleScoreInput {
  round_id: number;
  hole_number: number;
  gross_score: number;
  par: number;
  putts: number | null;
  fairway_hit: number | null;
  green_in_regulation: number | null;
  penalty_strokes: number | null;
  fairway_miss_direction: HoleScore["fairway_miss_direction"];
  gir_miss_direction: HoleScore["gir_miss_direction"];
  hit_from_sand: number;
}

/**
 * Insert or update a hole score row. `sand_save` is derived automatically:
 * 1 when the player hit from sand and made par or better, 0 when they hit
 * from sand but failed to save par, null when they didn't hit from sand at
 * all (so reports can distinguish "no opportunity" from "missed save").
 */
export async function upsertHoleScore(input: UpsertHoleScoreInput): Promise<number> {
  const db = await getDatabase();
  const sandSave =
    input.hit_from_sand === 1 ? (input.gross_score <= input.par ? 1 : 0) : null;
  const result = await db.runAsync(
    `INSERT INTO hole_scores (
       round_id, hole_number, gross_score, putts, fairway_hit,
       green_in_regulation, penalty_strokes, fairway_miss_direction,
       gir_miss_direction, hit_from_sand, sand_save
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(round_id, hole_number) DO UPDATE SET
       gross_score = excluded.gross_score,
       putts = excluded.putts,
       fairway_hit = excluded.fairway_hit,
       green_in_regulation = excluded.green_in_regulation,
       penalty_strokes = excluded.penalty_strokes,
       fairway_miss_direction = excluded.fairway_miss_direction,
       gir_miss_direction = excluded.gir_miss_direction,
       hit_from_sand = excluded.hit_from_sand,
       sand_save = excluded.sand_save;`,
    input.round_id,
    input.hole_number,
    input.gross_score,
    input.putts,
    input.fairway_hit,
    input.green_in_regulation,
    input.penalty_strokes,
    input.fairway_miss_direction,
    input.gir_miss_direction,
    input.hit_from_sand,
    sandSave,
  );
  return result.lastInsertRowId;
}

export async function countHoleScores(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM hole_scores;");
  return row?.c ?? 0;
}
