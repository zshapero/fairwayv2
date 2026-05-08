import { getBenchmarksFor, levelFor } from "../benchmarks";
import type {
  HandicapSnapshotPoint,
  RoundHole,
  RoundWithHoleScores,
  RuleContext,
} from "../types";

const DEFAULT_PARS = [4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4];
const DEFAULT_INDEXES = [7, 1, 17, 11, 5, 13, 3, 15, 9, 8, 16, 2, 10, 6, 12, 18, 4, 14];

export function makeHole(overrides: Partial<RoundHole> & { hole_number: number }): RoundHole {
  const par = overrides.par ?? DEFAULT_PARS[overrides.hole_number - 1] ?? 4;
  const stroke_index =
    overrides.stroke_index ?? DEFAULT_INDEXES[overrides.hole_number - 1] ?? overrides.hole_number;
  return {
    hole_number: overrides.hole_number,
    par,
    stroke_index,
    gross_score: overrides.gross_score ?? par,
    putts: overrides.putts ?? null,
    fairway_hit: overrides.fairway_hit ?? null,
    green_in_regulation: overrides.green_in_regulation ?? null,
    penalty_strokes: overrides.penalty_strokes ?? null,
    fairway_miss_direction: overrides.fairway_miss_direction ?? null,
    gir_miss_direction: overrides.gir_miss_direction ?? null,
    hit_from_sand: overrides.hit_from_sand ?? 0,
    sand_save: overrides.sand_save ?? null,
  };
}

export interface MakeRoundOptions {
  id?: number;
  played_at?: string;
  differential?: number | null;
  course_par?: number;
  course_rating?: number;
  slope_rating?: number;
  hole?: (n: number, def: RoundHole) => Partial<RoundHole>;
  holes?: RoundHole[];
}

export function makeRound(opts: MakeRoundOptions = {}): RoundWithHoleScores {
  const id = opts.id ?? 1;
  const holes: RoundHole[] = opts.holes
    ? opts.holes
    : Array.from({ length: 18 }, (_, i) => {
        const base = makeHole({ hole_number: i + 1 });
        if (!opts.hole) return base;
        return makeHole({ hole_number: i + 1, ...opts.hole(i + 1, base) });
      });
  return {
    id,
    player_id: 1,
    course_id: 1,
    tee_id: 1,
    played_at:
      opts.played_at ??
      `2026-01-${String(Math.min(28, id)).padStart(2, "0")}T12:00:00.000Z`,
    differential: opts.differential ?? null,
    course_par: opts.course_par ?? 72,
    course_rating: opts.course_rating ?? 72,
    slope_rating: opts.slope_rating ?? 113,
    holes,
  };
}

export function makeRounds(
  count: number,
  factory: (i: number) => MakeRoundOptions,
): RoundWithHoleScores[] {
  return Array.from({ length: count }, (_, i) => makeRound({ id: i + 1, ...factory(i) }));
}

export function makeContext(
  rounds: RoundWithHoleScores[],
  options: {
    handicapIndex?: number | null;
    handicapSnapshots?: HandicapSnapshotPoint[];
  } = {},
): RuleContext {
  const handicapIndex = options.handicapIndex ?? 18;
  return {
    rounds,
    benchmarks: getBenchmarksFor(handicapIndex),
    handicapIndex,
    level: levelFor(handicapIndex),
    handicapSnapshots: options.handicapSnapshots ?? [],
  };
}
