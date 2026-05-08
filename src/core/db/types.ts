export interface Player {
  id: number;
  name: string;
  handicap_index: number | null;
  created_at: string;
}

export interface Course {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  par: number;
  external_id: string | null;
}

export interface Tee {
  id: number;
  course_id: number;
  name: string;
  color: string | null;
  course_rating: number;
  slope_rating: number;
  yardage: number | null;
}

export interface TeeHole {
  id: number;
  tee_id: number;
  hole_number: number;
  par: number;
  yardage: number | null;
  stroke_index: number;
}

export interface Round {
  id: number;
  player_id: number;
  course_id: number;
  tee_id: number;
  played_at: string;
  pcc: number;
  is_nine_hole: number;
  completed_at: string | null;
  differential: number | null;
}

export type FairwayMissDirection = "left" | "right" | null;

export type GirMissDirection = "left" | "right" | "short" | "long" | null;

export interface HoleScore {
  id: number;
  round_id: number;
  hole_number: number;
  gross_score: number;
  putts: number | null;
  fairway_hit: number | null;
  green_in_regulation: number | null;
  penalty_strokes: number | null;
  fairway_miss_direction: FairwayMissDirection;
  gir_miss_direction: GirMissDirection;
  hit_from_sand: number;
  sand_save: number | null;
}

export interface HandicapSnapshot {
  id: number;
  player_id: number;
  handicap_index: number | null;
  computed_at: string;
  rounds_used: number;
}

export interface SchemaVersionRow {
  version: number;
  applied_at: string;
}

export type TableName =
  | "players"
  | "courses"
  | "tees"
  | "tee_holes"
  | "rounds"
  | "hole_scores"
  | "handicap_snapshots"
  | "schema_version";

export const ALL_TABLES: readonly TableName[] = [
  "players",
  "courses",
  "tees",
  "tee_holes",
  "rounds",
  "hole_scores",
  "handicap_snapshots",
  "schema_version",
];
