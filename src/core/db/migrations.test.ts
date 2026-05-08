import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  planMigrationToV4,
  planMigrationToV5,
  RECOMMENDATIONS_INDEX_SQL,
  RECOMMENDATIONS_TABLE_SQL,
} from "./migrations";

// Load node:sqlite via CJS so vitest's vite-based resolver doesn't try to
// transform it as a regular bare specifier.
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = InstanceType<typeof DatabaseSync>;

describe("planMigrationToV4", () => {
  it("emits all ALTER statements when the database is fresh from v1", () => {
    const statements = planMigrationToV4({
      courses: ["id", "name", "city", "state", "par"],
      rounds: ["id", "player_id", "course_id", "tee_id", "played_at", "pcc", "is_nine_hole"],
      hole_scores: [
        "id",
        "round_id",
        "hole_number",
        "gross_score",
        "putts",
        "fairway_hit",
        "green_in_regulation",
      ],
    });
    expect(statements).toEqual([
      "ALTER TABLE courses ADD COLUMN external_id TEXT;",
      "ALTER TABLE rounds ADD COLUMN completed_at TEXT;",
      "ALTER TABLE rounds ADD COLUMN differential REAL;",
      "ALTER TABLE hole_scores ADD COLUMN penalty_strokes INTEGER;",
      "ALTER TABLE hole_scores ADD COLUMN fairway_miss_direction TEXT;",
      "ALTER TABLE hole_scores ADD COLUMN gir_miss_direction TEXT;",
      "ALTER TABLE hole_scores ADD COLUMN hit_from_sand INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE hole_scores ADD COLUMN sand_save INTEGER;",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_external_id ON courses(external_id);",
    ]);
  });

  it("is idempotent: returns no statements when every column already exists", () => {
    const statements = planMigrationToV4({
      courses: ["id", "name", "city", "state", "par", "external_id"],
      rounds: [
        "id",
        "player_id",
        "course_id",
        "tee_id",
        "played_at",
        "pcc",
        "is_nine_hole",
        "completed_at",
        "differential",
      ],
      hole_scores: [
        "id",
        "round_id",
        "hole_number",
        "gross_score",
        "putts",
        "fairway_hit",
        "green_in_regulation",
        "penalty_strokes",
        "fairway_miss_direction",
        "gir_miss_direction",
        "hit_from_sand",
        "sand_save",
      ],
    });
    expect(statements).toEqual([]);
  });

  it("emits only the missing columns on an in-progress upgrade", () => {
    // A v3 database that already has external_id, completed_at, differential,
    // and penalty_strokes, but is missing the new shot-tracking columns.
    const statements = planMigrationToV4({
      courses: ["id", "name", "city", "state", "par", "external_id"],
      rounds: [
        "id",
        "player_id",
        "course_id",
        "tee_id",
        "played_at",
        "pcc",
        "is_nine_hole",
        "completed_at",
        "differential",
      ],
      hole_scores: [
        "id",
        "round_id",
        "hole_number",
        "gross_score",
        "putts",
        "fairway_hit",
        "green_in_regulation",
        "penalty_strokes",
      ],
    });
    expect(statements).toEqual([
      "ALTER TABLE hole_scores ADD COLUMN fairway_miss_direction TEXT;",
      "ALTER TABLE hole_scores ADD COLUMN gir_miss_direction TEXT;",
      "ALTER TABLE hole_scores ADD COLUMN hit_from_sand INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE hole_scores ADD COLUMN sand_save INTEGER;",
    ]);
  });
});

describe("migration integration (node:sqlite)", () => {
  function createV1Schema(db: DatabaseSync) {
    db.exec(`
      CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        city TEXT,
        state TEXT,
        par INTEGER NOT NULL
      );
      CREATE TABLE rounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        tee_id INTEGER NOT NULL,
        played_at TEXT NOT NULL,
        pcc REAL NOT NULL DEFAULT 0,
        is_nine_hole INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE hole_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        round_id INTEGER NOT NULL,
        hole_number INTEGER NOT NULL,
        gross_score INTEGER NOT NULL,
        putts INTEGER,
        fairway_hit INTEGER,
        green_in_regulation INTEGER,
        UNIQUE (round_id, hole_number)
      );
    `);
  }

  function listColumns(db: DatabaseSync, table: string): string[] {
    return (
      db.prepare(`PRAGMA table_info(${table});`).all() as Array<{ name: string }>
    ).map((r) => r.name);
  }

  it("upgrades a v1 database to v4 without losing existing rows", () => {
    const db = new DatabaseSync(":memory:");
    createV1Schema(db);

    db.prepare(
      "INSERT INTO courses (name, city, state, par) VALUES ('Old Tom', 'St Andrews', 'Scotland', 72);",
    ).run();
    db.prepare(
      "INSERT INTO hole_scores (round_id, hole_number, gross_score, putts, fairway_hit, green_in_regulation) VALUES (1, 1, 5, 2, 1, 1);",
    ).run();

    const statements = planMigrationToV4({
      courses: listColumns(db, "courses"),
      rounds: listColumns(db, "rounds"),
      hole_scores: listColumns(db, "hole_scores"),
    });
    for (const sql of statements) db.exec(sql);

    const courseRow = db.prepare("SELECT * FROM courses WHERE id = 1;").get() as
      | Record<string, unknown>
      | undefined;
    expect(courseRow?.name).toBe("Old Tom");
    expect(courseRow?.external_id).toBeNull();

    const holeRow = db.prepare("SELECT * FROM hole_scores WHERE id = 1;").get() as
      | Record<string, unknown>
      | undefined;
    expect(holeRow?.gross_score).toBe(5);
    expect(holeRow?.putts).toBe(2);
    expect(holeRow?.fairway_hit).toBe(1);
    expect(holeRow?.fairway_miss_direction).toBeNull();
    expect(holeRow?.gir_miss_direction).toBeNull();
    expect(holeRow?.hit_from_sand).toBe(0);
    expect(holeRow?.sand_save).toBeNull();

    // Idempotent: rerunning the planner produces no further work.
    const second = planMigrationToV4({
      courses: listColumns(db, "courses"),
      rounds: listColumns(db, "rounds"),
      hole_scores: listColumns(db, "hole_scores"),
    });
    expect(second).toEqual([]);
  });
});

