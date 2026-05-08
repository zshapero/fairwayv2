import * as SQLite from "expo-sqlite";
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from "./schema";
import { planMigrationToV6 } from "./migrations";

const DB_NAME = "fairway.db";

let cachedDb: SQLite.SQLiteDatabase | null = null;
let migrationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function readColumnNames(
  db: SQLite.SQLiteDatabase,
  table: string,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return rows.map((r) => r.name);
}

async function readTableNames(db: SQLite.SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table';",
  );
  return rows.map((r) => r.name);
}

async function applyIncrementalMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const tables = await readTableNames(db);
  const [courses, rounds, hole_scores, recommendations] = await Promise.all([
    readColumnNames(db, "courses"),
    readColumnNames(db, "rounds"),
    readColumnNames(db, "hole_scores"),
    tables.includes("recommendations") ? readColumnNames(db, "recommendations") : Promise.resolve([] as string[]),
  ]);
  const statements = planMigrationToV6({
    columns: { courses, rounds, hole_scores, recommendations },
    tables,
  });
  for (const sql of statements) {
    await db.execAsync(sql);
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
    await applyIncrementalMigrations(db);
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
