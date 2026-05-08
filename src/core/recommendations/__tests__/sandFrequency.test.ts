import { describe, expect, it } from "vitest";
import { sandFrequency } from "../rules";
import { makeRound } from "./helpers";

function roundWithSandHoles(id: number, sandCount: number) {
  return makeRound({
    id,
    hole: (n) => ({ hit_from_sand: n <= sandCount ? 1 : 0 }),
  });
}

describe("sandFrequency", () => {
  it("returns null when fewer than 8 rounds are available", () => {
    const rounds = Array.from({ length: 7 }, (_, i) => roundWithSandHoles(i + 1, 6));
    expect(sandFrequency(rounds)).toBeNull();
  });

  it("triggers when 25%+ of holes had a sand shot", () => {
    // 5 sand holes per round × 8 rounds / 144 total = 27.7% → over the threshold.
    const rounds = Array.from({ length: 8 }, (_, i) => roundWithSandHoles(i + 1, 5));
    const result = sandFrequency(rounds);
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBeGreaterThanOrEqual(0.25);
  });

  it("does not trigger at 4 sand holes per round (~22%, boundary)", () => {
    const rounds = Array.from({ length: 8 }, (_, i) => roundWithSandHoles(i + 1, 4));
    expect(sandFrequency(rounds)).toBeNull();
  });
});
