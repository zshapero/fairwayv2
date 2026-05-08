import type {
  ConfidenceLevel,
  FairwayMissDirection,
  GirMissDirection,
  RecommendationType,
} from "@/core/db/types";
import type { Benchmarks, PlayerLevel } from "./benchmarks";

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

export interface HandicapSnapshotPoint {
  /** ISO timestamp from the snapshot row. */
  computed_at: string;
  handicap_index: number | null;
}

/** Inputs every rule receives so it can phrase findings in player context. */
export interface RuleContext {
  rounds: readonly RoundWithHoleScores[];
  benchmarks: Benchmarks;
  handicapIndex: number | null;
  level: PlayerLevel;
  /** Snapshots in chronological order (oldest first). Used by handicap_drop. */
  handicapSnapshots: readonly HandicapSnapshotPoint[];
}

/** What a triggered rule emits. The runner persists this verbatim. */
export interface RuleOutput {
  ruleId: string;
  type: RecommendationType;
  title: string;
  summary: string;
  detail: string;
  drill: string;
  selectedDrillVariantId: string | null;
  triggeringRoundIds: number[];
  thresholdValue: number | null;
  thresholdLabel: string | null;
  priority: number;
  confidence: ConfidenceLevel;
  playerValue: number | null;
  playerValueLabel: string | null;
  benchmarkValue: number | null;
  benchmarkLabel: string | null;
}

export type Rule = (ctx: RuleContext) => RuleOutput | null;

export type Severity = "mild" | "moderate" | "severe";

export interface DrillVariant {
  id: string;
  drill: string;
  /** Required level (omit for "any"). */
  level?: PlayerLevel;
  /** Required severity (omit for "any"). */
  severity?: Severity;
}

/**
 * Pick the most-specific matching variant: prefer (level + severity) match,
 * then level only, then severity only, then the first variant as fallback.
 */
export function selectDrillVariant(
  variants: readonly DrillVariant[],
  level: PlayerLevel,
  severity: Severity,
): DrillVariant {
  const exact = variants.find((v) => v.level === level && v.severity === severity);
  if (exact) return exact;
  const byLevel = variants.find((v) => v.level === level && !v.severity);
  if (byLevel) return byLevel;
  const bySeverity = variants.find((v) => v.severity === severity && !v.level);
  if (bySeverity) return bySeverity;
  const generic = variants.find((v) => !v.level && !v.severity);
  return generic ?? variants[0]!;
}
