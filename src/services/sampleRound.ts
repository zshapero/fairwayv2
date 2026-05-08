import * as coursesRepo from "@/core/db/repositories/courses";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as teesRepo from "@/core/db/repositories/tees";
import * as teeHolesRepo from "@/core/db/repositories/teeHoles";
import type {
  Course,
  FairwayMissDirection,
  GirMissDirection,
  Tee,
  TeeHole,
} from "@/core/db/types";
import { getOrCreateCurrentPlayer } from "./currentPlayer";
import { saveCompletedRound, type SummaryInput } from "./roundCompletion";
import { runEngine } from "./recommendationsRunner";

export interface GeneratedRound {
  roundId: number;
  courseName: string;
  teeName: string;
  grossScore: number;
}

interface GeneratedHole {
  hole_number: number;
  gross_score: number;
  putts: number | null;
  fairway_hit: number | null;
  green_in_regulation: number | null;
  penalty_strokes: number | null;
  fairway_miss_direction: FairwayMissDirection;
  gir_miss_direction: GirMissDirection;
  hit_from_sand: number;
}

function pickRandom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

function generateHoleData(hole: TeeHole): GeneratedHole {
  // Sample a delta from a distribution skewed toward bogey/par for an
  // "average" recreational golfer. Heavier tail for hard holes (HSI 1-4).
  const hsiAdjustment = hole.stroke_index <= 4 ? 0.5 : hole.stroke_index <= 12 ? 0 : -0.3;
  const deltaWeights: Record<string, number> = {
    "-1": 5,
    "0": 22,
    "1": 32 + hsiAdjustment * 5,
    "2": 20 + hsiAdjustment * 4,
    "3": 10 + hsiAdjustment * 3,
    "4": 6 + hsiAdjustment * 2,
    "5": 3 + hsiAdjustment,
  };
  const deltaKey = weightedPick(deltaWeights);
  let delta = parseInt(deltaKey, 10);
  if (hole.par === 3 && delta < 0) delta = 0; // can't make a hole-in-one ace as a sample default
  const gross = Math.max(1, hole.par + delta);

  // Internally consistent: harder scores correlate with worse fairway/GIR outcomes.
  const overParPenalty = Math.max(0, delta) * 0.07;
  const fairwayHitChance = Math.max(0.15, 0.55 - overParPenalty);
  const girHitChance = Math.max(0.1, 0.4 - overParPenalty);

  let fairway_hit: number | null = null;
  let fairway_miss_direction: FairwayMissDirection = null;
  if (hole.par >= 4) {
    if (Math.random() < fairwayHitChance) {
      fairway_hit = 1;
    } else {
      fairway_hit = 0;
      fairway_miss_direction = Math.random() < 0.5 ? "left" : "right";
    }
  }

  let green_in_regulation: number;
  let gir_miss_direction: GirMissDirection = null;
  if (Math.random() < girHitChance) {
    green_in_regulation = 1;
  } else {
    green_in_regulation = 0;
    gir_miss_direction = weightedPick<NonNullable<GirMissDirection>>({
      short: 40,
      left: 25,
      right: 25,
      long: 10,
    });
  }

  const hit_from_sand = Math.random() < 0.2 ? 1 : 0;

  // Putts: 2 if GIR, otherwise 1-2 with chip-in chance, scaled up for blow-ups.
  const basePutts = green_in_regulation === 1 ? 2 : Math.random() < 0.35 ? 1 : 2;
  const putts = Math.min(5, basePutts + (delta >= 3 ? 1 : 0));
  const penalty_strokes = delta >= 3 && Math.random() < 0.5 ? 1 : 0;

  return {
    hole_number: hole.hole_number,
    gross_score: gross,
    putts,
    fairway_hit,
    green_in_regulation,
    penalty_strokes,
    fairway_miss_direction,
    gir_miss_direction,
    hit_from_sand,
  };
}

interface PlayableSetup {
  course: Course;
  tee: Tee;
  teeHoles: TeeHole[];
}

async function findRandomPlayableCourse(): Promise<PlayableSetup | null> {
  const courses = await coursesRepo.listCourses();
  // Shuffle to avoid always picking the same course.
  const shuffled = [...courses].sort(() => Math.random() - 0.5);
  for (const course of shuffled) {
    const tees = await teesRepo.listTeesForCourse(course.id);
    const tee = pickRandom(tees);
    if (!tee) continue;
    const teeHoles = await teeHolesRepo.listTeeHoles(tee.id);
    if (teeHoles.length < 9) continue;
    return {
      course,
      tee,
      teeHoles: [...teeHoles].sort((a, b) => a.hole_number - b.hole_number),
    };
  }
  return null;
}

/**
 * Generate a complete, realistic random round for the current player on a
 * randomly chosen course/tee that has tee data. The round is saved through
 * the normal `saveCompletedRound` path, so it produces a handicap snapshot
 * and updates the player's index just like a real round entry would.
 */
export async function generateSampleRound(): Promise<GeneratedRound> {
  const setup = await findRandomPlayableCourse();
  if (!setup) {
    throw new Error("No imported courses with tee data found. Import a course first.");
  }
  const { course, tee, teeHoles } = setup;
  const player = await getOrCreateCurrentPlayer();

  const roundId = await roundsRepo.createDraftRound(player.id, course.id, tee.id);

  const perHole = teeHoles.map(generateHoleData);
  const grossScore = perHole.reduce((sum, h) => sum + h.gross_score, 0);

  const completedPriors = await roundsRepo.listCompletedRoundsForPlayer(player.id);
  const priorDifferentials = completedPriors
    .map((r) => r.differential)
    .filter((d): d is number => typeof d === "number");

  const input: SummaryInput = {
    playerId: player.id,
    roundId,
    teeHoles,
    courseRating: tee.course_rating,
    slopeRating: tee.slope_rating,
    par: course.par,
    handicapIndexBefore: player.handicap_index,
    perHole,
    priorDifferentials,
  };
  await saveCompletedRound(input);
  // Refresh recommendations after each generated round so the engine reflects
  // the new data on the next visit to /recommendations.
  await runEngine(player.id);

  return { roundId, courseName: course.name, teeName: tee.name, grossScore };
}
