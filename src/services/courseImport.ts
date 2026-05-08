import { getDatabase } from "@/core/db/database";
import * as coursesRepo from "@/core/db/repositories/courses";
import { getCourse, type ApiCourseDetail, type ApiTee } from "./golfCourseApi";

export interface ImportResult {
  /** Local sqlite row id of the imported course. */
  localCourseId: number;
  /** True when the course already existed and was updated. */
  updated: boolean;
  teesImported: number;
  holesImported: number;
}

function pickPar(detail: ApiCourseDetail): number {
  const allTees: ApiTee[] = [
    ...(detail.tees?.male ?? []),
    ...(detail.tees?.female ?? []),
  ];
  const firstWithPar = allTees.find((t) => typeof t.par_total === "number" && t.par_total > 0);
  return firstWithPar?.par_total ?? 72;
}

/**
 * Fetch a course from GolfCourseAPI and write (or update) it in the local
 * database. Idempotent: a course is matched on its `external_id`, so calling
 * this multiple times with the same id refreshes the existing record rather
 * than creating duplicates.
 *
 * @param courseId  The GolfCourseAPI course id.
 * @returns The local course id along with import counts.
 */
export async function importCourseFromApi(courseId: string): Promise<ImportResult> {
  const detail = await getCourse(courseId);

  const externalId = String(detail.id);
  const par = pickPar(detail);
  const city = detail.location?.city ?? null;
  const state = detail.location?.state ?? null;
  const name = detail.course_name?.trim()
    ? detail.course_name
    : (detail.club_name ?? "Unknown course");

  const db = await getDatabase();
  const existing = await coursesRepo.getCourseByExternalId(externalId);

  let localCourseId: number;
  let updated = false;
  let teesImported = 0;
  let holesImported = 0;

  await db.withTransactionAsync(async () => {
    if (existing) {
      localCourseId = existing.id;
      updated = true;
      await coursesRepo.updateCourse(existing.id, { name, city, state, par });
      // Replace tees and holes; ON DELETE CASCADE handles tee_holes.
      await db.runAsync("DELETE FROM tees WHERE course_id = ?;", existing.id);
    } else {
      localCourseId = await coursesRepo.createCourse({
        name,
        city,
        state,
        par,
        external_id: externalId,
      });
    }

    const apiTees: ApiTee[] = [
      ...(detail.tees?.male ?? []),
      ...(detail.tees?.female ?? []),
    ];

    for (const tee of apiTees) {
      const teeResult = await db.runAsync(
        "INSERT INTO tees (course_id, name, color, course_rating, slope_rating, yardage) VALUES (?, ?, ?, ?, ?, ?);",
        localCourseId,
        tee.tee_name,
        null,
        tee.course_rating,
        tee.slope_rating,
        tee.total_yards ?? null,
      );
      teesImported += 1;
      const teeId = teeResult.lastInsertRowId;

      const holes = tee.holes ?? [];
      for (let i = 0; i < holes.length; i++) {
        const hole = holes[i];
        if (!hole) continue;
        await db.runAsync(
          "INSERT INTO tee_holes (tee_id, hole_number, par, yardage, stroke_index) VALUES (?, ?, ?, ?, ?);",
          teeId,
          i + 1,
          hole.par,
          hole.yardage ?? null,
          hole.handicap,
        );
        holesImported += 1;
      }
    }
  });

  return { localCourseId: localCourseId!, updated, teesImported, holesImported };
}
