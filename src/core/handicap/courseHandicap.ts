export interface CourseHandicapInput {
  /** Player's Handicap Index (may be negative for plus handicaps). */
  handicapIndex: number;
  /** Slope Rating of the tee played. */
  slopeRating: number;
  /** Course Rating of the tee played. */
  courseRating: number;
  /** Par of the tee played (typically 70-72). */
  par: number;
}

/**
 * Course Handicap is the number of strokes a player receives at a specific
 * set of tees, accounting for course difficulty.
 *
 *   courseHandicap = round(handicapIndex * (slopeRating / 113)
 *                          + (courseRating - par))
 *
 * The (courseRating - par) term was added in the 2024 WHS revision so that
 * players choosing different tees compete on a level basis.
 *
 * Reference: WHS Rules of Handicapping, Rule 6.1
 * (https://www.usga.org/handicapping/roh/2024-rules-of-handicapping.html).
 *
 * @param input  Handicap Index plus the tee's slope, rating, and par.
 * @returns Integer course handicap rounded half-away-from-zero.
 */
export function courseHandicap(input: CourseHandicapInput): number {
  const { handicapIndex, slopeRating, courseRating, par } = input;
  if (slopeRating <= 0) {
    throw new Error("slopeRating must be greater than 0");
  }
  const raw = handicapIndex * (slopeRating / 113) + (courseRating - par);
  // Round half away from zero, the convention used by the USGA.
  const sign = raw < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(raw));
}
