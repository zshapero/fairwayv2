/**
 * The 16 deterministic rules behind Fairway's recommendation engine.
 *
 * 12 "opportunity" rules surface things to work on (slicing, three-putts,
 * scrambling). 4 motivational rules surface "strengths" and "milestones"
 * (improving putting, dropping handicap, personal best). Every rule is a
 * pure function of `RuleContext` → `RuleOutput | null`. The voice is
 * observational and conversational — like a smart friend reading the
 * scorecard, not a database.
 */

import { computeConfidence } from "./confidence";
import { computePriority } from "./priority";
import {
  selectDrillVariant,
  type DrillVariant,
  type RoundWithHoleScores,
  type Rule,
  type RuleContext,
  type RuleOutput,
  type Severity,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function totalPuttsForRound(round: RoundWithHoleScores): number | null {
  const putts = round.holes.map((h) => h.putts).filter((p): p is number => p !== null);
  if (putts.length === 0) return null;
  return putts.reduce((s, n) => s + n, 0);
}

function recentRoundIds(rounds: readonly RoundWithHoleScores[], count: number): number[] {
  return rounds.slice(-count).map((r) => r.id);
}

function chronicityWeeks(rounds: readonly RoundWithHoleScores[]): number {
  if (rounds.length < 2) return 0;
  const first = new Date(rounds[0]!.played_at).getTime();
  const last = new Date(rounds[rounds.length - 1]!.played_at).getTime();
  return Math.max(0, (last - first) / (7 * 24 * 60 * 60 * 1000));
}

function severityFor(ratio: number): Severity {
  if (ratio >= 0.6) return "severe";
  if (ratio >= 0.3) return "moderate";
  return "mild";
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ---------------------------------------------------------------------------
// Drill variants per rule
// ---------------------------------------------------------------------------

const PUTTING_REGRESSION_DRILLS: DrillVariant[] = [
  {
    id: "putting_regression_basic",
    level: "beginner",
    drill:
      "Five balls from 30 feet, ten minutes before each round. Goal: every one finishes inside 3 feet.",
  },
  {
    id: "putting_regression_intermediate",
    level: "mid",
    drill:
      "Three balls each at 30, 40, 50 feet. Aim for 80% inside 6 feet. Track it across a few sessions.",
  },
  {
    id: "putting_regression_advanced",
    level: "advanced",
    drill:
      "Speed work first: three balls at 30, 40, 50 feet. Then 10 must-make 6-footers in a row before you walk off.",
  },
];

const FAIRWAY_RIGHT_DRILLS: DrillVariant[] = [
  {
    id: "slice_alignment_basic",
    severity: "mild",
    drill:
      "Range drill: alignment stick six inches outside the ball, parallel to the target line. Don't hit it. That trains an in-to-out path.",
  },
  {
    id: "slice_alignment_grip",
    severity: "moderate",
    drill:
      "Strengthen the grip a touch (rotate hands clockwise). Hit 30 balls with the alignment stick out there. No slice contact.",
  },
  {
    id: "slice_lesson",
    severity: "severe",
    drill:
      "This one's worth a 30-minute lesson on grip and path. Until then, three-quarter swings, draw shape only.",
  },
];

const FAIRWAY_LEFT_DRILLS: DrillVariant[] = [
  {
    id: "pull_rotation_basic",
    severity: "mild",
    drill:
      "Pause-at-top drill on the range, 30 balls. Slow the transition, full rotation through the ball.",
  },
  {
    id: "pull_rotation_extended",
    severity: "moderate",
    drill:
      "Pause-at-top plus an alignment stick along your toes. Aim a club length right of target and trust it.",
  },
  {
    id: "pull_lesson",
    severity: "severe",
    drill:
      "Consistent pulling usually means the upper body's racing the lower. Worth a lesson on takeaway and shoulder turn.",
  },
];

const APPROACH_DRILLS: Record<"left" | "right" | "short" | "long", DrillVariant[]> = {
  short: [
    {
      id: "approach_short_basic",
      drill: "Take one more club. Swing 80%. The flag is rarely worth a full effort.",
    },
    {
      id: "approach_short_advanced",
      level: "advanced",
      drill:
        "Track real carry distances per club this week, not the marketing yardage. Add a club to anything inside that number.",
    },
  ],
  long: [
    {
      id: "approach_long_basic",
      drill:
        "Stop trying to flush every iron. One more club, swing 75%. Distance comes from contact, not speed.",
    },
    {
      id: "approach_long_advanced",
      level: "advanced",
      drill:
        "Twenty balls each with 6, 7, 8 iron at three-quarter speed. Note the carry. Use that on course.",
    },
  ],
  left: [
    {
      id: "approach_left_basic",
      drill:
        "Two alignment sticks: one at your toes, one at the target. Set them before every shot for a few range sessions.",
    },
  ],
  right: [
    {
      id: "approach_right_basic",
      drill:
        "Two alignment sticks: one at your toes, one at the target. Set them before every shot for a few range sessions.",
    },
  ],
};

const SAND_DRILLS: DrillVariant[] = [
  {
    id: "sand_basic",
    severity: "mild",
    drill:
      "Ten minutes of bunker work, twice a week. Greenside splash and a few clean fairway-bunker shots.",
  },
  {
    id: "sand_focus",
    severity: "moderate",
    drill:
      "Twenty minutes of greenside bunker, twice a week. Draw a line in the sand and hit it every time. Then 10 fairway-bunker shots with a 7-iron.",
  },
  {
    id: "sand_lesson",
    severity: "severe",
    drill:
      "If you're in sand on a quarter of holes, it's probably the tee shot. Worth a lesson on driver dispersion. Bunker reps alone won't fix the cause.",
  },
];

const FRONT_NINE_DRILLS: DrillVariant[] = [
  {
    id: "front_nine_warmup",
    drill:
      "Show up 30 minutes early. Twenty full swings, ten chips, five minutes of putting. Treat the warmup like part of the round.",
  },
  {
    id: "front_nine_advanced",
    level: "advanced",
    drill:
      "Build a launch routine: five wedges, five mid-irons, five drivers, every one to a target. The first tee shot should be the 16th swing of the day.",
  },
];

const THREE_PUTT_DRILLS: DrillVariant[] = [
  {
    id: "three_putt_basic",
    drill:
      "Fifteen minutes of 30-50 foot lag putts. Goal: every one finishes inside 3 feet. The first putt is the only one that matters.",
  },
  {
    id: "three_putt_advanced",
    level: "advanced",
    drill:
      "Five balls each at 30, 45, 60 feet. Track how many finish in a 3-foot circle. Aim for 80%. Then 10 must-make 4-footers to finish.",
  },
];

const PENALTY_DRILLS: DrillVariant[] = [
  {
    id: "penalty_management",
    drill:
      "Pick your three trouble holes. Plan a conservative tee shot for each: club down, aim away from the trouble, take bogey out of contention.",
  },
  {
    id: "penalty_advanced",
    level: "advanced",
    severity: "severe",
    drill:
      "Walk the trouble holes on the satellite map the night before. Map a bail-out for each. Commit to that line before stepping on the tee.",
  },
];

const PAR3_DRILLS: DrillVariant[] = [
  {
    id: "par3_range",
    drill:
      "Pick four targets at par-3 yardages on the range. Ten balls each. Track how many land inside 20 feet.",
  },
  {
    id: "par3_advanced",
    level: "advanced",
    drill:
      "Five shots at every yardage from 130-180 in 10-yard increments. Count how many find the green. Aim for 60%.",
  },
];

const HARDEST_HOLE_DRILLS: DrillVariant[] = [
  {
    id: "hardest_mindset",
    drill:
      "On stroke index 1-6 holes, play for bogey. Conservative tee, lay up if you need to, take double out of play. Big numbers come from chasing par here.",
  },
  {
    id: "hardest_advanced",
    level: "advanced",
    drill:
      "Pre-round, write a number for each stroke-index 1-6 hole (par, bogey, double). Hitting that number is the goal. Stop trying to be the hero.",
  },
];

const SCRAMBLING_DRILLS: DrillVariant[] = [
  {
    id: "scrambling_basic",
    drill:
      "Thirty minutes of short game, twice a week. 10 chips from 10 yards, 10 pitches from 30 yards, 10 bunker shots, 10 minutes of 5-foot putts.",
  },
  {
    id: "scrambling_advanced",
    level: "advanced",
    drill:
      "Up-and-down game: drop 10 balls in random spots within 30 yards of a green. Count the up-and-downs. Repeat until 6/10 is normal.",
  },
];

const RECENT_DECLINE_DRILLS: DrillVariant[] = [
  {
    id: "decline_lesson",
    drill:
      "Time for a check-in. Thirty-minute lesson on the basics: grip, alignment, posture, ball position. Sometimes those drift.",
  },
];

// ---------------------------------------------------------------------------
// 1. putting_regression
// ---------------------------------------------------------------------------

export const puttingRegression: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
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

  const distance = delta - 1.5;
  const confidence = computeConfidence(rounds.length, distance, 0.8);
  const severityRatio = Math.min(1, distance / 1.5);
  const severity = severityFor(severityRatio);
  const priority = computePriority(2.5, severityRatio, chronicityWeeks(rounds.slice(-5)));
  const variant = selectDrillVariant(PUTTING_REGRESSION_DRILLS, ctx.level, severity);

  return {
    ruleId: "putting_regression",
    type: "opportunity",
    title: "Putts have crept up",
    summary: `You're averaging ${recentAvg.toFixed(1)} putts per round lately, up from ${previousAvg.toFixed(1)} before. That's about ${delta.toFixed(1)} extra strokes a round on the green.`,
    detail: `Your last 5 rounds: ${recentAvg.toFixed(1)} putts per round. The 10 before that: ${previousAvg.toFixed(1)}. A ${delta.toFixed(1)}-stroke jump trips this rule, and the typical for your bracket is ${benchmarks.putts.toFixed(0)}.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(delta * 10) / 10,
    thresholdLabel: `+${delta.toFixed(1)} putts/round`,
    priority,
    confidence,
    playerValue: recentAvg,
    playerValueLabel: `${recentAvg.toFixed(1)} putts/round`,
    benchmarkValue: benchmarks.putts,
    benchmarkLabel: `${benchmarks.putts.toFixed(0)} typical`,
  };
};

// ---------------------------------------------------------------------------
// 2/3. slice_tendency / pull_tendency
// ---------------------------------------------------------------------------

function fairwayMissTendency(ctx: RuleContext, side: "left" | "right"): RuleOutput | null {
  const { rounds, benchmarks } = ctx;
  if (rounds.length < 8) return null;
  const par4or5 = rounds.slice(-8).flatMap((r) => r.holes.filter((h) => h.par >= 4));
  const misses = par4or5.filter((h) => h.fairway_miss_direction !== null);
  if (misses.length < 10) return null;

  const sideMisses = misses.filter((h) => h.fairway_miss_direction === side).length;
  const ratio = sideMisses / misses.length;
  if (ratio < 0.6) return null;

  const distance = ratio - 0.6;
  const confidence = computeConfidence(misses.length, distance, 0.08);
  const severityRatio = Math.min(1, distance / 0.3);
  const severity = severityFor(severityRatio);
  const priority = computePriority(1.5, severityRatio, chronicityWeeks(rounds.slice(-8)));

  const variants = side === "right" ? FAIRWAY_RIGHT_DRILLS : FAIRWAY_LEFT_DRILLS;
  const variant = selectDrillVariant(variants, ctx.level, severity);

  if (side === "right") {
    return {
      ruleId: "slice_tendency",
      type: "opportunity",
      title: "Missing right off the tee",
      summary: `About ${pct(ratio)} of your missed fairways have gone right over your last 8 rounds.`,
      detail: `Of ${misses.length} missed fairways recently, ${sideMisses} drifted right. Anything 60%+ to one side usually points at a swing-path or face-angle pattern. Players in your bracket land fairways at ${pct(benchmarks.fairways)} for context.`,
      drill: variant.drill,
      selectedDrillVariantId: variant.id,
      triggeringRoundIds: recentRoundIds(rounds, 8),
      thresholdValue: Math.round(ratio * 100) / 100,
      thresholdLabel: `${pct(ratio)} right`,
      priority,
      confidence,
      playerValue: ratio,
      playerValueLabel: `${pct(ratio)} right`,
      benchmarkValue: 0.5,
      benchmarkLabel: "50/50 typical",
    };
  }
  return {
    ruleId: "pull_tendency",
    type: "opportunity",
    title: "Missing left off the tee",
    summary: `About ${pct(ratio)} of your missed fairways have gone left over your last 8 rounds.`,
    detail: `Of ${misses.length} missed fairways recently, ${sideMisses} pulled left. Anything 60%+ to one side usually points at a swing-path or face-angle pattern. Players in your bracket land fairways at ${pct(benchmarks.fairways)} for context.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 8),
    thresholdValue: Math.round(ratio * 100) / 100,
    thresholdLabel: `${pct(ratio)} left`,
    priority,
    confidence,
    playerValue: ratio,
    playerValueLabel: `${pct(ratio)} left`,
    benchmarkValue: 0.5,
    benchmarkLabel: "50/50 typical",
  };
}

