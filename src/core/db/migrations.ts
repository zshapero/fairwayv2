/**
 * Idempotent migration planner. Each step inspects the live `hole_scores`
 * columns and only emits the ALTER statements for columns that don't already
 * exist, so running migrations twice is a no-op.
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

export interface ExistingColumnsByTable {
  courses: readonly string[];
  rounds: readonly string[];
  hole_scores: readonly string[];
}

/**
 * Plan the SQL needed to bring the database forward to schema v4. Returns the
 * ordered list of statements to execute. Pass the columns that already exist
 * in each table so the planner can skip ones that are already in place.
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

  // The unique index on courses.external_id is owned by the courses migration,
  // but it's idempotent via IF NOT EXISTS so we can always emit it.
  if (!new Set(existing.courses).has("external_id")) {
    statements.push(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_external_id ON courses(external_id);",
    );
  }

  return statements;
}
