import { describe, expect, it } from "vitest";
import {
  generateRoundsForScenario,
  type AvailableTee,
} from "./roundGenerator";

const DEFAULT_PARS = [4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4];
const DEFAULT_INDEXES = [7, 1, 17, 11, 5, 13, 3, 15, 9, 8, 16, 2, 10, 6, 12, 18, 4, 14];

const TEE: AvailableTee = {
  id: 1,
  course_id: 1,
  course_par: 72,
  course_rating: 72,
  slope_rating: 113,
  holes: DEFAULT_PARS.map((par, i) => ({
    hole_number: i + 1,
    par,
    stroke_index: DEFAULT_INDEXES[i] ?? i + 1,
  })),
};

/**
 * Mulberry32: tiny deterministic RNG so the scenario assertions don't
 * depend on whatever `Math.random` returns on a given run.
 */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateRoundsForScenario", () => {
  it("random scenario produces rounds averaging within ±2 strokes of the target handicap", () => {
    const seeds = generateRoundsForScenario("random", 30, {
      tees: [TEE],
      targetHandicap: 20,
      rng: seededRng(42),
    });
    const avgDiff = seeds.reduce((s, r) => s + r.differential, 0) / seeds.length;
    expect(avgDiff).toBeGreaterThan(18);
    expect(avgDiff).toBeLessThan(22);
  });

  it("custom scenario respects the supplied target handicap", () => {
    const seeds = generateRoundsForScenario("custom", 20, {
      tees: [TEE],
      targetHandicap: 10,
      rng: seededRng(7),
    });
    const avgDiff = seeds.reduce((s, r) => s + r.differential, 0) / seeds.length;
    expect(avgDiff).toBeGreaterThan(8);
    expect(avgDiff).toBeLessThan(12);
  });

  it("slicer scenario biases ≥60% of fairway misses to the right", () => {
    const seeds = generateRoundsForScenario("slicer", 10, {
      tees: [TEE],
      rng: seededRng(11),
    });
    const allFairwayHoles = seeds.flatMap((s) => s.perHole.filter((h) => h.fairway_hit !== null));
    const misses = allFairwayHoles.filter((h) => h.fairway_hit === 0);
    const right = misses.filter((h) => h.fairway_miss_direction === "right").length;
    expect(misses.length).toBeGreaterThan(15);
    expect(right / misses.length).toBeGreaterThanOrEqual(0.6);
  });

  it("puller scenario biases ≥60% of fairway misses to the left", () => {
    const seeds = generateRoundsForScenario("puller", 10, {
      tees: [TEE],
      rng: seededRng(101),
    });
    const misses = seeds
      .flatMap((s) => s.perHole)
      .filter((h) => h.fairway_hit === 0);
    const left = misses.filter((h) => h.fairway_miss_direction === "left").length;
    expect(left / misses.length).toBeGreaterThanOrEqual(0.6);
  });

  it("putting trouble scenario averages ≥3 three-putts per round", () => {
    const seeds = generateRoundsForScenario("putting_trouble", 10, {
      tees: [TEE],
      rng: seededRng(2025),
    });
    const totalThreePutts = seeds.reduce((sum, r) => {
      return sum + r.perHole.filter((h) => (h.putts ?? 0) >= 3).length;
    }, 0);
    expect(totalThreePutts / seeds.length).toBeGreaterThanOrEqual(3);
  });

  it("declining scenario shows last 5 differentials averaging ≥3 strokes higher than the prior 10", () => {
    const seeds = generateRoundsForScenario("declining", 15, {
      tees: [TEE],
      rng: seededRng(99),
    });
    const sorted = [...seeds].sort((a, b) => a.played_at.localeCompare(b.played_at));
    const previous = sorted.slice(0, 10);
    const recent = sorted.slice(-5);
    const prevAvg = previous.reduce((s, r) => s + r.differential, 0) / previous.length;
    const recentAvg = recent.reduce((s, r) => s + r.differential, 0) / recent.length;
    expect(recentAvg - prevAvg).toBeGreaterThanOrEqual(3);
  });

  it("improving scenario shows last 5 differentials averaging lower than the prior 10", () => {
    const seeds = generateRoundsForScenario("improving", 15, {
      tees: [TEE],
      rng: seededRng(55),
    });
    const sorted = [...seeds].sort((a, b) => a.played_at.localeCompare(b.played_at));
    const previous = sorted.slice(0, 10);
    const recent = sorted.slice(-5);
    const prevAvg = previous.reduce((s, r) => s + r.differential, 0) / previous.length;
    const recentAvg = recent.reduce((s, r) => s + r.differential, 0) / recent.length;
    expect(prevAvg - recentAvg).toBeGreaterThanOrEqual(2);
  });

  it("sand trouble scenario produces ≥25% of holes with hit_from_sand", () => {
    const seeds = generateRoundsForScenario("sand_trouble", 10, {
      tees: [TEE],
      rng: seededRng(13),
    });
    const allHoles = seeds.flatMap((s) => s.perHole);
    const sand = allHoles.filter((h) => h.hit_from_sand === 1).length;
    expect(sand / allHoles.length).toBeGreaterThanOrEqual(0.25);
  });

  it("approach short scenario sends >50% of GIR misses short", () => {
    const seeds = generateRoundsForScenario("approach_short", 10, {
      tees: [TEE],
      rng: seededRng(77),
    });
    const misses = seeds
      .flatMap((s) => s.perHole)
      .filter((h) => h.green_in_regulation === 0 && h.gir_miss_direction !== null);
    const short = misses.filter((h) => h.gir_miss_direction === "short").length;
    expect(short / misses.length).toBeGreaterThan(0.5);
  });

  it("spreads played_at across the requested daysSpan", () => {
    const now = new Date("2026-05-08T12:00:00.000Z");
    const seeds = generateRoundsForScenario("random", 5, {
      tees: [TEE],
      rng: seededRng(1),
      now,
      daysSpan: 90,
    });
    const sorted = [...seeds].sort((a, b) => a.played_at.localeCompare(b.played_at));
    const earliest = new Date(sorted[0]!.played_at).getTime();
    const latest = new Date(sorted[sorted.length - 1]!.played_at).getTime();
    expect(latest - earliest).toBeGreaterThan(60 * 24 * 60 * 60 * 1000);
    expect(latest).toBeLessThanOrEqual(now.getTime());
  });

  it("throws when no tees are provided", () => {
    expect(() => generateRoundsForScenario("random", 5, { tees: [] })).toThrow();
  });
});
