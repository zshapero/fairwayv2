/**
 * The 12 deterministic rules behind Fairway's recommendation engine. Each
 * rule is a pure function: given a chronologically ordered slice of the
 * player's rounds (oldest first, with hole scores joined to par / stroke
 * index), it returns either a populated `RuleOutput` or `null` when the
 * trigger condition isn't met.
 *
 * Every rule is explainable. The `detail` string spells out the math the
 * rule used, including the threshold the player crossed.
 */

import type { Rule, RoundWithHoleScores, RuleOutput } from "./types";

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function totalPuttsForRound(round: RoundWithHoleScores): number | null {
  const putts = round.holes.map((h) => h.putts).filter((p): p is number => p !== null);
  if (putts.length === 0) return null;
  return putts.reduce((s, n) => s + n, 0);
}

function recentRoundIds(rounds: readonly RoundWithHoleScores[], count: number): number[] {
  return rounds.slice(-count).map((r) => r.id);
}

// 1. putting_regression --------------------------------------------------
export const puttingRegression: Rule = (rounds) => {
  if (rounds.length < 15) return null;
  const recent = rounds.slice(-5).map(totalPuttsForRound).filter((v): v is number => v !== null);
  const previous = rounds
    .slice(-15, -5)
    .map(totalPuttsForRound)
    .filter((v): v is number => v !== null);
  if (recent.length < 5 || previous.length < 10) return null;

  const recentAvg = average(recent);
  const previousAvg = average(previous);
  const delta = recentAvg - previousAvg;
  if (delta < 1.5) return null;

  return {
    ruleId: "putting_regression",
    title: "Putting has slipped",
    summary: `Your last 5 rounds averaged ${delta.toFixed(1)} more putts than the 10 before them.`,
    detail: `Last 5 rounds: ${recentAvg.toFixed(1)} putts/round. Previous 10 rounds: ${previousAvg.toFixed(1)} putts/round. That's a jump of ${delta.toFixed(1)} putts per round, well over the 1.5 stroke threshold the rule watches for.`,
    drill: "Lag putts: set up 5 balls at 30 feet, try to leave each within 3 feet. 10 minutes before every round.",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(delta * 10) / 10,
    thresholdLabel: `+${delta.toFixed(1)} putts/round`,
  };
};

// 2/3. slice / pull tendency --------------------------------------------
function fairwayMissTendency(
  rounds: readonly RoundWithHoleScores[],
  side: "left" | "right",
): RuleOutput | null {
  if (rounds.length < 8) return null;
  const par4or5 = rounds
    .slice(-8)
    .flatMap((r) => r.holes.filter((h) => h.par >= 4));
  const misses = par4or5.filter((h) => h.fairway_miss_direction !== null);
  if (misses.length < 10) return null;

  const sideMisses = misses.filter((h) => h.fairway_miss_direction === side).length;
  const ratio = sideMisses / misses.length;
  if (ratio < 0.6) return null;

  if (side === "right") {
    return {
      ruleId: "slice_tendency",
      title: "Right-side miss pattern",
      summary: `${Math.round(ratio * 100)}% of your fairway misses are right.`,
      detail: `Of your last ${misses.length} missed fairways across the most recent 8 rounds, ${sideMisses} drifted right. Anything 60%+ to one side flags a swing-path or face-angle pattern; you're at ${(ratio * 100).toFixed(0)}%.`,
      drill: "Range session: place an alignment stick 6 inches outside your ball, parallel to target. Swing without hitting it. Trains an in-to-out path.",
      triggeringRoundIds: recentRoundIds(rounds, 8),
      thresholdValue: Math.round(ratio * 100) / 100,
      thresholdLabel: `${Math.round(ratio * 100)}% right`,
    };
  }
  return {
    ruleId: "pull_tendency",
    title: "Left-side miss pattern",
    summary: `${Math.round(ratio * 100)}% of your fairway misses are left.`,
    detail: `Of your last ${misses.length} missed fairways across the most recent 8 rounds, ${sideMisses} pulled left. Anything 60%+ to one side flags a swing-path or face-angle pattern; you're at ${(ratio * 100).toFixed(0)}%.`,
    drill: "On the range, focus on full body rotation through impact. Try a pause-at-top drill to slow your transition. Hit 30 balls focused on this.",
    triggeringRoundIds: recentRoundIds(rounds, 8),
    thresholdValue: Math.round(ratio * 100) / 100,
    thresholdLabel: `${Math.round(ratio * 100)}% left`,
  };
}

