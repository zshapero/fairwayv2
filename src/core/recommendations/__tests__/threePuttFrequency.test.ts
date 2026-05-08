import { describe, expect, it } from "vitest";
import { threePuttFrequency } from "../rules";
import { makeRound, makeContext } from "./helpers";

function roundWithThreePutts(id: number, threePuttCount: number) {
  return makeRound({
    id,
    hole: (n) => ({ putts: n <= threePuttCount ? 3 : 2 }),
  });
}

describe("threePuttFrequency", () => {
  it("returns null with fewer than 5 rounds", () => {
    const rounds = Array.from({ length: 4 }, (_, i) => roundWithThreePutts(i + 1, 4));
    expect(threePuttFrequency(makeContext(rounds))).toBeNull();
  });

  it("triggers when averaging 3+ three-putts per round", () => {
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithThreePutts(i + 1, 3));
    const result = threePuttFrequency(makeContext(rounds));
    expect(result).not.toBeNull();
    expect(result?.thresholdValue).toBe(3);
  });

  it("does not trigger at exactly 2 three-putts per round (boundary)", () => {
    const rounds = Array.from({ length: 5 }, (_, i) => roundWithThreePutts(i + 1, 2));
    expect(threePuttFrequency(makeContext(rounds))).toBeNull();
  });
});
