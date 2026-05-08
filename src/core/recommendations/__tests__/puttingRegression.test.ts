import { describe, expect, it } from "vitest";
import { puttingRegression } from "../rules";
import { makeRound, makeRounds } from "./helpers";

function roundWithUniformPutts(id: number, putts: number) {
  return makeRound({
    id,
    hole: () => ({ putts: putts / 18 }),
    holes: Array.from({ length: 18 }, (_, i) =>
      // ensure integer per-hole putts that sum to `putts`.
      ({
        hole_number: i + 1,
        par: 4,
        stroke_index: i + 1,
        gross_score: 4,
        putts: i < putts % 18 ? Math.floor(putts / 18) + 1 : Math.floor(putts / 18),
        fairway_hit: null,
        green_in_regulation: null,
        penalty_strokes: null,
        fairway_miss_direction: null,
        gir_miss_direction: null,
        hit_from_sand: 0,
        sand_save: null,
      }),
    ),
  });
}

describe("puttingRegression", () => {
  it("returns null when fewer than 15 rounds are available", () => {
    const rounds = makeRounds(14, (i) => ({ id: i + 1 }));
    expect(puttingRegression(rounds)).toBeNull();
  });

  it("triggers when last 5 average 1.5+ more putts than the previous 10", () => {
    const previous = Array.from({ length: 10 }, (_, i) => roundWithUniformPutts(i + 1, 30));
    const recent = Array.from({ length: 5 }, (_, i) => roundWithUniformPutts(11 + i, 32));
    const result = puttingRegression([...previous, ...recent]);
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBeCloseTo(2, 1);
    expect(result?.triggeringRoundIds).toEqual([11, 12, 13, 14, 15]);
  });

  it("does not trigger when the recent jump is under 1.5 (boundary)", () => {
    // Recent avg 31, previous avg 30 → delta 1.0 (below threshold).
    const previous = Array.from({ length: 10 }, (_, i) => roundWithUniformPutts(i + 1, 30));
    const recent = Array.from({ length: 5 }, (_, i) => roundWithUniformPutts(11 + i, 31));
    expect(puttingRegression([...previous, ...recent])).toBeNull();
  });
});