export const sliceTendency: Rule = (ctx) => fairwayMissTendency(ctx, "right");
export const pullTendency: Rule = (ctx) => fairwayMissTendency(ctx, "left");

// ---------------------------------------------------------------------------
// 4. approach_miss_pattern
// ---------------------------------------------------------------------------

export const approachMissPattern: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
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
    if (counts[dir] > dominantCount) {
      dominant = dir;
      dominantCount = counts[dir];
    }
  }
  if (!dominant) return null;
  const ratio = dominantCount / total;
  if (ratio <= 0.5) return null;

  const distance = ratio - 0.5;
  const confidence = computeConfidence(allMisses.length, distance, 0.08);
  const severityRatio = Math.min(1, distance / 0.3);
  const severity = severityFor(severityRatio);
  const priority = computePriority(1.8, severityRatio, chronicityWeeks(rounds.slice(-8)));

  const variants = APPROACH_DRILLS[dominant];
  const variant = selectDrillVariant(variants, ctx.level, severity);

  const titleByDir: Record<"left" | "right" | "short" | "long", string> = {
    short: "Coming up short on approaches",
    long: "Sailing long on approaches",
    left: "Approaches drifting left",
    right: "Approaches drifting right",
  };
  const directionWord: Record<"left" | "right" | "short" | "long", string> = {
    short: "short",
    long: "long",
    left: "left",
    right: "right",
  };

  return {
    ruleId: "approach_miss_pattern",
    type: "opportunity",
    title: titleByDir[dominant],
    summary: `When you miss the green, ${pct(ratio)} of those misses go ${directionWord[dominant]}.`,
    detail: `Across your last ${recent.length} rounds you missed the green ${total} times. ${dominantCount} of those (${pct(ratio)}) went ${directionWord[dominant]}. Players in your bracket hit ${pct(benchmarks.gir)} of greens, so chasing this pattern is high-leverage.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 8),
    thresholdValue: Math.round(ratio * 100) / 100,
    thresholdLabel: `${pct(ratio)} ${directionWord[dominant]}`,
    priority,
    confidence,
    playerValue: ratio,
    playerValueLabel: `${pct(ratio)} ${directionWord[dominant]}`,
    benchmarkValue: benchmarks.gir,
    benchmarkLabel: `${pct(benchmarks.gir)} GIR typical`,
  };
};

// ---------------------------------------------------------------------------
// 5. sand_frequency
// ---------------------------------------------------------------------------

export const sandFrequency: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
  if (rounds.length < 8) return null;
  const recent = rounds.slice(-8);
  const allHoles = recent.flatMap((r) => r.holes);
  if (allHoles.length === 0) return null;
  const sand = allHoles.filter((h) => h.hit_from_sand === 1).length;
  const ratio = sand / allHoles.length;
  if (ratio < 0.25) return null;

  const distance = ratio - 0.25;
  const confidence = computeConfidence(allHoles.length, distance, 0.05);
  const severityRatio = Math.min(1, distance / 0.2);
  const severity = severityFor(severityRatio);
  const priority = computePriority(2.0, severityRatio, chronicityWeeks(rounds.slice(-8)));
  const variant = selectDrillVariant(SAND_DRILLS, ctx.level, severity);

  return {
    ruleId: "sand_frequency",
    type: "opportunity",
    title: "Spending a lot of time in bunkers",
    summary: `You played out of sand on ${pct(ratio)} of holes lately. Until that drops, every save matters more.`,
    detail: `Across the last 8 rounds (${allHoles.length} holes), ${sand} touched sand, or ${pct(ratio)}. The rule fires at 25%+. Players in your bracket save par at ${pct(benchmarks.scrambling)} when they miss, so the upside is real.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 8),
    thresholdValue: Math.round(ratio * 100) / 100,
    thresholdLabel: `${pct(ratio)} of holes`,
    priority,
    confidence,
    playerValue: ratio,
    playerValueLabel: `${pct(ratio)} of holes`,
    benchmarkValue: benchmarks.scrambling,
    benchmarkLabel: `${pct(benchmarks.scrambling)} scrambling typical`,
  };
};

