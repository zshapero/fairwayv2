import { describe, expect, it } from "vitest";
import {
  ballStrikingTrend,
  handicapDrop,
  personalBest,
  puttingImprovement,
} from "../rules";
import { makeContext, makeRound } from "./helpers";

function roundWithUniformPutts(id: number, putts: number) {
  return makeRound({
    id,
    holes: Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      par: 4,
      stroke_index: i + 1,
      gross_score: 4,
      putts: i < putts % 18 ? Math.floor(putts / 18) + 1 : Math.floor(putts / 18),
      fairway_hit: null,
      green_in_regulation: null,
      penalty_strokes: null,
      fairway_miss_direction: null,
      gir_miss_direction: null,
      hit_from_sand: 0,
      sand_save: null,
    })),
  });
}

describe("puttingImprovement", () => {
  it("triggers when last 5 rounds putt 1+ stroke better than the previous 10", () => {
    const previous = Array.from({ length: 10 }, (_, i) => roundWithUniformPutts(i + 1, 33));
    const recent = Array.from({ length: 5 }, (_, i) => roundWithUniformPutts(11 + i, 31));
    const result = puttingImprovement(makeContext([...previous, ...recent]));
    expect(result).not.toBeNull();
    expect(result?.type).toBe("strength");
    expect(result?.thresholdValue).toBeCloseTo(2, 1);
  });

  it("does not trigger when recent rounds aren't 1+ better (boundary)", () => {
    const previous = Array.from({ length: 10 }, (_, i) => roundWithUniformPutts(i + 1, 33));
    const recent = Array.from({ length: 5 }, (_, i) => roundWithUniformPutts(11 + i, 32.5));
    expect(puttingImprovement(makeContext([...previous, ...recent]))).toBeNull();
  });

  it("returns null with fewer than 15 rounds", () => {
    const rounds = Array.from({ length: 10 }, (_, i) => roundWithUniformPutts(i + 1, 30));
    expect(puttingImprovement(makeContext(rounds))).toBeNull();
  });
});

function roundWithGirRate(id: number, hitsPerRound: number) {
  return makeRound({
    id,
    hole: (n) => ({ green_in_regulation: n <= hitsPerRound ? 1 : 0 }),
  });
}

describe("ballStrikingTrend", () => {
  it("triggers when GIR rate jumps 8%+ over the prior 8 rounds", () => {
    const previous = Array.from({ length: 8 }, (_, i) => roundWithGirRate(i + 1, 5)); // 5/18 ≈ 28%
    const recent = Array.from({ length: 8 }, (_, i) => roundWithGirRate(9 + i, 8)); // 8/18 ≈ 44%
    const result = ballStrikingTrend(makeContext([...previous, ...recent]));
    expect(result).not.toBeNull();
    expect(result?.type).toBe("strength");
  });

  it("does not trigger when the lift is under 8% (boundary)", () => {
    const previous = Array.from({ length: 8 }, (_, i) => roundWithGirRate(i + 1, 5));
    const recent = Array.from({ length: 8 }, (_, i) => roundWithGirRate(9 + i, 6)); // tiny lift
    expect(ballStrikingTrend(makeContext([...previous, ...recent]))).toBeNull();
  });

  it("returns null with fewer than 16 rounds", () => {
    const rounds = Array.from({ length: 12 }, (_, i) => roundWithGirRate(i + 1, 10));
    expect(ballStrikingTrend(makeContext(rounds))).toBeNull();
  });
});

describe("handicapDrop", () => {
  it("triggers when the index drops 1.5+ in the last 30 days", () => {
    const now = Date.now();
    const snapshots = [
      {
        computed_at: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
        handicap_index: 22.0,
      },
      {
        computed_at: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString(),
        handicap_index: 21.5,
      },
      {
        computed_at: new Date(now).toISOString(),
        handicap_index: 19.5,
      },
    ];
    const ctx = makeContext([], { handicapSnapshots: snapshots });
    const result = handicapDrop(ctx);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("milestone");
  });

  it("does not trigger when the drop is under 1.5 (boundary)", () => {
    const now = Date.now();
    const snapshots = [
      {
        computed_at: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString(),
        handicap_index: 21,
      },
      {
        computed_at: new Date(now).toISOString(),
        handicap_index: 20,
      },
    ];
    expect(handicapDrop(makeContext([], { handicapSnapshots: snapshots }))).toBeNull();
  });

  it("returns null when there is no snapshot from at least 30 days ago", () => {
    const now = Date.now();
    const snapshots = [
      {
        computed_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        handicap_index: 21,
      },
      { computed_at: new Date(now).toISOString(), handicap_index: 19 },
    ];
    expect(handicapDrop(makeContext([], { handicapSnapshots: snapshots }))).toBeNull();
  });
});

describe("personalBest", () => {
  it("triggers when the most recent round has the lowest differential of all rounds", () => {
    const rounds = [
      makeRound({ id: 1, differential: 18 }),
      makeRound({ id: 2, differential: 16 }),
      makeRound({ id: 3, differential: 14 }),
    ];
    const result = personalBest(makeContext(rounds));
    expect(result).not.toBeNull();
    expect(result?.type).toBe("milestone");
    expect(result?.drill).toBe("");
  });

  it("does not trigger when the latest round isn't the best", () => {
    const rounds = [
      makeRound({ id: 1, differential: 12 }),
      makeRound({ id: 2, differential: 16 }),
      makeRound({ id: 3, differential: 14 }),
    ];
    expect(personalBest(makeContext(rounds))).toBeNull();
  });

  it("does not trigger when only one round exists or differentials are missing", () => {
    expect(personalBest(makeContext([makeRound({ id: 1, differential: 14 })]))).toBeNull();
    const rounds = [
      makeRound({ id: 1, differential: null }),
      makeRound({ id: 2, differential: null }),
    ];
    expect(personalBest(makeContext(rounds))).toBeNull();
  });
});
