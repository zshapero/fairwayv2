import { describe, expect, it } from "vitest";
import { recentDecline } from "../rules";
import { makeRound } from "./helpers";

function roundWithDifferential(id: number, diff: number) {
  return makeRound({ id, differential: diff });
}

describe("recentDecline", () => {
  it("returns null with fewer than 15 rounds", () => {
    const rounds = Array.from({ length: 14 }, (_, i) => roundWithDifferential(i + 1, 18));
    expect(recentDecline(rounds)).toBeNull();
  });

  it("triggers when last 5 differentials average 1.5+ higher than the prior 10", () => {
    const previous = Array.from({ length: 10 }, (_, i) => roundWithDifferential(i + 1, 18));
    const recent = Array.from({ length: 5 }, (_, i) => roundWithDifferential(11 + i, 20));
    const result = recentDecline([...previous, ...recent]);
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBeCloseTo(2, 1);
  });

  it("does not trigger at exactly +1.0 average (boundary)", () => {
    const previous = Array.from({ length: 10 }, (_, i) => roundWithDifferential(i + 1, 18));
    const recent = Array.from({ length: 5 }, (_, i) => roundWithDifferential(11 + i, 19));
    expect(recentDecline([...previous, ...recent])).toBeNull();
  });
});
