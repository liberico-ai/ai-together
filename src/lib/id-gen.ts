import { sql } from "drizzle-orm";
import type { DB } from "@/server/db";

const tableMap = {
  PROJ: "projects",
  MOD: "modules",
  TASK: "tasks",
  OP: "operations",
} as const;

type IdPrefix = keyof typeof tableMap;

/**
 * Generate next sequential ID for a given prefix.
 * Uses SELECT MAX + parse to avoid race condition issues with count(*).
 * For production, consider using a PostgreSQL sequence instead.
 */
export async function nextId(prefix: IdPrefix, db: DB): Promise<string> {
  const tableName = tableMap[prefix];

  const result = await db.execute(
    sql.raw(`SELECT id FROM ${tableName} ORDER BY created_at DESC LIMIT 1`)
  );

  const rows = result as unknown as Array<{ id: string }>;

  if (!rows || rows.length === 0) {
    return `${prefix}-001`;
  }

  const lastId = rows[0].id;
  const numPart = parseInt(lastId.split("-")[1], 10);
  const nextNum = numPart + 1;

  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}
