import { netDoubleBogey } from "./netDoubleBogey";

export interface AdjustedGrossScoreInput {
  /** Gross strokes per hole. */
  grossScores: readonly number[];
  /** Par per hole, same length as grossScores. */
  pars: readonly number[];
  /** Handicap strokes received per hole (signed; may be negative for plus handicaps). */
  strokesReceivedPerHole: readonly number[];
}

/**
 * Adjusted Gross Score (AGS) caps each hole at the player's net double bogey
 * before summing, used for handicap differential calculation.
 *
 * Reference: WHS Rules of Handicapping, Rule 3.1 / Rule 5.1.
 *
 * @param input  Per-hole gross scores, pars, and strokes received.
 * @returns The total adjusted gross score across all supplied holes.
 */
export function adjustedGrossScore(input: AdjustedGrossScoreInput): number {
  const { grossScores, pars, strokesReceivedPerHole } = input;
  if (grossScores.length !== pars.length || grossScores.length !== strokesReceivedPerHole.length) {
    throw new Error("grossScores, pars, and strokesReceivedPerHole must all be the same length");
  }
  let total = 0;
  for (let i = 0; i < grossScores.length; i++) {
    const gross = grossScores[i] ?? 0;
    const par = pars[i] ?? 0;
    const strokes = strokesReceivedPerHole[i] ?? 0;
    const cap = netDoubleBogey(par, strokes);
    total += Math.min(gross, cap);
  }
  return total;
}