describe("planMigrationToV5", () => {
  const fullyMigratedColumns = {
    courses: ["id", "name", "city", "state", "par", "external_id"],
    rounds: [
      "id",
      "player_id",
      "course_id",
      "tee_id",
      "played_at",
      "pcc",
      "is_nine_hole",
      "completed_at",
      "differential",
    ],
    hole_scores: [
      "id",
      "round_id",
      "hole_number",
      "gross_score",
      "putts",
      "fairway_hit",
      "green_in_regulation",
      "penalty_strokes",
      "fairway_miss_direction",
      "gir_miss_direction",
      "hit_from_sand",
      "sand_save",
    ],
  };

  it("emits the recommendations table + indexes when missing on a v4 database", () => {
    const statements = planMigrationToV5({
      columns: fullyMigratedColumns,
      tables: ["players", "courses", "tees", "tee_holes", "rounds", "hole_scores"],
    });
    expect(statements).toEqual([
      RECOMMENDATIONS_TABLE_SQL,
      ...RECOMMENDATIONS_INDEX_SQL,
    ]);
  });

  it("is idempotent when the recommendations table already exists", () => {
    const statements = planMigrationToV5({
      columns: fullyMigratedColumns,
      tables: [
        "players",
        "courses",
        "tees",
        "tee_holes",
        "rounds",
        "hole_scores",
        "recommendations",
      ],
    });
    expect(statements).toEqual([]);
  });
});

describe("recommendations migration integration (node:sqlite)", () => {
  function listTables(db: DatabaseSync): string[] {
    return (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table';").all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
  }

  it("creates the recommendations table on a v4 database without touching existing data", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
      CREATE TABLE courses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, city TEXT, state TEXT, par INTEGER, external_id TEXT);
      CREATE TABLE rounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER, course_id INTEGER, tee_id INTEGER,
        played_at TEXT, pcc REAL, is_nine_hole INTEGER, completed_at TEXT, differential REAL
      );
      CREATE TABLE hole_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER, hole_number INTEGER,
        gross_score INTEGER, putts INTEGER, fairway_hit INTEGER, green_in_regulation INTEGER,
        penalty_strokes INTEGER, fairway_miss_direction TEXT, gir_miss_direction TEXT,
        hit_from_sand INTEGER NOT NULL DEFAULT 0, sand_save INTEGER
      );
    `);
    db.prepare("INSERT INTO players (name) VALUES ('You');").run();

    const statements = planMigrationToV5({
      columns: {
        courses: ["id", "name", "city", "state", "par", "external_id"],
        rounds: [
          "id",
          "player_id",
          "course_id",
          "tee_id",
          "played_at",
          "pcc",
          "is_nine_hole",
          "completed_at",
          "differential",
        ],
        hole_scores: [
          "id",
          "round_id",
          "hole_number",
          "gross_score",
          "putts",
          "fairway_hit",
          "green_in_regulation",
          "penalty_strokes",
          "fairway_miss_direction",
          "gir_miss_direction",
          "hit_from_sand",
          "sand_save",
        ],
      },
      tables: listTables(db),
    });
    for (const sql of statements) db.exec(sql);

    expect(listTables(db)).toContain("recommendations");
    const player = db.prepare("SELECT * FROM players WHERE id = 1;").get() as
      | Record<string, unknown>
      | undefined;
    expect(player?.name).toBe("You");

    // Inserting a recommendation works end-to-end.
    db.prepare(
      `INSERT INTO recommendations (id, player_id, rule_id, title, summary, detail, drill, triggering_round_ids, threshold_value, threshold_label, created_at, dismissed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    ).run(
      "putting_regression_1",
      1,
      "putting_regression",
      "Putting has slipped",
      "summary",
      "detail",
      "drill",
      "[1,2,3]",
      1.8,
      "+1.8 putts/round",
      Date.now(),
      null,
    );
    const rec = db.prepare("SELECT * FROM recommendations WHERE id = ?;").get(
      "putting_regression_1",
    ) as Record<string, unknown> | undefined;
    expect(rec?.rule_id).toBe("putting_regression");
    expect(rec?.dismissed_at).toBeNull();
  });
});
