import { describe, expect, it } from "vitest";
import type { TeeHole } from "@/core/db/types";
import { computeRoundSummary } from "./roundSummary";

function buildHoles(pars: number[]): TeeHole[] {
  // Stroke indexes 1-18 in hole order so the test math stays predictable.
  return pars.map((par, i) => ({
    id: i + 1,
    tee_id: 1,
    hole_number: i + 1,
    par,
    yardage: null,
    stroke_index: i + 1,
  }));
}

describe("computeRoundSummary", () => {
  const PARS_72 = [4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4];

  it("matches the USGA worked example (par 72, 85 AGS, 71.2/131) for a scratch player", () => {
    const teeHoles = buildHoles(PARS_72);
    // 18 holes summing to 85 with no over-par hole exceeding double bogey for a
    // scratch (CH=0) player so AGS == gross.
    const grossPerHole = [4, 5, 3, 4, 4, 4, 5, 3, 4, 5, 4, 6, 5, 5, 5, 4, 6, 9];
    const total = grossPerHole.reduce((s, x) => s + x, 0);
    expect(total).toBe(85);

    const result = computeRoundSummary({
      playerId: 1,
      roundId: 1,
      teeHoles,
      courseRating: 71.2,
      slopeRating: 131,
      par: 72,
      handicapIndexBefore: 0,
      perHole: grossPerHole.map((g, i) => ({
        hole_number: i + 1,
        gross_score: g,
        putts: null,
        fairway_hit: null,
        green_in_regulation: null,
        penalty_strokes: null,
        fairway_miss_direction: null,
        gir_miss_direction: null,
        hit_from_sand: 0,
      })),
      priorDifferentials: [],
    });

    expect(result.grossScore).toBe(85);
    // CH for HI=0 at 71.2/131/par72 is round(-0.8) = -1 (plus handicap), so
    // the player gives one stroke back at HSI 18 → NDB on hole 18 is 5.
    // The 9 on hole 18 (par 4) caps to 5; AGS = 85 - 9 + 5 = 81.
    expect(result.courseHandicap).toBe(-1);
    expect(result.adjustedGrossScore).toBe(81);
    expect(result.scoreDifferential).toBe(8.5);
  });

  it("returns null projected index when fewer than 3 differentials exist", () => {
    const teeHoles = buildHoles(PARS_72);
    const result = computeRoundSummary({
      playerId: 1,
      roundId: 1,
      teeHoles,
      courseRating: 72,
      slopeRating: 113,
      par: 72,
      handicapIndexBefore: null,
      perHole: PARS_72.map((p, i) => ({
        hole_number: i + 1,
        gross_score: p,
        putts: null,
        fairway_hit: null,
        green_in_regulation: null,
        penalty_strokes: null,
        fairway_miss_direction: null,
        gir_miss_direction: null,
        hit_from_sand: 0,
      })),
      priorDifferentials: [],
    });
    expect(result.projectedHandicapIndex).toBeNull();
  });

  it("projects a -2.0 adjusted index after 3 rounds", () => {
    const teeHoles = buildHoles(PARS_72);
    const result = computeRoundSummary({
      playerId: 1,
      roundId: 1,
      teeHoles,
      courseRating: 72,
      slopeRating: 113,
      par: 72,
      handicapIndexBefore: null,
      perHole: PARS_72.map((p, i) => ({
        hole_number: i + 1,
        gross_score: p + 1,
        putts: null,
        fairway_hit: null,
        green_in_regulation: null,
        penalty_strokes: null,
        fairway_miss_direction: null,
        gir_miss_direction: null,
        hit_from_sand: 0,
      })),
      priorDifferentials: [20, 22],
    });
    // New differential = AGS(90) - 72 = 18; lowest of [18, 20, 22] is 18 - 2 = 16.
    expect(result.scoreDifferential).toBe(18);
    expect(result.projectedHandicapIndex).toBe(16);
  });
});
