import { describe, expect, it } from "vitest";
import { parThreeWeakness } from "../rules";
import { makeRound } from "./helpers";

function roundWithPar3Score(id: number, scoreOnPar3: number) {
  return makeRound({
    id,
    hole: (_n, def) => (def.par === 3 ? { gross_score: scoreOnPar3 } : {}),
  });
}

describe("parThreeWeakness", () => {
  it("returns null with fewer than 5 rounds", () => {
    const rounds = Array.from({ length: 4 }, (_, i) => roundWithPar3Score(i + 1, 5));
    expect(parThreeWeakness(rounds)).toBeNull();
  });

  it("triggers when par 3s average 1.5+ over par", () => {
    // Par 3 score = 5 → +2 over par for 4 par 3s × 5 rounds = 20 holes.
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithPar3Score(i + 1, 5));
    const result = parThreeWeakness(rounds);
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBeGreaterThanOrEqual(1.5);
  });

  it("does not trigger at exactly +1 on par 3s (boundary)", () => {
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithPar3Score(i + 1, 4));
    expect(parThreeWeakness(rounds)).toBeNull();
  });
});
