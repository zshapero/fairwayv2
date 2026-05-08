import { getDatabase } from "../database";
import type { Tee } from "../types";

export async function listTeesForCourse(courseId: number): Promise<Tee[]> {
  const db = await getDatabase();
  return db.getAllAsync<Tee>("SELECT * FROM tees WHERE course_id = ? ORDER BY id ASC;", courseId);
}

export async function createTee(input: Omit<Tee, "id">): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO tees (course_id, name, color, course_rating, slope_rating, yardage) VALUES (?, ?, ?, ?, ?, ?);",
    input.course_id,
    input.name,
    input.color,
    input.course_rating,
    input.slope_rating,
    input.yardage,
  );
  return result.lastInsertRowId;
}

export async function countTees(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM tees;");
  return row?.c ?? 0;
}