export const sliceTendency: Rule = (rounds) => fairwayMissTendency(rounds, "right");
export const pullTendency: Rule = (rounds) => fairwayMissTendency(rounds, "left");

// 4. approach_miss_pattern ----------------------------------------------
const APPROACH_DRILLS: Record<"left" | "right" | "short" | "long", string> = {
  short: "Club up one and swing 80%. The flag is rarely worth a full effort with the wrong club.",
  long: "Stop trying to flush every iron. Take an extra club, swing 75%. Distance comes from solid contact, not speed.",
  left: "Alignment stick drill on full swings. Place one along your toe line and another at the target. Confirm both before every shot.",
  right: "Alignment stick drill on full swings. Place one along your toe line and another at the target. Confirm both before every shot.",
};

export const approachMissPattern: Rule = (rounds) => {
  if (rounds.length < 8) return null;
  const recent = rounds.slice(-8);
  const allMisses = recent.flatMap((r) =>
    r.holes
      .map((h) => h.gir_miss_direction)
      .filter((d): d is "left" | "right" | "short" | "long" => d !== null),
  );
  if (allMisses.length < 12) return null;

  const counts: Record<"left" | "right" | "short" | "long", number> = {
    left: 0,
    right: 0,
    short: 0,
    long: 0,
  };
  for (const dir of allMisses) counts[dir] += 1;

  const total = allMisses.length;
  let dominant: "left" | "right" | "short" | "long" | null = null;
  let dominantCount = 0;
  for (const dir of ["short", "left", "right", "long"] as const) {
    const count = counts[dir];
    if (count > dominantCount) {
      dominant = dir;
      dominantCount = count;
    }
  }
  if (!dominant) return null;
  const ratio = dominantCount / total;
  if (ratio <= 0.5) return null;

  const titleByDir: Record<"left" | "right" | "short" | "long", string> = {
    short: "Approaches missing short",
    long: "Approaches sailing long",
    left: "Approaches drifting left",
    right: "Approaches drifting right",
  };

  return {
    ruleId: "approach_miss_pattern",
    title: titleByDir[dominant],
    summary: `${Math.round(ratio * 100)}% of your green misses go ${dominant}.`,
    detail: `Across your last ${recent.length} rounds, ${dominantCount} of ${total} green-in-regulation misses went ${dominant}. The rule fires when any single direction tops 50%.`,
    drill: APPROACH_DRILLS[dominant],
    triggeringRoundIds: recentRoundIds(rounds, 8),
    thresholdValue: Math.round(ratio * 100) / 100,
    thresholdLabel: `${Math.round(ratio * 100)}% ${dominant}`,
  };
};

// 5. sand_frequency -----------------------------------------------------
export const sandFrequency: Rule = (rounds) => {
  if (rounds.length < 8) return null;
  const recent = rounds.slice(-8);
  const allHoles = recent.flatMap((r) => r.holes);
  if (allHoles.length === 0) return null;
  const sand = allHoles.filter((h) => h.hit_from_sand === 1).length;
  const ratio = sand / allHoles.length;
  if (ratio < 0.25) return null;

  return {
    ruleId: "sand_frequency",
    title: "Spending too much time in bunkers",
    summary: `You hit from sand on ${Math.round(ratio * 100)}% of holes recently.`,
    detail: `Across the last ${recent.length} rounds (${allHoles.length} holes), ${sand} included a shot from sand — ${(ratio * 100).toFixed(0)}%. Anything 25%+ tells us bunkers are a recurring strokes-lost story.`,
    drill: "10 minutes of bunker work twice a week. Practice greenside (high lofted, splash sand under ball) and fairway bunker (clean contact, less wrist) shots.",
    triggeringRoundIds: recentRoundIds(rounds, 8),
    thresholdValue: Math.round(ratio * 100) / 100,
    thresholdLabel: `${Math.round(ratio * 100)}% of holes`,
  };
};