// ---------------------------------------------------------------------------
// 6. front_nine_deficit
// ---------------------------------------------------------------------------

export const frontNineDeficit: Rule = (ctx) => {
  const { rounds } = ctx;
  if (rounds.length < 10) return null;
  const recent = rounds.slice(-10);
  const fronts: number[] = [];
  const backs: number[] = [];
  for (const r of recent) {
    let front = 0, back = 0, frontCount = 0, backCount = 0;
    for (const h of r.holes) {
      if (h.hole_number <= 9) {
        front += h.gross_score; frontCount += 1;
      } else if (h.hole_number <= 18) {
        back += h.gross_score; backCount += 1;
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

  const distance = delta - 3;
  const confidence = computeConfidence(fronts.length, distance, 1.5);
  const severityRatio = Math.min(1, distance / 3);
  const severity = severityFor(severityRatio);
  const priority = computePriority(2.5, severityRatio, chronicityWeeks(rounds.slice(-10)));
  const variant = selectDrillVariant(FRONT_NINE_DRILLS, ctx.level, severity);

  return {
    ruleId: "front_nine_deficit",
    type: "opportunity",
    title: "Slow starts",
    summary: `Your front 9 has been averaging ${delta.toFixed(1)} strokes worse than your back 9. Looks like a warmup issue.`,
    detail: `Across ${fronts.length} 18-hole rounds: front 9 ${frontAvg.toFixed(1)}, back 9 ${backAvg.toFixed(1)}. The rule fires at a 3+ stroke gap. A typical "warmed up" gap is under 1.5.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 10),
    thresholdValue: Math.round(delta * 10) / 10,
    thresholdLabel: `+${delta.toFixed(1)} on the front`,
    priority,
    confidence,
    playerValue: delta,
    playerValueLabel: `+${delta.toFixed(1)} on front`,
    benchmarkValue: 1.5,
    benchmarkLabel: "≤1.5 typical",
  };
};

// ---------------------------------------------------------------------------
// 7. three_putt_frequency
// ---------------------------------------------------------------------------

export const threePuttFrequency: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
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

  const distance = perRound - 3;
  const confidence = computeConfidence(recent.length, distance, 0.8);
  const severityRatio = Math.min(1, distance / 2);
  const severity = severityFor(severityRatio);
  const priority = computePriority(3, severityRatio, chronicityWeeks(rounds.slice(-5)));
  const variant = selectDrillVariant(THREE_PUTT_DRILLS, ctx.level, severity);

  return {
    ruleId: "three_putt_frequency",
    type: "opportunity",
    title: "Three-putts are adding up",
    summary: `You're averaging ${perRound.toFixed(1)} three-putts a round. Bracket benchmark is ${benchmarks.threePutts.toFixed(1)}.`,
    detail: `Last ${recent.length} rounds: ${total} holes with three or more putts, or ${perRound.toFixed(1)} a round. The rule fires at 3 a round. The fastest fix is the lag putt: distance control matters way more than line on long ones.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(perRound * 10) / 10,
    thresholdLabel: `${perRound.toFixed(1)} three-putts/round`,
    priority,
    confidence,
    playerValue: perRound,
    playerValueLabel: `${perRound.toFixed(1)}/round`,
    benchmarkValue: benchmarks.threePutts,
    benchmarkLabel: `${benchmarks.threePutts.toFixed(1)}/round typical`,
  };
};

// ---------------------------------------------------------------------------
// 8. penalty_trouble
// ---------------------------------------------------------------------------

export const penaltyTrouble: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
  if (rounds.length < 5) return null;
  const recent = rounds.slice(-5);
  let total = 0;
  for (const r of recent) {
    for (const h of r.holes) total += h.penalty_strokes ?? 0;
  }
  const perRound = total / recent.length;
  if (perRound < 2) return null;

  const distance = perRound - 2;
  const confidence = computeConfidence(recent.length, distance, 0.6);
  const severityRatio = Math.min(1, distance / 2);
  const severity = severityFor(severityRatio);
  const priority = computePriority(3.5, severityRatio, chronicityWeeks(rounds.slice(-5)));
  const variant = selectDrillVariant(PENALTY_DRILLS, ctx.level, severity);

  return {
    ruleId: "penalty_trouble",
    type: "opportunity",
    title: "Trouble with penalty strokes",
    summary: `About ${perRound.toFixed(1)} penalties a round, on average. Most of those usually come from a few specific holes.`,
    detail: `Last ${recent.length} rounds: ${total} penalty strokes total, ${perRound.toFixed(1)} a round. Players in your bracket take ${benchmarks.penalties.toFixed(1)}. Lost balls and water carries are the most expensive shots in golf.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(perRound * 10) / 10,
    thresholdLabel: `${perRound.toFixed(1)} penalties/round`,
    priority,
    confidence,
    playerValue: perRound,
    playerValueLabel: `${perRound.toFixed(1)}/round`,
    benchmarkValue: benchmarks.penalties,
    benchmarkLabel: `${benchmarks.penalties.toFixed(1)}/round typical`,
  };
};

// ---------------------------------------------------------------------------
// 9. par_three_weakness
// ---------------------------------------------------------------------------

export const parThreeWeakness: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
  if (rounds.length < 5) return null;
  const par3Holes = rounds.slice(-5).flatMap((r) => r.holes.filter((h) => h.par === 3));
  if (par3Holes.length < 10) return null;
  const overPar = par3Holes.map((h) => h.gross_score - h.par);
  const avgOver = average(overPar);
  if (avgOver < 1.5) return null;

  const distance = avgOver - 1.5;
  const confidence = computeConfidence(par3Holes.length, distance, 0.4);
  const severityRatio = Math.min(1, distance / 1);
  const severity = severityFor(severityRatio);
  const priority = computePriority(2, severityRatio, chronicityWeeks(rounds.slice(-5)));
  const variant = selectDrillVariant(PAR3_DRILLS, ctx.level, severity);

  return {
    ruleId: "par_three_weakness",
    type: "opportunity",
    title: "Par 3s have been costly",
    summary: `Par 3s are averaging +${avgOver.toFixed(1)} over par lately. Bracket is +${benchmarks.par3Over.toFixed(1)}.`,
    detail: `Last 5 rounds: ${par3Holes.length} par 3 holes, averaging +${avgOver.toFixed(1)}. The rule fires at +1.5. With short irons doing the work, this one's mostly about reps to specific yardages.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(avgOver * 10) / 10,
    thresholdLabel: `+${avgOver.toFixed(1)} on par 3s`,
    priority,
    confidence,
    playerValue: avgOver,
    playerValueLabel: `+${avgOver.toFixed(1)} avg`,
    benchmarkValue: benchmarks.par3Over,
    benchmarkLabel: `+${benchmarks.par3Over.toFixed(1)} typical`,
  };
};

// ---------------------------------------------------------------------------
// 10. hardest_holes_problem
// ---------------------------------------------------------------------------

export const hardestHolesProblem: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
  if (rounds.length < 5) return null;
  const hardHoles = rounds
    .slice(-5)
    .flatMap((r) => r.holes.filter((h) => h.stroke_index >= 1 && h.stroke_index <= 6));
  if (hardHoles.length < 10) return null;
  const overPar = average(hardHoles.map((h) => h.gross_score - h.par));
  if (overPar < 2) return null;

  const distance = overPar - 2;
  const confidence = computeConfidence(hardHoles.length, distance, 0.4);
  const severityRatio = Math.min(1, distance / 1);
  const severity = severityFor(severityRatio);
  const priority = computePriority(2.5, severityRatio, chronicityWeeks(rounds.slice(-5)));
  const variant = selectDrillVariant(HARDEST_HOLE_DRILLS, ctx.level, severity);

  return {
    ruleId: "hardest_holes_problem",
    type: "opportunity",
    title: "The hardest holes are eating your card",
    summary: `On stroke index 1-6 holes, you're averaging +${overPar.toFixed(1)} over par. Bogey-or-better is the realistic target there.`,
    detail: `Last 5 rounds, your six hardest holes averaged +${overPar.toFixed(1)}. Rule fires at +2 (bogey + 1) or worse. Players in your bracket average +${benchmarks.hardestOver.toFixed(1)}, so the gap is real.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(overPar * 10) / 10,
    thresholdLabel: `+${overPar.toFixed(1)} on hardest holes`,
    priority,
    confidence,
    playerValue: overPar,
    playerValueLabel: `+${overPar.toFixed(1)} avg`,
    benchmarkValue: benchmarks.hardestOver,
    benchmarkLabel: `+${benchmarks.hardestOver.toFixed(1)} typical`,
  };
};

// ---------------------------------------------------------------------------
// 11. scrambling_deficit
// ---------------------------------------------------------------------------

export const scramblingDeficit: Rule = (ctx) => {
  const { rounds, benchmarks } = ctx;
  if (rounds.length < 5) return null;
  const recent = rounds.slice(-5);
  const scrambleHoles = recent.flatMap((r) =>
    r.holes.filter((h) => h.green_in_regulation === 0),
  );
  if (scrambleHoles.length < 10) return null;
  const saved = scrambleHoles.filter((h) => h.gross_score <= h.par).length;
  const rate = saved / scrambleHoles.length;
  if (rate >= 0.25) return null;

  const distance = 0.25 - rate;
  const confidence = computeConfidence(scrambleHoles.length, distance, 0.05);
  const severityRatio = Math.min(1, distance / 0.15);
  const severity = severityFor(severityRatio);
  const priority = computePriority(3.5, severityRatio, chronicityWeeks(rounds.slice(-5)));
  const variant = selectDrillVariant(SCRAMBLING_DRILLS, ctx.level, severity);

  return {
    ruleId: "scrambling_deficit",
    type: "opportunity",
    title: "Tough to recover when you miss the green",
    summary: `When the approach misses, you're saving par about ${pct(rate)} of the time. There's room to grow here.`,
    detail: `Last 5 rounds: ${scrambleHoles.length} green-in-regulation misses, ${saved} saved. That's ${pct(rate)}. Rule flags anything under 25%. Players in your bracket save at ${pct(benchmarks.scrambling)}.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(rate * 100) / 100,
    thresholdLabel: `${pct(rate)} scrambling`,
    priority,
    confidence,
    playerValue: rate,
    playerValueLabel: `${pct(rate)} scrambling`,
    benchmarkValue: benchmarks.scrambling,
    benchmarkLabel: `${pct(benchmarks.scrambling)} typical`,
  };
};

// ---------------------------------------------------------------------------
// 12. recent_decline
// ---------------------------------------------------------------------------

export const recentDecline: Rule = (ctx) => {
  const { rounds } = ctx;
  if (rounds.length < 15) return null;
  const recent = rounds.slice(-5).map((r) => r.differential).filter((d): d is number => typeof d === "number");
  const previous = rounds.slice(-15, -5).map((r) => r.differential).filter((d): d is number => typeof d === "number");
  if (recent.length < 5 || previous.length < 10) return null;

  const recentAvg = average(recent);
  const previousAvg = average(previous);
  const delta = recentAvg - previousAvg;
  if (delta < 1.5) return null;

  const distance = delta - 1.5;
  const confidence = computeConfidence(rounds.length, distance, 0.8);
  const severityRatio = Math.min(1, distance / 1.5);
  const severity = severityFor(severityRatio);
  const priority = computePriority(4, severityRatio, chronicityWeeks(rounds.slice(-5)));
  const variant = selectDrillVariant(RECENT_DECLINE_DRILLS, ctx.level, severity);

  return {
    ruleId: "recent_decline",
    type: "opportunity",
    title: "Scoring's been heading the wrong way",
    summary: `Your last 5 rounds count ${delta.toFixed(1)} strokes higher on average than the 10 before. Direction-of-travel signal worth taking seriously.`,
    detail: `Last 5 rounds counted: ${recentAvg.toFixed(1)} avg. The 10 before that: ${previousAvg.toFixed(1)}. ${delta.toFixed(1)}-stroke shift trips the 1.5 threshold. Persistent declines almost always trace back to the basics: grip, alignment, posture, ball position.`,
    drill: variant.drill,
    selectedDrillVariantId: variant.id,
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(delta * 10) / 10,
    thresholdLabel: `+${delta.toFixed(1)} avg`,
    priority,
    confidence,
    playerValue: recentAvg,
    playerValueLabel: `${recentAvg.toFixed(1)} recent avg`,
    benchmarkValue: previousAvg,
    benchmarkLabel: `${previousAvg.toFixed(1)} prior avg`,
  };
};

// ---------------------------------------------------------------------------
// 13. putting_improvement (strength)
// ---------------------------------------------------------------------------

export const puttingImprovement: Rule = (ctx) => {
  const { rounds } = ctx;
  if (rounds.length < 15) return null;
  const recent = rounds.slice(-5).map(totalPuttsForRound).filter((v): v is number => v !== null);
  const previous = rounds.slice(-15, -5).map(totalPuttsForRound).filter((v): v is number => v !== null);
  if (recent.length < 5 || previous.length < 10) return null;

  const recentAvg = average(recent);
  const previousAvg = average(previous);
  const improvement = previousAvg - recentAvg;
  if (improvement < 1) return null;

  const confidence = computeConfidence(rounds.length, improvement - 1, 0.8);
  return {
    ruleId: "putting_improvement",
    type: "strength",
    title: "Putting is sharpening up",
    summary: `Your last 5 rounds average ${recentAvg.toFixed(1)} putts, ${improvement.toFixed(1)} better than the 10 before. Whatever you've changed, keep it.`,
    detail: `Last 5: ${recentAvg.toFixed(1)} putts/round. Previous 10: ${previousAvg.toFixed(1)}. ${improvement.toFixed(1)}-stroke improvement, past the 1-stroke threshold this rule looks for.`,
    drill:
      "Whatever you're doing on the practice green, keep doing it. Note the routine and replicate it.",
    selectedDrillVariantId: "putting_improvement_default",
    triggeringRoundIds: recentRoundIds(rounds, 5),
    thresholdValue: Math.round(improvement * 10) / 10,
    thresholdLabel: `-${improvement.toFixed(1)} putts/round`,
    priority: 30,
    confidence,
    playerValue: recentAvg,
    playerValueLabel: `${recentAvg.toFixed(1)} putts/round`,
    benchmarkValue: previousAvg,
    benchmarkLabel: `${previousAvg.toFixed(1)} prior avg`,
  };
};

// ---------------------------------------------------------------------------
// 14. ball_striking_trend (strength)
// ---------------------------------------------------------------------------

export const ballStrikingTrend: Rule = (ctx) => {
  const { rounds } = ctx;
  if (rounds.length < 16) return null;
  const recent = rounds.slice(-8);
  const previous = rounds.slice(-16, -8);

  function girRate(rs: readonly RoundWithHoleScores[]): number | null {
    const holes = rs.flatMap((r) => r.holes);
    const tracked = holes.filter((h) => h.green_in_regulation !== null);
    if (tracked.length === 0) return null;
    const hits = tracked.filter((h) => h.green_in_regulation === 1).length;
    return hits / tracked.length;
  }

  const recentRate = girRate(recent);
  const previousRate = girRate(previous);
  if (recentRate === null || previousRate === null) return null;
  const improvement = recentRate - previousRate;
  if (improvement < 0.08) return null;

  const confidence = computeConfidence(recent.length + previous.length, improvement - 0.08, 0.04);

  return {
    ruleId: "ball_striking_trend",
    type: "strength",
    title: "Ball striking is on the up",
    summary: `Hitting ${pct(recentRate)} of greens lately, up ${pct(improvement)} from the 8 rounds before. Stay out of the toolbox.`,
    detail: `Last 8 rounds GIR%: ${pct(recentRate)}. Previous 8: ${pct(previousRate)}. +${pct(improvement)} jump (rule fires at 8%+).`,
    drill: "Keep your iron sessions consistent. Don't change anything mechanical right now.",
    selectedDrillVariantId: "ball_striking_trend_default",
    triggeringRoundIds: recentRoundIds(rounds, 8),
    thresholdValue: Math.round(improvement * 100) / 100,
    thresholdLabel: `+${pct(improvement)} GIR`,
    priority: 35,
    confidence,
    playerValue: recentRate,
    playerValueLabel: `${pct(recentRate)} GIR`,
    benchmarkValue: previousRate,
    benchmarkLabel: `${pct(previousRate)} prior avg`,
  };
};

// ---------------------------------------------------------------------------
// 15. handicap_drop (milestone)
// ---------------------------------------------------------------------------

export const handicapDrop: Rule = (ctx) => {
  const { handicapSnapshots } = ctx;
  if (handicapSnapshots.length < 2) return null;
  const latest = handicapSnapshots[handicapSnapshots.length - 1]!;
  const latestIndex = latest.handicap_index;
  if (latestIndex === null) return null;

  const targetTime = new Date(latest.computed_at).getTime() - 30 * 24 * 60 * 60 * 1000;
  const earlier = [...handicapSnapshots]
    .reverse()
    .find((s) => new Date(s.computed_at).getTime() <= targetTime && s.handicap_index !== null);
  if (!earlier || earlier.handicap_index === null) return null;
  const drop = earlier.handicap_index - latestIndex;
  if (drop < 1.5) return null;

  return {
    ruleId: "handicap_drop",
    type: "milestone",
    title: "Index is dropping!",
    summary: `Down ${drop.toFixed(1)} strokes in 30 days. ${earlier.handicap_index.toFixed(1)} → ${latestIndex.toFixed(1)}.`,
    detail: `Thirty days ago you were at ${earlier.handicap_index.toFixed(1)}. Today you're at ${latestIndex.toFixed(1)}. A 1.5+ stroke drop in a month is real movement.`,
    drill:
      "You took 1.5 strokes off in a month. Whatever you changed, name it and protect it.",
    selectedDrillVariantId: "handicap_drop_default",
    triggeringRoundIds: ctx.rounds.length > 0 ? [ctx.rounds[ctx.rounds.length - 1]!.id] : [],
    thresholdValue: Math.round(drop * 10) / 10,
    thresholdLabel: `-${drop.toFixed(1)} strokes`,
    priority: 60,
    confidence: drop >= 3 ? "high" : "moderate",
    playerValue: latestIndex,
    playerValueLabel: `${latestIndex.toFixed(1)} index`,
    benchmarkValue: earlier.handicap_index,
    benchmarkLabel: `${earlier.handicap_index.toFixed(1)} 30d ago`,
  };
};

// ---------------------------------------------------------------------------
// 16. personal_best (milestone)
// ---------------------------------------------------------------------------

export const personalBest: Rule = (ctx) => {
  const { rounds } = ctx;
  if (rounds.length < 2) return null;
  const last = rounds[rounds.length - 1]!;
  if (last.differential == null) return null;
  const priors = rounds
    .slice(0, -1)
    .map((r) => r.differential)
    .filter((d): d is number => typeof d === "number");
  if (priors.length === 0) return null;
  const priorBest = Math.min(...priors);
  if (last.differential >= priorBest) return null;

  const improvement = priorBest - last.differential;

  return {
    ruleId: "personal_best",
    type: "milestone",
    title: "New personal best!",
    summary: `That round counted as ${last.differential.toFixed(1)}, your lowest yet. Old best: ${priorBest.toFixed(1)}.`,
    detail: `${last.differential.toFixed(1)} is the lowest differential across your ${rounds.length} tracked rounds. Beats the previous best by ${improvement.toFixed(1)}.`,
    drill: "",
    selectedDrillVariantId: null,
    triggeringRoundIds: [last.id],
    thresholdValue: Math.round(last.differential * 10) / 10,
    thresholdLabel: `${last.differential.toFixed(1)} counted`,
    priority: 70,
    confidence: "high",
    playerValue: last.differential,
    playerValueLabel: `${last.differential.toFixed(1)} new best`,
    benchmarkValue: priorBest,
    benchmarkLabel: `${priorBest.toFixed(1)} previous best`,
  };
};

// ---------------------------------------------------------------------------
// All rules
// ---------------------------------------------------------------------------

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
  { id: "putting_improvement", rule: puttingImprovement },
  { id: "ball_striking_trend", rule: ballStrikingTrend },
  { id: "handicap_drop", rule: handicapDrop },
  { id: "personal_best", rule: personalBest },
];
