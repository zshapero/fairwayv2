import { getDatabase } from "../database";
import type { HoleScore } from "../types";

export async function listHoleScoresForRound(roundId: number): Promise<HoleScore[]> {
  const db = await getDatabase();
  return db.getAllAsync<HoleScore>(
    "SELECT * FROM hole_scores WHERE round_id = ? ORDER BY hole_number ASC;",
    roundId,
  );
}

export async function upsertHoleScore(input: Omit<HoleScore, "id">): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO hole_scores (round_id, hole_number, gross_score, putts, fairway_hit, green_in_regulation, penalty_strokes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(round_id, hole_number) DO UPDATE SET
       gross_score = excluded.gross_score,
       putts = excluded.putts,
       fairway_hit = excluded.fairway_hit,
       green_in_regulation = excluded.green_in_regulation,
       penalty_strokes = excluded.penalty_strokes;`,
    input.round_id,
    input.hole_number,
    input.gross_score,
    input.putts,
    input.fairway_hit,
    input.green_in_regulation,
    input.penalty_strokes,
  );
  return result.lastInsertRowId;
}

export async function countHoleScores(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM hole_scores;");
  return row?.c ?? 0;
}
