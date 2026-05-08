import { getDatabase } from "../database";
import type { HandicapSnapshot } from "../types";

export async function listSnapshotsForPlayer(playerId: number): Promise<HandicapSnapshot[]> {
  const db = await getDatabase();
  return db.getAllAsync<HandicapSnapshot>(
    "SELECT * FROM handicap_snapshots WHERE player_id = ? ORDER BY computed_at DESC;",
    playerId,
  );
}

export async function recordSnapshot(
  input: Omit<HandicapSnapshot, "id" | "computed_at">,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO handicap_snapshots (player_id, handicap_index, rounds_used) VALUES (?, ?, ?);",
    input.player_id,
    input.handicap_index,
    input.rounds_used,
  );
  return result.lastInsertRowId;
}

export async function countSnapshots(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM handicap_snapshots;",
  );
  return row?.c ?? 0;
}
