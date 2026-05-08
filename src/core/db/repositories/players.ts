import { getDatabase } from "../database";
import type { Player } from "../types";

export async function listPlayers(): Promise<Player[]> {
  const db = await getDatabase();
  return db.getAllAsync<Player>("SELECT * FROM players ORDER BY id ASC;");
}

export async function getPlayer(id: number): Promise<Player | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Player>("SELECT * FROM players WHERE id = ?;", id);
  return row ?? null;
}

export async function createPlayer(name: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync("INSERT INTO players (name) VALUES (?);", name);
  return result.lastInsertRowId;
}

export async function updatePlayerHandicapIndex(
  id: number,
  handicapIndex: number | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE players SET handicap_index = ? WHERE id = ?;", handicapIndex, id);
}

export async function countPlayers(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM players;");
  return row?.c ?? 0;
}
