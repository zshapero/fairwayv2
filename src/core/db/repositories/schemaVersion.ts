import { getDatabase } from "../database";
import type { SchemaVersionRow } from "../types";

export async function listSchemaVersions(): Promise<SchemaVersionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SchemaVersionRow>(
    "SELECT * FROM schema_version ORDER BY version DESC;",
  );
}

export async function countSchemaVersions(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM schema_version;",
  );
  return row?.c ?? 0;
}
