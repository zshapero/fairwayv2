import * as SQLite from "expo-sqlite";
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from "./schema";

const DB_NAME = "fairway.db";

let cachedDb: SQLite.SQLiteDatabase | null = null;
let migrationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function applyIncrementalMigrations(
  db: SQLite.SQLiteDatabase,
  fromVersion: number,
): Promise<void> {
  if (fromVersion < 2) {
    // v1 -> v2: add external_id to courses for GolfCourseAPI imports.
    const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(courses);");
    if (!cols.some((c) => c.name === "external_id")) {
      await db.execAsync("ALTER TABLE courses ADD COLUMN external_id TEXT;");
      await db.execAsync(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_external_id ON courses(external_id);",
      );
    }
  }
  if (fromVersion < 3) {
    // v2 -> v3: round lifecycle (draft vs completed) + cached differential,
    // plus a penalty_strokes field on hole_scores for the round entry flow.
    const roundCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(rounds);");
    if (!roundCols.some((c) => c.name === "completed_at")) {
      await db.execAsync("ALTER TABLE rounds ADD COLUMN completed_at TEXT;");
    }
    if (!roundCols.some((c) => c.name === "differential")) {
      await db.execAsync("ALTER TABLE rounds ADD COLUMN differential REAL;");
    }
    const holeCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(hole_scores);");
    if (!holeCols.some((c) => c.name === "penalty_strokes")) {
      await db.execAsync("ALTER TABLE hole_scores ADD COLUMN penalty_strokes INTEGER;");
    }
  }
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execAsync(statement);
  }
  const row = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1;",
  );
  const currentVersion = row?.version ?? 0;
  if (currentVersion < SCHEMA_VERSION) {
    await applyIncrementalMigrations(db, currentVersion);
    await db.runAsync(
      "INSERT OR REPLACE INTO schema_version (version) VALUES (?);",
      SCHEMA_VERSION,
    );
  }
}

/**
 * Open (and migrate) the singleton SQLite database. Subsequent calls return
 * the same instance.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (cachedDb) return cachedDb;
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      cachedDb = db;
      return db;
    })();
  }
  return migrationPromise;
}

export async function getSchemaVersion(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1;",
  );
  return row?.version ?? 0;
}

export async function clearAllData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM hole_scores;
    DELETE FROM rounds;
    DELETE FROM handicap_snapshots;
    DELETE FROM tee_holes;
    DELETE FROM tees;
    DELETE FROM courses;
    DELETE FROM players;
  `);
}

/**
 * Test-only helper that resets the cached singleton. Not intended for runtime use.
 */
export function __resetDatabaseForTesting(): void {
  cachedDb = null;
  migrationPromise = null;
}
