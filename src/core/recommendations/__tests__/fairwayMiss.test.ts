import { describe, expect, it } from "vitest";
import { pullTendency, sliceTendency } from "../rules";
import { makeRound } from "./helpers";

function roundWithFairwayMisses(id: number, ratioRight: number, ratioLeft: number) {
  // 14 par-4/5 holes (skipping the 4 par 3s in default layout).
  const HOLES = 18;
  return makeRound({
    id,
    holes: Array.from({ length: HOLES }, (_, i) => {
      const hole_number = i + 1;
      // Default pars on indexes 2,7,10,15 (0-based) are par 3.
      const isPar3 = [2, 7, 10, 15].includes(i);
      const par = isPar3 ? 3 : 4;
      let dir: "left" | "right" | null = null;
      let fairwayHit = 1;
      if (!isPar3) {
        const r = (i / HOLES);
        if (r < ratioRight) {
          dir = "right";
          fairwayHit = 0;
        } else if (r < ratioRight + ratioLeft) {
          dir = "left";
          fairwayHit = 0;
        }
      }
      return {
        hole_number,
        par,
        stroke_index: hole_number,
        gross_score: par,
        putts: null,
        fairway_hit: isPar3 ? null : fairwayHit,
        green_in_regulation: null,
        penalty_strokes: null,
        fairway_miss_direction: dir,
        gir_miss_direction: null,
        hit_from_sand: 0,
        sand_save: null,
      };
    }),
  });
}

describe("sliceTendency", () => {
  it("returns null when fewer than 8 rounds are available", () => {
    const rounds = Array.from({ length: 7 }, (_, i) =>
      roundWithFairwayMisses(i + 1, 0.7, 0.1),
    );
    expect(sliceTendency(rounds)).toBeNull();
  });

  it("triggers when 60%+ of fairway misses are right", () => {
    const rounds = Array.from({ length: 8 }, (_, i) =>
      roundWithFairwayMisses(i + 1, 0.55, 0.05),
    );
    const result = sliceTendency(rounds);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe("slice_tendency");
    expect((result?.thresholdValue ?? 0)).toBeGreaterThanOrEqual(0.6);
  });

  it("does not trigger when right misses are under 60% (boundary)", () => {
    // Right ≈ 50%, left ≈ 25% → ratio right = 50/(50+25) = 67%, still over.
    // Force just under by making left > right.
    const rounds = Array.from({ length: 8 }, (_, i) =>
      roundWithFairwayMisses(i + 1, 0.3, 0.45),
    );
    expect(sliceTendency(rounds)).toBeNull();
  });
});

describe("pullTendency", () => {
  it("triggers when 60%+ of fairway misses are left", () => {
    const rounds = Array.from({ length: 8 }, (_, i) =>
      roundWithFairwayMisses(i + 1, 0.05, 0.55),
    );
    const result = pullTendency(rounds);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe("pull_tendency");
  });

  it("does not trigger when most misses are right (boundary)", () => {
    const rounds = Array.from({ length: 8 }, (_, i) =>
      roundWithFairwayMisses(i + 1, 0.55, 0.05),
    );
    expect(pullTendency(rounds)).toBeNull();
  });

  it("returns null when there aren't enough fairway misses to evaluate", () => {
    // Mostly hits → fewer than 10 misses → not enough data.
    const rounds = Array.from({ length: 8 }, (_, i) =>
      roundWithFairwayMisses(i + 1, 0.0, 0.0),
    );
    expect(pullTendency(rounds)).toBeNull();
  });
});