// 6. front_nine_deficit -------------------------------------------------
export const frontNineDeficit: Rule = (rounds) => {
  if (rounds.length < 10) return null;
  const recent = rounds.slice(-10);
  const fronts: number[] = [];
  const backs: number[] = [];
  for (const r of recent) {
    let front = 0;
    let back = 0;
    let frontCount = 0;
    let backCount = 0;
    for (const h of r.holes) {
      if (h.hole_number <= 9) {
        front += h.gross_score;
        frontCount += 1;
      } else if (h.hole_number <= 18) {
        back += h.gross_score;
        backCount += 1;
      }
    }
    if (frontCount === 9 && backCount === 9) {
      fronts.push(front);
      backs.push(back);
    }
  }
  if (fronts.length < 8) return null;
  const frontAvg = average(fronts);
  const backAvg = average(backs);
  const delta = frontAvg - backAvg;
  if (delta < 3) return null;

  return {
    ruleId: "front_nine_deficit",
    title: "Slow starts costing you strokes",
    summary: `Your front nine averages ${delta.toFixed(1)} strokes worse than your back nine.`,
    detail: `Across the last ${fronts.length} 18-hole rounds, your front nine has averaged ${frontAvg.toFixed(1)} vs ${backAvg.toFixed(1)} on the back. A 3+ stroke gap is the threshold.`,
    drill: "Arrive 30 minutes earlier. Do 20 full swings, 10 chips, 5 minutes of putting before teeing off. Treat the warmup as part of the round.",
    triggeringRoundIds: recentRoundIds(rounds, 10),
    thresholdValue: Math.round(delta * 10) / 10,
    thresholdLabel: `+${delta.toFixed(1)} on the front`,
  };
};

// 7. three_putt_frequency -----------------------------------------------
export const threePuttFrequency: Rule = (rounds) => {
  if (rounds.length < 5) return null;
  const recent = rounds.slice(-5).filter((r) => r.holes.some((h) => h.putts !== null));
  if (recent.length < 5) return null;

  let total = 0;
  for (const r of recent) {
    for (const h of r.holes) {
      if ((h.putts ?? 0) >= 3) total += 1;
    }
  }
  const perRound = total / recent.length;
  if (perRound < 3) return null;

  return {
    ruleId: "three_putt_frequency",
    title: "Three-putts adding up",
    summary: `You're averaging ${perRound.toFixed(1)} three-putts per round.`,
    detail: `Across your last ${recent.length} rounds you've had ${total} holes with three or more putts — ${perRound.toFixed(1)} per round. The rule fires at 3 per round on average.`,
    drill: "Distance control: 15 minutes of 30-50 foot lag putts. Goal is to leave every one inside 3 feet. The first putt is the only putt that matters.",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(perRound * 10) / 10,
    thresholdLabel: `${perRound.toFixed(1)} three-putts/round`,
  };
};

// 8. penalty_trouble ----------------------------------------------------
export const penaltyTrouble: Rule = (rounds) => {
  if (rounds.length < 5) return null;
  const recent = rounds.slice(-5);
  let total = 0;
  for (const r of recent) {
    for (const h of r.holes) total += h.penalty_strokes ?? 0;
  }
  const perRound = total / recent.length;
  if (perRound < 2) return null;

  return {
    ruleId: "penalty_trouble",
    title: "Penalty strokes hurting your score",
    summary: `You're averaging ${perRound.toFixed(1)} penalty strokes per round.`,
    detail: `Across your last ${recent.length} rounds you've taken ${total} penalty strokes — ${perRound.toFixed(1)} per round, over the 2-per-round threshold. Lost balls and water carries are the most expensive shots in golf.`,
    drill: "Course management. Identify your three trouble holes. Plan conservative tee shots: club down, aim away from water/OB, take bogey out of contention.",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(perRound * 10) / 10,
    thresholdLabel: `${perRound.toFixed(1)} penalties/round`,
  };
};

// 9. par_three_weakness -------------------------------------------------
export const parThreeWeakness: Rule = (rounds) => {
  if (rounds.length < 5) return null;
  const par3Holes = rounds.slice(-5).flatMap((r) => r.holes.filter((h) => h.par === 3));
  if (par3Holes.length < 10) return null;
  const overPar = par3Holes.map((h) => h.gross_score - h.par);
  const avgOver = average(overPar);
  if (avgOver < 1.5) return null;

  return {
    ruleId: "par_three_weakness",
    title: "Par 3 scoring needs work",
    summary: `Par 3s are averaging ${avgOver.toFixed(1)} over par.`,
    detail: `Across your last 5 rounds you played ${par3Holes.length} par 3 holes and averaged ${avgOver.toFixed(1)} strokes over par on them. The rule fires at 1.5 over.`,
    drill: "Range session with 6-9 irons. Pick four targets at different yardages. Hit 10 balls at each. Track how many land within 20 feet.",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(avgOver * 10) / 10,
    thresholdLabel: `+${avgOver.toFixed(1)} on par 3s`,
  };
};

