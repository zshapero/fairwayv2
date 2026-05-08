import { getDatabase } from "./database";

interface DemoHole {
  hole_number: number;
  par: number;
  yardage: number;
  stroke_index: number;
}

interface DemoTee {
  name: string;
  color: string;
  course_rating: number;
  slope_rating: number;
  yardage: number;
  holes: readonly DemoHole[];
}

interface DemoCourse {
  name: string;
  city: string;
  state: string;
  par: number;
  tees: readonly DemoTee[];
}

function buildHoles(
  pars: readonly number[],
  yardages: readonly number[],
  strokeIndexes: readonly number[],
): DemoHole[] {
  return pars.map((par, idx) => ({
    hole_number: idx + 1,
    par,
    yardage: yardages[idx] ?? 0,
    stroke_index: strokeIndexes[idx] ?? idx + 1,
  }));
}

const FAIRWAY_PARS = [4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4];
const FAIRWAY_INDEXES = [7, 1, 17, 11, 5, 13, 3, 15, 9, 8, 16, 2, 10, 6, 12, 18, 4, 14];

const DEMO_COURSES: readonly DemoCourse[] = [
  {
    name: "Pebble Creek GC",
    city: "Asheville",
    state: "NC",
    par: 72,
    tees: [
      {
        name: "Blue",
        color: "#1d4ed8",
        course_rating: 71.2,
        slope_rating: 131,
        yardage: 6712,
        holes: buildHoles(
          FAIRWAY_PARS,
          [395, 540, 175, 410, 425, 380, 555, 165, 430, 405, 200, 525, 415, 440, 395, 175, 545, 420],
          FAIRWAY_INDEXES,
        ),
      },
      {
        name: "White",
        color: "#f5f5f4",
        course_rating: 69.4,
        slope_rating: 124,
        yardage: 6210,
        holes: buildHoles(
          FAIRWAY_PARS,
          [365, 505, 155, 380, 395, 350, 520, 150, 400, 375, 175, 490, 385, 410, 365, 155, 510, 390],
          FAIRWAY_INDEXES,
        ),
      },
    ],
  },
  {
    name: "Driftwood Dunes",
    city: "Outer Banks",
    state: "NC",
    par: 71,
    tees: [
      {
        name: "Black",
        color: "#0f172a",
        course_rating: 73.1,
        slope_rating: 138,
        yardage: 6985,
        holes: buildHoles(
          [4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4, 4, 3, 4, 4],
          [410, 440, 565, 195, 415, 430, 405, 175, 555, 415, 535, 210, 425, 450, 405, 165, 405, 385],
          [9, 3, 1, 13, 7, 5, 11, 17, 15, 8, 4, 14, 6, 2, 10, 18, 12, 16],
        ),
      },
      {
        name: "Green",
        color: "#16a34a",
        course_rating: 70.5,
        slope_rating: 126,
        yardage: 6320,
        holes: buildHoles(
          [4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4, 4, 3, 4, 4],
          [380, 405, 525, 165, 380, 395, 370, 150, 515, 380, 495, 180, 390, 415, 370, 145, 370, 355],
          [9, 3, 1, 13, 7, 5, 11, 17, 15, 8, 4, 14, 6, 2, 10, 18, 12, 16],
        ),
      },
    ],
  },
];

declare const __DEV__: boolean | undefined;

/**
 * Insert two demo courses with full tee and hole data. The function is a no-op
 * outside of development builds so production users never see seeded data.
 */
export async function seedDemoData(): Promise<{ courses: number; tees: number; teeHoles: number }> {
  const isDev = typeof __DEV__ === "boolean" ? __DEV__ : true;
  if (!isDev) {
    return { courses: 0, tees: 0, teeHoles: 0 };
  }

  const db = await getDatabase();
  let courses = 0;
  let tees = 0;
  let teeHoles = 0;

  await db.withTransactionAsync(async () => {
    for (const course of DEMO_COURSES) {
      const courseResult = await db.runAsync(
        "INSERT INTO courses (name, city, state, par, external_id) VALUES (?, ?, ?, ?, NULL);",
        course.name,
        course.city,
        course.state,
        course.par,
      );
      courses += 1;
      const courseId = courseResult.lastInsertRowId;

      for (const tee of course.tees) {
        const teeResult = await db.runAsync(
          "INSERT INTO tees (course_id, name, color, course_rating, slope_rating, yardage) VALUES (?, ?, ?, ?, ?, ?);",
          courseId,
          tee.name,
          tee.color,
          tee.course_rating,
          tee.slope_rating,
          tee.yardage,
        );
        tees += 1;
        const teeId = teeResult.lastInsertRowId;

        for (const hole of tee.holes) {
          await db.runAsync(
            "INSERT INTO tee_holes (tee_id, hole_number, par, yardage, stroke_index) VALUES (?, ?, ?, ?, ?);",
            teeId,
            hole.hole_number,
            hole.par,
            hole.yardage,
            hole.stroke_index,
          );
          teeHoles += 1;
        }
      }
    }
  });

  return { courses, tees, teeHoles };
}
