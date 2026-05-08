import { getDatabase } from "../database";
import type { Recommendation } from "../types";

interface RecommendationRow {
  id: string;
  player_id: number;
  rule_id: string;
  title: string;
  summary: string;
  detail: string;
  drill: string;
  triggering_round_ids: string;
  threshold_value: number | null;
  threshold_label: string | null;
  created_at: number;
  dismissed_at: number | null;
}

function rowToRecommendation(row: RecommendationRow): Recommendation {
  let triggering: number[] = [];
  try {
    const parsed = JSON.parse(row.triggering_round_ids);
    if (Array.isArray(parsed)) {
      triggering = parsed.filter((n): n is number => typeof n === "number");
    }
  } catch {
    triggering = [];
  }
  return {
    id: row.id,
    player_id: row.player_id,
    rule_id: row.rule_id,
    title: row.title,
    summary: row.summary,
    detail: row.detail,
    drill: row.drill,
    triggering_round_ids: triggering,
    threshold_value: row.threshold_value,
    threshold_label: row.threshold_label,
    created_at: row.created_at,
    dismissed_at: row.dismissed_at,
  };
}

export interface NewRecommendation {
  id: string;
  player_id: number;
  rule_id: string;
  title: string;
  summary: string;
  detail: string;
  drill: string;
  triggering_round_ids: readonly number[];
  threshold_value: number | null;
  threshold_label: string | null;
}

export async function createRecommendation(input: NewRecommendation): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO recommendations (
       id, player_id, rule_id, title, summary, detail, drill,
       triggering_round_ids, threshold_value, threshold_label, created_at, dismissed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
    input.id,
    input.player_id,
    input.rule_id,
    input.title,
    input.summary,
    input.detail,
    input.drill,
    JSON.stringify(input.triggering_round_ids),
    input.threshold_value,
    input.threshold_label,
    Date.now(),
  );
}

export async function listActiveForPlayer(playerId: number): Promise<Recommendation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RecommendationRow>(
    "SELECT * FROM recommendations WHERE player_id = ? AND dismissed_at IS NULL ORDER BY created_at DESC;",
    playerId,
  );
  return rows.map(rowToRecommendation);
}

export async function listActiveRuleIdsForPlayer(playerId: number): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ rule_id: string }>(
    "SELECT DISTINCT rule_id FROM recommendations WHERE player_id = ? AND dismissed_at IS NULL;",
    playerId,
  );
  return rows.map((r) => r.rule_id);
}

export async function dismissRecommendation(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE recommendations SET dismissed_at = ? WHERE id = ? AND dismissed_at IS NULL;",
    Date.now(),
    id,
  );
}

export async function dismissActiveByRule(playerId: number, ruleId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE recommendations SET dismissed_at = ? WHERE player_id = ? AND rule_id = ? AND dismissed_at IS NULL;",
    Date.now(),
    playerId,
    ruleId,
  );
}

/**
 * Deletes the active recommendation for the same rule (if any) and inserts
 * the new one. Implemented by dismissing the old one and inserting fresh —
 * keeps the historical record intact for future analytics.
 */
export async function replaceForRule(input: NewRecommendation): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE recommendations SET dismissed_at = ? WHERE player_id = ? AND rule_id = ? AND dismissed_at IS NULL;",
      Date.now(),
      input.player_id,
      input.rule_id,
    );
    await db.runAsync(
      `INSERT INTO recommendations (
         id, player_id, rule_id, title, summary, detail, drill,
         triggering_round_ids, threshold_value, threshold_label, created_at, dismissed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
      input.id,
      input.player_id,
      input.rule_id,
      input.title,
      input.summary,
      input.detail,
      input.drill,
      JSON.stringify(input.triggering_round_ids),
      input.threshold_value,
      input.threshold_label,
      Date.now(),
    );
  });
}

export async function countActiveForPlayer(playerId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM recommendations WHERE player_id = ? AND dismissed_at IS NULL;",
    playerId,
  );
  return row?.c ?? 0;
}

export async function countAllRecommendations(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM recommendations;",
  );
  return row?.c ?? 0;
}
