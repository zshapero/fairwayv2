import { describe, expect, it } from "vitest";
import { scramblingDeficit } from "../rules";
import { makeRound, makeContext } from "./helpers";

function roundWithScrambling(id: number, missesAndSaves: { misses: number; saves: number }) {
  // 18 par-4 holes so the par/save math is uniform across the round.
  const totalMisses = missesAndSaves.misses;
  return makeRound({
    id,
    holes: Array.from({ length: 18 }, (_, i) => {
      const hole_number = i + 1;
      const isMiss = hole_number <= totalMisses;
      const isSave = hole_number <= missesAndSaves.saves;
      const gross = isMiss ? (isSave ? 4 : 6) : 4;
      return {
        hole_number,
        par: 4,
        stroke_index: hole_number,
        gross_score: gross,
        putts: null,
        fairway_hit: null,
        green_in_regulation: isMiss ? 0 : 1,
        penalty_strokes: null,
        fairway_miss_direction: null,
        gir_miss_direction: null,
        hit_from_sand: 0,
        sand_save: null,
      };
    }),
  });
}

describe("scramblingDeficit", () => {
  it("returns null with fewer than 5 rounds", () => {
    const rounds = Array.from({ length: 4 }, (_, i) =>
      roundWithScrambling(i + 1, { misses: 12, saves: 1 }),
    );
    expect(scramblingDeficit(makeContext(rounds))).toBeNull();
  });

  it("triggers when scrambling rate is below 25%", () => {
    // 12 misses per round × 5 rounds = 60 scramble holes; 5 saves total → 8.3%.
    const rounds = Array.from({ length: 5 }, (_, i) =>
      roundWithScrambling(i + 1, { misses: 12, saves: 1 }),
    );
    const result = scramblingDeficit(makeContext(rounds));
    expect(result).not.toBeNull();
    expect((result?.thresholdValue ?? 1)).toBeLessThan(0.25);
  });

  it("does not trigger at exactly 25% scrambling (boundary)", () => {
    // 12 misses per round, 3 saves per round → 25% scramble rate exactly.
    const rounds = Array.from({ length: 5 }, (_, i) =>
      roundWithScrambling(i + 1, { misses: 12, saves: 3 }),
    );
    expect(scramblingDeficit(makeContext(rounds))).toBeNull();
  });
});
