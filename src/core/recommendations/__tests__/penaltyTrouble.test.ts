import { describe, expect, it } from "vitest";
import { penaltyTrouble } from "../rules";
import { makeRound, makeContext } from "./helpers";

function roundWithPenalties(id: number, totalPenalties: number) {
  return makeRound({
    id,
    hole: (n) => ({ penalty_strokes: n <= totalPenalties ? 1 : 0 }),
  });
}

describe("penaltyTrouble", () => {
  it("returns null with fewer than 5 rounds", () => {
    const rounds = Array.from({ length: 4 }, (_, i) => roundWithPenalties(i + 1, 3));
    expect(penaltyTrouble(makeContext(rounds))).toBeNull();
  });

  it("triggers at 2+ penalty strokes per round average", () => {
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithPenalties(i + 1, 2));
    const result = penaltyTrouble(makeContext(rounds));
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBe(2);
  });

  it("does not trigger at 1 penalty per round (boundary)", () => {
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithPenalties(i + 1, 1));
    expect(penaltyTrouble(makeContext(rounds))).toBeNull();
  });
});
