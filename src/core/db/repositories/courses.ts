import { getDatabase } from "../database";
import type { Course } from "../types";

export async function listCourses(): Promise<Course[]> {
  const db = await getDatabase();
  return db.getAllAsync<Course>("SELECT * FROM courses ORDER BY name ASC;");
}

export async function getCourse(id: number): Promise<Course | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Course>("SELECT * FROM courses WHERE id = ?;", id);
  return row ?? null;
}

export async function createCourse(input: Omit<Course, "id">): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO courses (name, city, state, par, external_id) VALUES (?, ?, ?, ?, ?);",
    input.name,
    input.city,
    input.state,
    input.par,
    input.external_id,
  );
  return result.lastInsertRowId;
}

export async function getCourseByExternalId(externalId: string): Promise<Course | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Course>(
    "SELECT * FROM courses WHERE external_id = ?;",
    externalId,
  );
  return row ?? null;
}

export async function updateCourse(
  id: number,
  input: Pick<Course, "name" | "city" | "state" | "par">,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE courses SET name = ?, city = ?, state = ?, par = ? WHERE id = ?;",
    input.name,
    input.city,
    input.state,
    input.par,
    id,
  );
}

export async function countCourses(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM courses;");
  return row?.c ?? 0;
}
