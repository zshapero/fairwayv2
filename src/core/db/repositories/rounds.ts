import { getDatabase } from "../database";
import type { Round } from "../types";

export async function listRoundsForPlayer(playerId: number): Promise<Round[]> {
  const db = await getDatabase();
  return db.getAllAsync<Round>(
    "SELECT * FROM rounds WHERE player_id = ? ORDER BY played_at DESC;",
    playerId,
  );
}

export async function listCompletedRoundsForPlayer(playerId: number): Promise<Round[]> {
  const db = await getDatabase();
  return db.getAllAsync<Round>(
    "SELECT * FROM rounds WHERE player_id = ? AND completed_at IS NOT NULL ORDER BY played_at ASC;",
    playerId,
  );
}

export async function getRound(id: number): Promise<Round | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Round>("SELECT * FROM rounds WHERE id = ?;", id);
  return row ?? null;
}

export async function createRound(input: Omit<Round, "id">): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO rounds (player_id, course_id, tee_id, played_at, pcc, is_nine_hole, completed_at, differential) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
    input.player_id,
    input.course_id,
    input.tee_id,
    input.played_at,
    input.pcc,
    input.is_nine_hole,
    input.completed_at,
    input.differential,
  );
  return result.lastInsertRowId;
}

export async function createDraftRound(
  playerId: number,
  courseId: number,
  teeId: number,
): Promise<number> {
  return createRound({
    player_id: playerId,
    course_id: courseId,
    tee_id: teeId,
    played_at: new Date().toISOString(),
    pcc: 0,
    is_nine_hole: 0,
    completed_at: null,
    differential: null,
  });
}

export async function completeRound(id: number, differential: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE rounds SET completed_at = ?, differential = ? WHERE id = ?;",
    new Date().toISOString(),
    differential,
    id,
  );
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
