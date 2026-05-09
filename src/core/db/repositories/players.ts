import { getDatabase } from "../database";
import type { Player, TeePreference } from "../types";

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

export interface OnboardingPlayerInput {
  name: string;
  estimatedHandicap: number;
  preferredTee: TeePreference;
}

export async function createOnboardedPlayer(input: OnboardingPlayerInput): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO players (name, handicap_index, preferred_tee) VALUES (?, ?, ?);",
    input.name,
    input.estimatedHandicap,
    input.preferredTee,
  );
  return result.lastInsertRowId;
}

export async function updatePlayerProfile(
  id: number,
  input: { name?: string; preferredTee?: TeePreference },
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.preferredTee !== undefined) {
    fields.push("preferred_tee = ?");
    values.push(input.preferredTee);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE players SET ${fields.join(", ")} WHERE id = ?;`, ...values);
}

export async function countPlayers(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM players;");
  return row?.c ?? 0;
}
