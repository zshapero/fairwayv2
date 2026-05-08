import { describe, expect, it } from "vitest";
import { calculateMovement } from "./calculateMovement";

// All scenarios verified against WHS Rules 5.2 and 5.9:
// https://www.usga.org/handicapping/roh/2024-rules-of-handicapping.html

describe("calculateMovement", () => {
  it("returns null indices and no drop when fewer than 3 rounds total", () => {
    const result = calculateMovement([10.0, 12.0], 14.0);
    // After we add the new diff there will be 3, so newIndex IS established.
    expect(result.oldIndex).toBeNull();
    expect(result.oldRoundsUsed).toBe(0);
    expect(result.newRoundsUsed).toBe(1);
    expect(result.newIndex).toBe(8.0); // lowest 1 of 3 = 10.0, then -2.0
    expect(result.triggeredEsr).toBe(0);
    expect(result.droppedDifferential).toBeNull();

    const stillEarly = calculateMovement([15.0], 16.0);
    expect(stillEarly.oldIndex).toBeNull();
    expect(stillEarly.newIndex).toBeNull();
    expect(stillEarly.oldRoundsUsed).toBe(0);
    expect(stillEarly.newRoundsUsed).toBe(0);
    expect(stillEarly.isCounting).toBe(false);
  });

  it("counts a new low differential and reports the dropped one", () => {
    // 8 prior rounds: lowest 2 are [17, 18] → old index = 17.5.
    const before = [25, 22, 18, 24, 17, 23, 26, 21];
    const result = calculateMovement(before, 16);

    expect(result.oldIndex).toBe(17.5);
    expect(result.oldRoundsUsed).toBe(2);
    // 9 rounds → lowest 3 [16, 17, 18], averaged = 17.0.
    expect(result.newIndex).toBe(17.0);
    expect(result.newRoundsUsed).toBe(3);
    expect(result.newDifferentialRank).toBe(1);
    expect(result.isCounting).toBe(true);
    // No drop: 17 and 18 are still in the lowest 3.
    expect(result.droppedDifferential).toBeNull();
  });

  it("does not count a high new differential (no drop, rank reflects placement)", () => {
    // 8 rounds, lowest 2 used = [17, 18].
    const before = [25, 22, 18, 24, 17, 23, 26, 21];
    const result = calculateMovement(before, 30);

    expect(result.oldIndex).toBe(17.5);
    // After: 9 rounds, lowest 3 = [17, 18, 21]; avg 18.66… rounds to 18.7.
    expect(result.newIndex).toBe(18.7);
    expect(result.newDifferentialRank).toBe(9);
    expect(result.isCounting).toBe(false);
    expect(result.droppedDifferential).toBeNull();
  });

  it("triggers an exceptional score reduction when 7-9.99 below the index", () => {
    // 6 rounds: lowest 2 averaged - 1.0. With diffs all near 22, old index ≈ 21.
    const before = [22, 22, 22, 22, 20, 22];
    const result = calculateMovement(before, 12);
    expect(result.oldIndex).toBe(20); // (20+22)/2 - 1
    // delta = 20 - 12 = 8.0 → ESR -1.
    expect(result.triggeredEsr).toBe(1);
  });

  it("triggers a -2.0 ESR when 10+ strokes below the index", () => {
    const before = [22, 22, 22, 22, 20, 22];
    const result = calculateMovement(before, 5);
    // delta = 20 - 5 = 15 → ESR -2.
    expect(result.triggeredEsr).toBe(2);
  });

  it("displaces the previously-counting differential when a better one is posted", () => {
    // 5 rounds, lowest 1 used = 10. Old index = 10.
    const before = [10, 12, 13, 14, 15];
    const result = calculateMovement(before, 9);
    expect(result.oldIndex).toBe(10);
    // 6 rounds → lowest 2 averaged - 1.0; lowest 2 = [9, 10] → avg 9.5 - 1 = 8.5.
    expect(result.newIndex).toBe(8.5);
    expect(result.newDifferentialRank).toBe(1);
    expect(result.isCounting).toBe(true);
    // 6 rounds: lowest 2 averaged - 1.0. Old "lowest 1" was 10; new "lowest 2"
    // is [9, 10] so 10 is still in. No drop yet.
    expect(result.droppedDifferential).toBeNull();
    expect(result.oldRoundsUsed).toBe(1);
    expect(result.newRoundsUsed).toBe(2);
  });

  it("rolls the 20-round window so the oldest counting differential drops out", () => {
    // 20 priors where the oldest is the absolute lowest. After we add a new
    // round, the 21-round combined list is sliced to the last 20, dropping
    // that very low oldest entry from the calculation entirely.
    const before = [
      4, // oldest, also the lowest — this should fall out of the window
      25, 22, 18, 24, 17, 23, 26, 21, 19, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
    ];
    expect(before.length).toBe(20);
    const result = calculateMovement(before, 26);

    // After: drop the oldest (4); window is the next 19 + new round (26).
    // Lowest 8 of that 20-row window = [17, 18, 19, 21, 22, 23, 24, 25].
    expect(result.newRoundsUsed).toBe(8);
    expect(result.droppedDifferential).toBe(4);
    // The new 26 is rank 9 in the after window (8 strictly lower) → not counting.
    expect(result.isCounting).toBe(false);
    expect(result.newDifferentialRank).toBe(9);
  });
});
