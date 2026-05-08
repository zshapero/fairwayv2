/**
 * Pure synthetic round generator. Used by the Debug screen to seed test data
 * for the recommendation engine. The function takes an array of available
 * tees (passed in by the caller, who reads them from SQLite) and returns
 * `RoundSeed[]` — plain data with no DB side-effects, so the scenario logic
 * is unit-testable in vitest.
 *
 * Scenarios are designed so that running them with the suggested round
 * counts is enough to *trigger* the corresponding rule on the
 * recommendations screen.
 */

import {
  adjustedGrossScore,
  scoreDifferential,
  strokesReceivedOnHole,
} from "@/core/handicap";
import type { FairwayMissDirection, GirMissDirection } from "@/core/db/types";

export interface AvailableTeeHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

export interface AvailableTee {
  id: number;
  course_id: number;
  course_par: number;
  course_rating: number;
  slope_rating: number;
  holes: readonly AvailableTeeHole[];
}

export type ScenarioKind =
  | "random"
  | "slicer"
  | "puller"
  | "putting_trouble"
  | "declining"
  | "improving"
  | "sand_trouble"
  | "approach_short"
  | "custom";

export interface ScenarioOptions {
  tees: readonly AvailableTee[];
  /** Number of days to spread rounds across, ending at `now`. Default 90. */
  daysSpan?: number;
  /** Target handicap for `random`/`custom` (5..30). Default 18. */
  targetHandicap?: number;
  /** Reference time. Defaults to `new Date()`. */
  now?: Date;
  /** Random source for testability. Defaults to `Math.random`. */
  rng?: () => number;
}

export interface HoleSeed {
  hole_number: number;
  gross_score: number;
  putts: number | null;
  fairway_hit: number | null;
  fairway_miss_direction: FairwayMissDirection;
  green_in_regulation: number | null;
  gir_miss_direction: GirMissDirection;
  penalty_strokes: number | null;
  hit_from_sand: number;
}

export interface RoundSeed {
  course_id: number;
  tee_id: number;
  played_at: string;
  course_par: number;
  course_rating: number;
  slope_rating: number;
  perHole: HoleSeed[];
  /** Pre-computed AGS and differential. */
  adjustedGross: number;
  differential: number;
  grossScore: number;
}

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function makeRng(rng?: () => number): () => number {
  return rng ?? Math.random;
}

function pickFrom<T>(items: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * items.length);
  return items[Math.min(items.length - 1, Math.max(0, idx))]!;
}

function gaussian(mean: number, std: number, rng: () => number): number {
  const u = Math.max(1e-9, 1 - rng());
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return z * std + mean;
}

function weightedPick<T extends string>(weights: Record<T, number>, rng: () => number): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1]![0];
}

// ---------------------------------------------------------------------------
// Per-hole sampling
// ---------------------------------------------------------------------------

interface HoleParams {
  /** Mean strokes-over-par for this hole. */
  targetMeanDelta: number;
  /** Probability the player hits the fairway when they have a chance to. */
  fairwayHitRate: number;
  /** Probability of green-in-regulation. */
  girHitRate: number;
  /** Probability the hole touches sand. */
  sandRate: number;
  /** Right-vs-left bias for fairway misses (0..1). 0.5 = neutral. */
  fairwayRightBias: number;
  /** Distribution over GIR-miss directions. */
  girMissWeights: Record<NonNullable<GirMissDirection>, number>;
  /** Boost mean putts (e.g. putting_trouble scenario). */
  threePuttBoost: number;
}

function defaultParams(targetHI: number): HoleParams {
  const target = targetHI / 18;
  return {
    targetMeanDelta: target,
    fairwayHitRate: Math.max(0.25, 0.6 - target * 0.18),
    girHitRate: Math.max(0.1, 0.45 - target * 0.18),
    sandRate: 0.18,
    fairwayRightBias: 0.5,
    girMissWeights: { short: 0.4, left: 0.25, right: 0.25, long: 0.1 },
    threePuttBoost: 0,
  };
}

function sampleHole(
  hole: AvailableTeeHole,
  params: HoleParams,
  rng: () => number,
): HoleSeed {
  // Score: gaussian around target mean delta, skewed slightly upward on hard
  // holes (HSI 1-6 get a bit more variance).
  const hardHoleAdj = hole.stroke_index <= 6 ? 0.25 : hole.stroke_index <= 12 ? 0 : -0.15;
  const mean = params.targetMeanDelta + hardHoleAdj;
  const std = 1.1;
  let delta = Math.round(gaussian(mean, std, rng));
  const cap = hole.par >= 5 ? 4 : 3;
  delta = Math.max(-1, Math.min(cap, delta));
  if (hole.par === 3 && delta < 0) delta = 0;
  const gross = Math.max(1, hole.par + delta);

  // Fairway / GIR rates degrade on blow-up holes.
  const overParPenalty = Math.max(0, delta) * 0.07;
  const fairwayHitChance = Math.max(0.1, params.fairwayHitRate - overParPenalty);
  const girHitChance = Math.max(0.05, params.girHitRate - overParPenalty);

  let fairway_hit: number | null = null;
  let fairway_miss_direction: FairwayMissDirection = null;
  if (hole.par >= 4) {
    if (rng() < fairwayHitChance) {
      fairway_hit = 1;
    } else {
      fairway_hit = 0;
      fairway_miss_direction = rng() < params.fairwayRightBias ? "right" : "left";
    }
  }

  let green_in_regulation: number;
  let gir_miss_direction: GirMissDirection = null;
  if (rng() < girHitChance) {
    green_in_regulation = 1;
  } else {
    green_in_regulation = 0;
    gir_miss_direction = weightedPick(params.girMissWeights, rng);
  }

  const hit_from_sand = rng() < params.sandRate ? 1 : 0;

  // Putts: 2 if GIR + base; missed greens chip-and-putt or two-putt; blow-up holes add a putt.
  const baseExtra = green_in_regulation === 1 ? 0 : rng() < 0.35 ? -1 : 0;
  let putts = 2 + baseExtra + (delta >= 3 ? 1 : 0);
  // Putting-trouble injection: probability of a three-putt above the natural rate.
  if (params.threePuttBoost > 0 && rng() < params.threePuttBoost) {
    putts = Math.max(putts, 3);
  }
  putts = Math.max(1, Math.min(5, putts));
  const penalty_strokes = delta >= 3 && rng() < 0.5 ? 1 : 0;

  return {
    hole_number: hole.hole_number,
    gross_score: gross,
    putts,
    fairway_hit,
    fairway_miss_direction,
    green_in_regulation,
    gir_miss_direction,
    penalty_strokes,
    hit_from_sand,
  };
}

