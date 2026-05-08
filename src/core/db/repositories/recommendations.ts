import { getDatabase } from "../database";
import type {
  ConfidenceLevel,
  Recommendation,
  RecommendationType,
} from "../types";

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
  priority_score: number;
  confidence: ConfidenceLevel;
  benchmark_value: number | null;
  benchmark_label: string | null;
  player_value: number | null;
  player_value_label: string | null;
  recommendation_type: RecommendationType;
  selected_drill_variant_id: string | null;
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
    priority_score: row.priority_score ?? 0,
    confidence: row.confidence ?? "moderate",
    benchmark_value: row.benchmark_value,
    benchmark_label: row.benchmark_label,
    player_value: row.player_value,
    player_value_label: row.player_value_label,
    recommendation_type: row.recommendation_type ?? "opportunity",
    selected_drill_variant_id: row.selected_drill_variant_id,
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
  priority_score: number;
  confidence: ConfidenceLevel;
  benchmark_value: number | null;
  benchmark_label: string | null;
  player_value: number | null;
  player_value_label: string | null;
  recommendation_type: RecommendationType;
  selected_drill_variant_id: string | null;
}

const INSERT_SQL = `INSERT INTO recommendations (
       id, player_id, rule_id, title, summary, detail, drill,
       triggering_round_ids, threshold_value, threshold_label,
       priority_score, confidence, benchmark_value, benchmark_label,
       player_value, player_value_label, recommendation_type,
       selected_drill_variant_id, created_at, dismissed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);`;

function insertParams(input: NewRecommendation, createdAt: number) {
  return [
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
    input.priority_score,
    input.confidence,
    input.benchmark_value,
    input.benchmark_label,
    input.player_value,
    input.player_value_label,
    input.recommendation_type,
    input.selected_drill_variant_id,
    createdAt,
  ] as const;
}

export async function createRecommendation(input: NewRecommendation): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(INSERT_SQL, ...insertParams(input, Date.now()));
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

export async function replaceForRule(input: NewRecommendation): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE recommendations SET dismissed_at = ? WHERE player_id = ? AND rule_id = ? AND dismissed_at IS NULL;",
      Date.now(),
      input.player_id,
      input.rule_id,
    );
    await db.runAsync(INSERT_SQL, ...insertParams(input, Date.now()));
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

export async function countActiveByTypeForPlayer(
  playerId: number,
): Promise<Record<RecommendationType, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ recommendation_type: RecommendationType; c: number }>(
    "SELECT recommendation_type, COUNT(*) AS c FROM recommendations WHERE player_id = ? AND dismissed_at IS NULL GROUP BY recommendation_type;",
    playerId,
  );
  const counts: Record<RecommendationType, number> = {
    opportunity: 0,
    strength: 0,
    milestone: 0,
  };
  for (const row of rows) {
    counts[row.recommendation_type] = row.c;
  }
  return counts;
}

export async function countAllRecommendations(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM recommendations;",
  );
  return row?.c ?? 0;
}
