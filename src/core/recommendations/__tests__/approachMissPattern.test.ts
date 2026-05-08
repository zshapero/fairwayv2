import { describe, expect, it } from "vitest";
import { approachMissPattern } from "../rules";
import { makeRound, makeContext } from "./helpers";

function roundWithGirMisses(id: number, mix: { left: number; right: number; short: number; long: number }) {
  const directions: Array<"left" | "right" | "short" | "long" | null> = [];
  for (const d of ["left", "right", "short", "long"] as const) {
    for (let i = 0; i < mix[d]; i++) directions.push(d);
  }
  while (directions.length < 18) directions.push(null);
  return makeRound({
    id,
    holes: directions.map((d, i) => ({
      hole_number: i + 1,
      par: 4,
      stroke_index: i + 1,
      gross_score: 4,
      putts: null,
      fairway_hit: null,
      green_in_regulation: d === null ? 1 : 0,
      penalty_strokes: null,
      fairway_miss_direction: null,
      gir_miss_direction: d,
      hit_from_sand: 0,
      sand_save: null,
    })),
  });
}

describe("approachMissPattern", () => {
  it("returns null with fewer than 8 rounds", () => {
    const rounds = Array.from({ length: 7 }, (_, i) =>
      roundWithGirMisses(i + 1, { left: 1, right: 1, short: 6, long: 1 }),
    );
    expect(approachMissPattern(makeContext(rounds))).toBeNull();
  });

  it("triggers when one direction tops 50% of misses", () => {
    const rounds = Array.from({ length: 8 }, (_, i) =>
      roundWithGirMisses(i + 1, { left: 1, right: 1, short: 6, long: 1 }),
    );
    const result = approachMissPattern(makeContext(rounds));
    expect(result).not.toBeNull();
    expect(result?.title).toMatch(/short/i);
    expect(result?.thresholdValue).toBeGreaterThan(0.5);
  });

  it("does not trigger when no direction tops 50% (boundary)", () => {
    // Even split across 4 directions → 25% each.
    const rounds = Array.from({ length: 8 }, (_, i) =>
      roundWithGirMisses(i + 1, { left: 2, right: 2, short: 2, long: 2 }),
    );
    expect(approachMissPattern(makeContext(rounds))).toBeNull();
  });
});
