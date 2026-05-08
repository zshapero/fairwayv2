import type {
  FairwayMissDirection,
  GirMissDirection,
} from "@/core/db/types";

/** A single hole, pre-joined with its par and stroke index for the rules. */
export interface RoundHole {
  hole_number: number;
  par: number;
  stroke_index: number;
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

/**
 * The shape every recommendation rule receives. Rules are passed an array of
 * these in chronological order (oldest first).
 */
export interface RoundWithHoleScores {
  id: number;
  player_id: number;
  course_id: number;
  tee_id: number;
  played_at: string;
  differential: number | null;
  course_par: number;
  course_rating: number;
  slope_rating: number;
  holes: readonly RoundHole[];
}

/** The pure output of a rule when it triggers (or null when it doesn't). */
export interface RuleOutput {
  ruleId: string;
  title: string;
  summary: string;
  detail: string;
  drill: string;
  triggeringRoundIds: number[];
  thresholdValue: number | null;
  thresholdLabel: string | null;
}

export type Rule = (rounds: readonly RoundWithHoleScores[]) => RuleOutput | null;
