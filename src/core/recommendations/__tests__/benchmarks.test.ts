import { describe, expect, it } from "vitest";
import { BENCHMARKS, bracketFor, getBenchmarksFor, levelFor } from "../benchmarks";

describe("bracketFor", () => {
  it("maps representative handicap values to the right bracket", () => {
    expect(bracketFor(null)).toBe("21-25");
    expect(bracketFor(0)).toBe("scratch");
    expect(bracketFor(0.9)).toBe("scratch");
    expect(bracketFor(1)).toBe("1-5");
    expect(bracketFor(5)).toBe("1-5");
    expect(bracketFor(5.1)).toBe("6-10");
    expect(bracketFor(10)).toBe("6-10");
    expect(bracketFor(11)).toBe("11-15");
    expect(bracketFor(15)).toBe("11-15");
    expect(bracketFor(16)).toBe("16-20");
    expect(bracketFor(20)).toBe("16-20");
    expect(bracketFor(21)).toBe("21-25");
    expect(bracketFor(25)).toBe("21-25");
    expect(bracketFor(26)).toBe("26+");
    expect(bracketFor(40)).toBe("26+");
  });
});

describe("getBenchmarksFor", () => {
  it("returns the bracket benchmarks for the player's index", () => {
    expect(getBenchmarksFor(0.5)).toEqual(BENCHMARKS.scratch);
    expect(getBenchmarksFor(18)).toEqual(BENCHMARKS["16-20"]);
    expect(getBenchmarksFor(null)).toEqual(BENCHMARKS["21-25"]);
  });
});

describe("levelFor", () => {
  it("maps handicap to player level", () => {
    expect(levelFor(null)).toBe("beginner");
    expect(levelFor(0)).toBe("advanced");
    expect(levelFor(10)).toBe("advanced");
    expect(levelFor(11)).toBe("mid");
    expect(levelFor(20)).toBe("mid");
    expect(levelFor(21)).toBe("beginner");
    expect(levelFor(30)).toBe("beginner");
  });
});
