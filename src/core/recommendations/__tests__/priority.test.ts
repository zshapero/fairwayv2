import { describe, expect, it } from "vitest";
import { computePriority } from "../priority";

describe("computePriority", () => {
  it("computes the headline formula", () => {
    expect(computePriority(2, 0.5, 4)).toBe(2 * 10 + 0.5 * 30 + 4 * 5);
  });

  it("caps chronicity at 8 weeks", () => {
    expect(computePriority(0, 0, 8)).toBe(40);
    expect(computePriority(0, 0, 30)).toBe(40);
  });

  it("caps the final score at 100", () => {
    expect(computePriority(10, 1, 8)).toBe(100);
    expect(computePriority(50, 5, 100)).toBe(100);
  });

  it("clamps negative inputs", () => {
    expect(computePriority(-3, -1, -2)).toBe(0);
  });

  it("clamps severity to 0-1", () => {
    expect(computePriority(0, 5, 0)).toBe(30);
  });
});
