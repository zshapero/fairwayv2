/**
 * Hardcoded performance benchmarks by handicap bracket. Values approximate
 * published USGA / PGA Tour Strokes-Gained amateur statistics. Used by the
 * recommendation engine to phrase findings in context — "below where most
 * golfers at your level land" rather than just a raw number.
 *
 * - fairways:       fairway hit rate on par 4/5 (0-1)
 * - gir:            green-in-regulation rate per hole (0-1)
 * - putts:          total putts per round
 * - threePutts:     three-putt holes per round
 * - scrambling:     % of GIR-missed holes that finish at par or better (0-1)
 * - penalties:      penalty strokes per round
 * - par3Over:       average strokes over par on par-3 holes
 * - hardestOver:    average strokes over par on stroke-index 1-6 holes
 */

export interface Benchmarks {
  fairways: number;
  gir: number;
  putts: number;
  threePutts: number;
  scrambling: number;
  penalties: number;
  par3Over: number;
  hardestOver: number;
}

export type BenchmarkBracket =
  | "scratch"
  | "1-5"
  | "6-10"
  | "11-15"
  | "16-20"
  | "21-25"
  | "26+";

export const BENCHMARKS: Record<BenchmarkBracket, Benchmarks> = {
  scratch: { fairways: 0.62, gir: 0.62, putts: 30, threePutts: 1.0, scrambling: 0.5, penalties: 0.5, par3Over: 0.4, hardestOver: 0.5 },
  "1-5": { fairways: 0.58, gir: 0.55, putts: 31, threePutts: 1.5, scrambling: 0.42, penalties: 0.8, par3Over: 0.7, hardestOver: 0.8 },
  "6-10": { fairways: 0.54, gir: 0.45, putts: 32, threePutts: 1.8, scrambling: 0.35, penalties: 1.1, par3Over: 0.9, hardestOver: 1.1 },
  "11-15": { fairways: 0.5, gir: 0.35, putts: 33, threePutts: 2.2, scrambling: 0.28, penalties: 1.4, par3Over: 1.1, hardestOver: 1.4 },
  "16-20": { fairways: 0.45, gir: 0.25, putts: 34, threePutts: 2.6, scrambling: 0.22, penalties: 1.7, par3Over: 1.4, hardestOver: 1.7 },
  "21-25": { fairways: 0.4, gir: 0.18, putts: 35, threePutts: 3.0, scrambling: 0.18, penalties: 2.0, par3Over: 1.7, hardestOver: 2.0 },
  "26+": { fairways: 0.35, gir: 0.12, putts: 36, threePutts: 3.4, scrambling: 0.15, penalties: 2.3, par3Over: 2.0, hardestOver: 2.3 },
};

export function bracketFor(handicapIndex: number | null): BenchmarkBracket {
  if (handicapIndex === null) return "21-25"; // sensible default for new players
  if (handicapIndex < 1) return "scratch";
  if (handicapIndex <= 5) return "1-5";
  if (handicapIndex <= 10) return "6-10";
  if (handicapIndex <= 15) return "11-15";
  if (handicapIndex <= 20) return "16-20";
  if (handicapIndex <= 25) return "21-25";
  return "26+";
}

export function getBenchmarksFor(handicapIndex: number | null): Benchmarks {
  return BENCHMARKS[bracketFor(handicapIndex)];
}

/** Player skill bucket used by drill-variant selection. */
export type PlayerLevel = "beginner" | "mid" | "advanced";

export function levelFor(handicapIndex: number | null): PlayerLevel {
  if (handicapIndex === null) return "beginner";
  if (handicapIndex <= 10) return "advanced";
  if (handicapIndex <= 20) return "mid";
  return "beginner";
}
