import { describe, expect, it } from "vitest";
import { frontNineDeficit } from "../rules";
import { makeRound, makeContext } from "./helpers";

function roundWithSplit(id: number, frontTotal: number, backTotal: number) {
  // Distribute totals across 9 par-4 holes per side as evenly as possible.
  const distribute = (total: number) => {
    const base = Math.floor(total / 9);
    const remainder = total % 9;
    return Array.from({ length: 9 }, (_, i) => base + (i < remainder ? 1 : 0));
  };
  const fronts = distribute(frontTotal);
  const backs = distribute(backTotal);
  return makeRound({
    id,
    holes: [...fronts, ...backs].map((g, i) => ({
      hole_number: i + 1,
      par: 4,
      stroke_index: i + 1,
      gross_score: g,
      putts: null,
      fairway_hit: null,
      green_in_regulation: null,
      penalty_strokes: null,
      fairway_miss_direction: null,
      gir_miss_direction: null,
      hit_from_sand: 0,
      sand_save: null,
    })),
  });
}

describe("frontNineDeficit", () => {
  it("returns null with fewer than 10 rounds", () => {
    const rounds = Array.from({ length: 9 }, (_, i) => roundWithSplit(i + 1, 45, 40));
    expect(frontNineDeficit(makeContext(rounds))).toBeNull();
  });

  it("triggers when the front averages 3+ strokes worse than the back", () => {
    const rounds = Array.from({ length: 10 }, (_, i) => roundWithSplit(i + 1, 45, 41));
    const result = frontNineDeficit(makeContext(rounds));
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBeGreaterThanOrEqual(3);
  });

  it("does not trigger at exactly +2 on the front (boundary)", () => {
    const rounds = Array.from({ length: 10 }, (_, i) => roundWithSplit(i + 1, 43, 41));
    expect(frontNineDeficit(makeContext(rounds))).toBeNull();
  });
});
