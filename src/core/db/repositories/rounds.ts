import { getDatabase } from "../database";
import type { Round } from "../types";

export async function listRoundsForPlayer(playerId: number): Promise<Round[]> {
  const db = await getDatabase();
  return db.getAllAsync<Round>(
    "SELECT * FROM rounds WHERE player_id = ? ORDER BY played_at DESC;",
    playerId,
  );
}

export async function createRound(input: Omit<Round, "id">): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO rounds (player_id, course_id, tee_id, played_at, pcc, is_nine_hole) VALUES (?, ?, ?, ?, ?, ?);",
    input.player_id,
    input.course_id,
    input.tee_id,
    input.played_at,
    input.pcc,
    input.is_nine_hole,
  );
  return result.lastInsertRowId;
}

export async function deleteRound(id: number): Promise<void> {
  const db = await getDatabase();
  // ON DELETE CASCADE on hole_scores fires automatically because foreign keys are enabled.
  await db.runAsync("DELETE FROM rounds WHERE id = ?;", id);
}

export async function countRounds(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM rounds;");
  return row?.c ?? 0;
}
