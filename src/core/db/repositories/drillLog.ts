import { getDatabase } from "../database";
import type { DrillLogEntry } from "../types";

export interface NewDrillLog {
  id: string;
  player_id: number;
  recommendation_id: string;
  practiced_at: number;
}

export async function logPractice(input: NewDrillLog): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO player_drill_log (id, player_id, recommendation_id, practiced_at) VALUES (?, ?, ?, ?);",
    input.id,
    input.player_id,
    input.recommendation_id,
    input.practiced_at,
  );
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getRecentPractice(recommendationId: string): Promise<DrillLogEntry[]> {
  const db = await getDatabase();
  const since = Date.now() - THIRTY_DAYS_MS;
  return db.getAllAsync<DrillLogEntry>(
    "SELECT * FROM player_drill_log WHERE recommendation_id = ? AND practiced_at >= ? ORDER BY practiced_at DESC;",
    recommendationId,
    since,
  );
}

export async function countAllDrillLogs(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM player_drill_log;",
  );
  return row?.c ?? 0;
}
