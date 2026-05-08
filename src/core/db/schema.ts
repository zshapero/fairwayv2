export const SCHEMA_VERSION = 6;

export const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    handicap_index REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    par INTEGER NOT NULL,
    external_id TEXT UNIQUE
  );`,

  `CREATE TABLE IF NOT EXISTS tees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    course_rating REAL NOT NULL,
    slope_rating INTEGER NOT NULL,
    yardage INTEGER,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS tee_holes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tee_id INTEGER NOT NULL,
    hole_number INTEGER NOT NULL,
    par INTEGER NOT NULL,
    yardage INTEGER,
    stroke_index INTEGER NOT NULL,
    FOREIGN KEY (tee_id) REFERENCES tees(id) ON DELETE CASCADE,
    UNIQUE (tee_id, hole_number)
  );`,

  `CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    tee_id INTEGER NOT NULL,
    played_at TEXT NOT NULL,
    pcc REAL NOT NULL DEFAULT 0,
    is_nine_hole INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    differential REAL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (tee_id) REFERENCES tees(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS hole_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL,
    hole_number INTEGER NOT NULL,
    gross_score INTEGER NOT NULL,
    putts INTEGER,
    fairway_hit INTEGER,
    green_in_regulation INTEGER,
    penalty_strokes INTEGER,
    fairway_miss_direction TEXT,
    gir_miss_direction TEXT,
    hit_from_sand INTEGER NOT NULL DEFAULT 0,
    sand_save INTEGER,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    UNIQUE (round_id, hole_number)
  );`,

  `CREATE TABLE IF NOT EXISTS handicap_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    handicap_index REAL,
    computed_at TEXT NOT NULL DEFAULT (datetime('now')),
    rounds_used INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS recommendations (
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
    priority_score REAL NOT NULL DEFAULT 0,
    confidence TEXT NOT NULL DEFAULT 'moderate',
    benchmark_value REAL,
    benchmark_label TEXT,
    player_value REAL,
    player_value_label TEXT,
    recommendation_type TEXT NOT NULL DEFAULT 'opportunity',
    selected_drill_variant_id TEXT,
    created_at INTEGER NOT NULL,
    dismissed_at INTEGER,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_recommendations_player_active
    ON recommendations(player_id, dismissed_at);`,

  `CREATE INDEX IF NOT EXISTS idx_recommendations_player_rule_active
    ON recommendations(player_id, rule_id, dismissed_at);`,

  `CREATE TABLE IF NOT EXISTS player_drill_log (
    id TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL,
    recommendation_id TEXT NOT NULL,
    practiced_at INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_drill_log_recommendation
    ON player_drill_log(recommendation_id, practiced_at);`,
];