// 10. hardest_holes_problem ---------------------------------------------
export const hardestHolesProblem: Rule = (rounds) => {
  if (rounds.length < 5) return null;
  const hardHoles = rounds
    .slice(-5)
    .flatMap((r) => r.holes.filter((h) => h.stroke_index >= 1 && h.stroke_index <= 6));
  if (hardHoles.length < 10) return null;
  const overPar = average(hardHoles.map((h) => h.gross_score - h.par));
  if (overPar < 2) return null;

  return {
    ruleId: "hardest_holes_problem",
    title: "Hardest holes are eating your scorecard",
    summary: `Stroke-index 1-6 holes are averaging ${overPar.toFixed(1)} over par.`,
    detail: `Across your last 5 rounds, the six hardest holes (stroke index 1-6) are averaging ${overPar.toFixed(1)} strokes over par. The rule fires at bogey + 1 (par + 2) or worse.`,
    drill: "Mindset shift: on stroke index 1-6 holes, play for bogey, not par. Tee off conservative, layup if needed, accept the bogey. Big numbers come from trying to be the hero.",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(overPar * 10) / 10,
    thresholdLabel: `+${overPar.toFixed(1)} on hardest holes`,
  };
};

// 11. scrambling_deficit ------------------------------------------------
export const scramblingDeficit: Rule = (rounds) => {
  if (rounds.length < 5) return null;
  const recent = rounds.slice(-5);
  const scrambleHoles = recent.flatMap((r) =>
    r.holes.filter((h) => h.green_in_regulation === 0),
  );
  if (scrambleHoles.length < 10) return null;
  const saved = scrambleHoles.filter((h) => h.gross_score <= h.par).length;
  const rate = saved / scrambleHoles.length;
  if (rate >= 0.25) return null;

  return {
    ruleId: "scrambling_deficit",
    title: "Short game opportunity",
    summary: `You're saving par from off the green only ${Math.round(rate * 100)}% of the time.`,
    detail: `Across your last 5 rounds you missed the green ${scrambleHoles.length} times and made par or better on ${saved}. That's a ${(rate * 100).toFixed(0)}% scrambling rate; the rule flags anything under 25%.`,
    drill: "30 minutes of short game twice a week. 10 chips from 10 yards, 10 pitches from 30 yards, 10 bunker shots, 10 minutes of 5-foot putts. The fastest stroke savings on tour come from here.",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(rate * 100) / 100,
    thresholdLabel: `${Math.round(rate * 100)}% scrambling`,
  };
};

// 12. recent_decline ----------------------------------------------------
export const recentDecline: Rule = (rounds) => {
  if (rounds.length < 15) return null;
  const recent = rounds
    .slice(-5)
    .map((r) => r.differential)
    .filter((d): d is number => typeof d === "number");
  const previous = rounds
    .slice(-15, -5)
    .map((r) => r.differential)
    .filter((d): d is number => typeof d === "number");
  if (recent.length < 5 || previous.length < 10) return null;
  const recentAvg = average(recent);
  const previousAvg = average(previous);
  const delta = recentAvg - previousAvg;
  if (delta < 1.5) return null;

  return {
    ruleId: "recent_decline",
    title: "Scoring trending the wrong way",
    summary: `Your last 5 differentials average ${delta.toFixed(1)} higher than the 10 before.`,
    detail: `Recent 5 differentials average ${recentAvg.toFixed(1)}. The 10 before that averaged ${previousAvg.toFixed(1)}. That ${delta.toFixed(1)}-stroke jump trips the 1.5 threshold.`,
    drill: "Time for a check-in. Visit a teaching pro for a 30-minute lesson focused on grip, alignment, posture, and ball position. Sometimes the basics drift.",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(delta * 10) / 10,
    thresholdLabel: `+${delta.toFixed(1)} avg differential`,
  };
};

export const ALL_RULES: ReadonlyArray<{ id: string; rule: Rule }> = [
  { id: "putting_regression", rule: puttingRegression },
  { id: "slice_tendency", rule: sliceTendency },
  { id: "pull_tendency", rule: pullTendency },
  { id: "approach_miss_pattern", rule: approachMissPattern },
  { id: "sand_frequency", rule: sandFrequency },
  { id: "front_nine_deficit", rule: frontNineDeficit },
  { id: "three_putt_frequency", rule: threePuttFrequency },
  { id: "penalty_trouble", rule: penaltyTrouble },
  { id: "par_three_weakness", rule: parThreeWeakness },
  { id: "hardest_holes_problem", rule: hardestHolesProblem },
  { id: "scrambling_deficit", rule: scramblingDeficit },
  { id: "recent_decline", rule: recentDecline },
];
