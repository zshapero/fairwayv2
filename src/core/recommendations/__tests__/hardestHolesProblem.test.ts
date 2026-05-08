import { describe, expect, it } from "vitest";
import { hardestHolesProblem } from "../rules";
import { makeRound, makeContext } from "./helpers";

function roundWithHardHoleScore(id: number, hardScore: number) {
  return makeRound({
    id,
    hole: (_n, def) =>
      def.stroke_index >= 1 && def.stroke_index <= 6 ? { gross_score: hardScore } : {},
  });
}

describe("hardestHolesProblem", () => {
  it("returns null with fewer than 5 rounds", () => {
    const rounds = Array.from({ length: 4 }, (_, i) => roundWithHardHoleScore(i + 1, 7));
    expect(hardestHolesProblem(makeContext(rounds))).toBeNull();
  });

  it("triggers when stroke-index 1-6 holes average bogey + 1 or worse", () => {
    // Set HSI 1-6 holes (hole_numbers 2,4,5,7,12,17 in DEFAULT_INDEXES) to par + 2.
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithHardHoleScore(i + 1, 7));
    const result = hardestHolesProblem(makeContext(rounds));
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBeGreaterThanOrEqual(2);
  });

  it("does not trigger when hard holes only average bogey (boundary)", () => {
    // Hardest holes scoring par + 1 → average +1 < threshold of +2.
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithHardHoleScore(i + 1, 5));
    expect(hardestHolesProblem(makeContext(rounds))).toBeNull();
  });
});
