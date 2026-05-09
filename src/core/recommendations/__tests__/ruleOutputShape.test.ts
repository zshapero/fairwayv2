import { describe, expect, it } from "vitest";
import { sliceTendency, threePuttFrequency } from "../rules";
import { makeContext, makeRound } from "./helpers";

describe("rule outputs include benchmark, confidence, priority, and type", () => {
  it("slice_tendency includes the bracket fairway benchmark and a confidence label", () => {
    // 8 rounds, ~75% of fairway misses are right.
    const rounds = Array.from({ length: 8 }, (_, i) =>
      makeRound({
        id: i + 1,
        holes: Array.from({ length: 18 }, (_, j) => {
          const hole_number = j + 1;
          const isPar3 = [2, 7, 10, 15].includes(j);
          const par = isPar3 ? 3 : 4;
          let dir: "left" | "right" | null = null;
          let fwHit: number | null = isPar3 ? null : 1;
          if (!isPar3) {
            if (j % 4 < 3) {
              dir = "right";
              fwHit = 0;
            }
          }
          return {
            hole_number,
            par,
            stroke_index: hole_number,
            gross_score: par,
            putts: null,
            fairway_hit: fwHit,
            green_in_regulation: null,
            penalty_strokes: null,
            fairway_miss_direction: dir,
            gir_miss_direction: null,
            hit_from_sand: 0,
            sand_save: null,
          };
        }),
      }),
    );
    const result = sliceTendency(makeContext(rounds, { handicapIndex: 18 }));
    expect(result).not.toBeNull();
    expect(result?.type).toBe("opportunity");
    expect(["high", "moderate", "emerging"]).toContain(result?.confidence);
    expect(typeof result?.priority).toBe("number");
    expect(result?.priority).toBeGreaterThan(0);
    expect(result?.priority).toBeLessThanOrEqual(100);
    // The bracket benchmark for handicap 18 fairways is 0.45; the rule
    // surfaces the 50/50 split benchmark on the player value and the
    // bracket fairway rate in the detail copy.
    expect(result?.benchmarkValue).toBe(0.5);
    expect(result?.detail).toMatch(/45%/); // bracket fairway-hit benchmark mentioned
    expect(result?.playerValueLabel).toContain("right");
  });

  it("three_putt_frequency includes the bracket benchmark in summary text", () => {
    const rounds = Array.from({ length: 5 }, (_, i) =>
      makeRound({
        id: i + 1,
        hole: (n) => ({ putts: n <= 4 ? 3 : 2 }),
      }),
    );
    const result = threePuttFrequency(makeContext(rounds, { handicapIndex: 18 }));
    expect(result).not.toBeNull();
    expect(result?.benchmarkValue).toBeCloseTo(2.6, 5); // 16-20 bracket
    expect(result?.summary).toMatch(/2\.6/);
  });
});
