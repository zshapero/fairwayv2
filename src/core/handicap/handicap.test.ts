import { describe, expect, it } from "vitest";
import {
  adjustedGrossScore,
  courseHandicap,
  exceptionalScoreReduction,
  handicapIndex,
  netDoubleBogey,
  scoreDifferential,
  strokesReceivedOnHole,
} from "./index";

// All worked examples below are taken from the USGA WHS Rules of Handicapping (2024):
// https://www.usga.org/handicapping/roh/2024-rules-of-handicapping.html

describe("netDoubleBogey", () => {
  // USGA Rule 3.1: maximum hole score is par + 2 + handicap strokes received.
  it("matches the USGA example: par 4 with 1 stroke received gives a cap of 7", () => {
    expect(netDoubleBogey(4, 1)).toBe(7);
  });

  it("returns par + 2 when no strokes are received", () => {
    expect(netDoubleBogey(3, 0)).toBe(5);
    expect(netDoubleBogey(5, 0)).toBe(7);
  });
});

describe("strokesReceivedOnHole", () => {
  // USGA Appendix E example: a 10-handicap receives one stroke on the ten
  // holes with stroke index 1 through 10.
  it("matches the USGA stroke allocation example for course handicap 10", () => {
    expect(strokesReceivedOnHole(10, 1)).toBe(1);
    expect(strokesReceivedOnHole(10, 10)).toBe(1);
    expect(strokesReceivedOnHole(10, 11)).toBe(0);
  });

  it("doubles up correctly for a course handicap above 18", () => {
    // CH 22: every hole gets 1 stroke, plus an extra on HSI 1-4.
    expect(strokesReceivedOnHole(22, 4)).toBe(2);
    expect(strokesReceivedOnHole(22, 5)).toBe(1);
    expect(strokesReceivedOnHole(22, 18)).toBe(1);
  });

  it("gives strokes back for plus handicaps starting at the easiest hole", () => {
    // Plus 3 (CH = -3): strokes given back on HSI 16, 17, 18.
    expect(strokesReceivedOnHole(-3, 18)).toBe(-1);
    expect(strokesReceivedOnHole(-3, 16)).toBe(-1);
    expect(strokesReceivedOnHole(-3, 15)).toBe(0);
    expect(strokesReceivedOnHole(-3, 1)).toBe(0);
  });
});

describe("adjustedGrossScore", () => {
  // USGA Rule 3.1 example: a scratch player who makes only triple bogeys on
  // every par-4 hole has each score capped at the net double bogey of 6.
  it("caps each hole at net double bogey", () => {
    const pars = Array.from({ length: 18 }, () => 4);
    const grossScores = Array.from({ length: 18 }, () => 7); // triple bogey
    const strokesReceivedPerHole = Array.from({ length: 18 }, () => 0); // scratch
    const ags = adjustedGrossScore({ grossScores, pars, strokesReceivedPerHole });
    expect(ags).toBe(18 * 6);
  });
});

describe("scoreDifferential", () => {
  // USGA Rule 5.1 worked example:
  //   AGS 85, Course Rating 71.2, Slope 131 → differential 11.9.
  it("matches the USGA worked example (AGS 85, CR 71.2, Slope 131)", () => {
    const diff = scoreDifferential({
      adjustedGrossScore: 85,
      courseRating: 71.2,
      slopeRating: 131,
    });
    expect(diff).toBe(11.9);
  });

  it("applies a positive PCC by lowering the differential", () => {
    const diff = scoreDifferential({
      adjustedGrossScore: 85,
      courseRating: 71.2,
      slopeRating: 131,
      pcc: 1,
    });
    expect(diff).toBe(11.0);
  });
});

describe("handicapIndex", () => {
  // USGA Rule 5.2a Table example (8 acceptable scores):
  //   lowest 2 of 8 are averaged with no adjustment.
  it("matches the USGA Rule 5.2a example for 8 rounds", () => {
    const differentials = [24.5, 22.7, 24.3, 23.4, 22.1, 25.5, 25.1, 21.9];
    expect(handicapIndex(differentials)).toBe(22.0);
  });

  it("applies the -2.0 adjustment when only 3 differentials exist", () => {
    expect(handicapIndex([12.0, 18.0, 20.0])).toBe(10.0);
  });

  it("returns null when fewer than 3 acceptable scores have been posted", () => {
    expect(handicapIndex([15.0, 16.0])).toBeNull();
  });
});

describe("courseHandicap", () => {
  // USGA Rule 6.1 worked example:
  //   HI 12.5 at slope 131 / rating 71.2 / par 72 → course handicap 14.
  it("matches the USGA Rule 6.1 worked example", () => {
    expect(
      courseHandicap({
        handicapIndex: 12.5,
        slopeRating: 131,
        courseRating: 71.2,
        par: 72,
      }),
    ).toBe(14);
  });

  it("rounds plus handicaps half-away-from-zero", () => {
    expect(
      courseHandicap({
        handicapIndex: -2.4,
        slopeRating: 113,
        courseRating: 72,
        par: 72,
      }),
    ).toBe(-2);
  });
});

describe("exceptionalScoreReduction", () => {
  // USGA Rule 5.9: -1.0 for a differential 7.0-9.9 below current index,
  // -2.0 for 10.0 or more below.
  it("applies -1 when the differential is 7.0 to 9.9 below the current index", () => {
    expect(exceptionalScoreReduction(5.0, 14.0)).toBe(-1);
    expect(exceptionalScoreReduction(7.5, 15.0)).toBe(-1);
  });

  it("applies -2 when the differential is 10 or more below the current index", () => {
    expect(exceptionalScoreReduction(3.0, 15.0)).toBe(-2);
  });

  it("returns 0 when the round is not exceptional", () => {
    expect(exceptionalScoreReduction(14.0, 15.0)).toBe(0);
  });
});