// ---------------------------------------------------------------------------
// Round assembly
// ---------------------------------------------------------------------------

interface BuildRoundArgs {
  tee: AvailableTee;
  played_at: string;
  params: HoleParams;
  rng: () => number;
}

function buildRound({ tee, played_at, params, rng }: BuildRoundArgs): RoundSeed {
  const sortedHoles = [...tee.holes].sort((a, b) => a.hole_number - b.hole_number);
  const perHole = sortedHoles.map((h) => sampleHole(h, params, rng));
  const grossScores = perHole.map((h) => h.gross_score);
  const pars = sortedHoles.map((h) => h.par);
  // Use 0 strokes received for AGS so test data math is consistent and
  // independent of an evolving handicap index.
  const strokesReceivedPerHole = sortedHoles.map((h) => strokesReceivedOnHole(0, h.stroke_index));
  const ags = adjustedGrossScore({ grossScores, pars, strokesReceivedPerHole });
  const diff = scoreDifferential({
    adjustedGrossScore: ags,
    courseRating: tee.course_rating,
    slopeRating: tee.slope_rating,
  });
  return {
    course_id: tee.course_id,
    tee_id: tee.id,
    played_at,
    course_par: tee.course_par,
    course_rating: tee.course_rating,
    slope_rating: tee.slope_rating,
    perHole,
    adjustedGross: ags,
    differential: diff,
    grossScore: grossScores.reduce((s, g) => s + g, 0),
  };
}

function evenlySpacedTimestamps(count: number, daysSpan: number, now: Date): string[] {
  const end = now.getTime();
  const start = end - daysSpan * 24 * 60 * 60 * 1000;
  if (count <= 1) return [new Date(end).toISOString()];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * step).toISOString(),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Suggested round counts per scenario when the caller doesn't pass one.
 */
export const DEFAULT_SCENARIO_COUNTS: Record<ScenarioKind, number> = {
  random: 20,
  slicer: 10,
  puller: 10,
  putting_trouble: 10,
  declining: 15,
  improving: 15,
  sand_trouble: 10,
  approach_short: 10,
  custom: 10,
};

export function generateRoundsForScenario(
  scenario: ScenarioKind,
  count: number,
  options: ScenarioOptions,
): RoundSeed[] {
  if (options.tees.length === 0) {
    throw new Error("No tees available — import a course first.");
  }
  const rng = makeRng(options.rng);
  const now = options.now ?? new Date();
  const daysSpan = options.daysSpan ?? 90;
  const targetHandicap = options.targetHandicap ?? 18;

  const timestamps = evenlySpacedTimestamps(count, daysSpan, now);

  return timestamps.map((played_at, i) => {
    const tee = pickFrom(options.tees, rng);
    const params = paramsForScenario(scenario, i, count, targetHandicap);
    return buildRound({ tee, played_at, params, rng });
  });
}

function paramsForScenario(
  scenario: ScenarioKind,
  index: number,
  count: number,
  targetHandicap: number,
): HoleParams {
  switch (scenario) {
    case "slicer":
      return { ...defaultParams(targetHandicap), fairwayRightBias: 0.78 };
    case "puller":
      return { ...defaultParams(targetHandicap), fairwayRightBias: 0.22 };
    case "putting_trouble":
      // 18 holes × ~17% three-putt rate ≈ 3 three-putts/round.
      return { ...defaultParams(targetHandicap), threePuttBoost: 0.18 };
    case "declining": {
      // First 10 rounds at the target HI; last 5 at +4 strokes.
      const isRecent = index >= count - 5;
      return defaultParams(isRecent ? targetHandicap + 4 : targetHandicap);
    }
    case "improving": {
      // First 10 rounds at +4 strokes; last 5 at the target HI.
      const isRecent = index >= count - 5;
      return defaultParams(isRecent ? targetHandicap : targetHandicap + 4);
    }
    case "sand_trouble":
      return { ...defaultParams(targetHandicap), sandRate: 0.34 };
    case "approach_short":
      return {
        ...defaultParams(targetHandicap),
        girHitRate: 0.18, // miss greens often
        girMissWeights: { short: 0.65, left: 0.13, right: 0.13, long: 0.09 },
      };
    case "custom":
    case "random":
    default:
      return defaultParams(targetHandicap);
  }
}
