/**
 * Idempotent migration planner. Each step inspects the live schema (column
 * presence per table, plus the set of existing tables) and only emits the
 * statements that are still required, so running migrations twice is a no-op.
 *
 * The planner is split out from the database singleton so the SQL is unit-
 * testable against any SQLite-compatible runtime (including `node:sqlite` in
 * vitest) without dragging in expo-sqlite.
 */

interface ColumnSpec {
  name: string;
  alterSql: string;
}

/** Columns that `hole_scores` must have at schema v4. */
export const HOLE_SCORE_COLUMNS_V4: readonly ColumnSpec[] = [
  {
    name: "penalty_strokes",
    alterSql: "ALTER TABLE hole_scores ADD COLUMN penalty_strokes INTEGER;",
  },
  {
    name: "fairway_miss_direction",
    alterSql: "ALTER TABLE hole_scores ADD COLUMN fairway_miss_direction TEXT;",
  },
  {
    name: "gir_miss_direction",
    alterSql: "ALTER TABLE hole_scores ADD COLUMN gir_miss_direction TEXT;",
  },
  {
    name: "hit_from_sand",
    alterSql: "ALTER TABLE hole_scores ADD COLUMN hit_from_sand INTEGER NOT NULL DEFAULT 0;",
  },
  {
    name: "sand_save",
    alterSql: "ALTER TABLE hole_scores ADD COLUMN sand_save INTEGER;",
  },
];

/** Columns that `courses` must have at schema v4. */
export const COURSE_COLUMNS_V4: readonly ColumnSpec[] = [
  {
    name: "external_id",
    alterSql: "ALTER TABLE courses ADD COLUMN external_id TEXT;",
  },
];

/** Columns that `rounds` must have at schema v4. */
export const ROUND_COLUMNS_V4: readonly ColumnSpec[] = [
  {
    name: "completed_at",
    alterSql: "ALTER TABLE rounds ADD COLUMN completed_at TEXT;",
  },
  {
    name: "differential",
    alterSql: "ALTER TABLE rounds ADD COLUMN differential REAL;",
  },
];

export const RECOMMENDATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL,
    rule_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail TEXT NOT NULL,
    drill TEXT NOT NULL,
    triggering_round_ids TEXT NOT NULL,
    threshold_value REAL,
    threshold_label TEXT,
    created_at INTEGER NOT NULL,
    dismissed_at INTEGER,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );`;

export const RECOMMENDATIONS_INDEX_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_recommendations_player_active ON recommendations(player_id, dismissed_at);",
  "CREATE INDEX IF NOT EXISTS idx_recommendations_player_rule_active ON recommendations(player_id, rule_id, dismissed_at);",
];

export interface ExistingColumnsByTable {
  courses: readonly string[];
  rounds: readonly string[];
  hole_scores: readonly string[];
}

export interface ExistingState {
  columns: ExistingColumnsByTable;
  /** Names of tables that already exist in the database. */
  tables: readonly string[];
}

/**
 * Plan the SQL needed to bring the database forward to schema v4 (the column
 * additions to existing tables). Pass the columns already in each table so
 * the planner skips ones that are already in place.
 */
export function planMigrationToV4(existing: ExistingColumnsByTable): string[] {
  const statements: string[] = [];

  const need = (specs: readonly ColumnSpec[], existingCols: readonly string[]) => {
    const have = new Set(existingCols);
    for (const spec of specs) {
      if (!have.has(spec.name)) statements.push(spec.alterSql);
    }
  };

  need(COURSE_COLUMNS_V4, existing.courses);
  need(ROUND_COLUMNS_V4, existing.rounds);
  need(HOLE_SCORE_COLUMNS_V4, existing.hole_scores);

  if (!new Set(existing.courses).has("external_id")) {
    statements.push(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_external_id ON courses(external_id);",
    );
  }

  return statements;
}

/**
 * Plan the full set of statements to bring the database to schema v5: the v4
 * column additions plus the new `recommendations` table and its supporting
 * indexes. The recommendations DDL uses `IF NOT EXISTS` so it's safe to emit
 * unconditionally, but we only emit it when the table doesn't already exist
 * to keep idempotency tests honest.
 */
export function planMigrationToV5(existing: ExistingState): string[] {
  const statements = planMigrationToV4(existing.columns);
  const tables = new Set(existing.tables);
  if (!tables.has("recommendations")) {
    statements.push(RECOMMENDATIONS_TABLE_SQL);
    statements.push(...RECOMMENDATIONS_INDEX_SQL);
  }
  return statements;
}
