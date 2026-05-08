import { getDatabase } from "../database";
import type { TeeHole } from "../types";

export async function listTeeHoles(teeId: number): Promise<TeeHole[]> {
  const db = await getDatabase();
  return db.getAllAsync<TeeHole>(
    "SELECT * FROM tee_holes WHERE tee_id = ? ORDER BY hole_number ASC;",
    teeId,
  );
}

export async function createTeeHole(input: Omit<TeeHole, "id">): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO tee_holes (tee_id, hole_number, par, yardage, stroke_index) VALUES (?, ?, ?, ?, ?);",
    input.tee_id,
    input.hole_number,
    input.par,
    input.yardage,
    input.stroke_index,
  );
  return result.lastInsertRowId;
}

export async function countTeeHoles(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM tee_holes;");
  return row?.c ?? 0;
}
