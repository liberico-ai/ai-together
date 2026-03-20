import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@drizzle/schema";

const connectionString = process.env.DATABASE_URL || "";

const client = postgres(connectionString, {
  ssl: !connectionString || connectionString.includes("localhost") ? false : "prefer",
  max: 20,           // D-04 FIX: max pool size
  idle_timeout: 20,  // Reclaim idle connections after 20s
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
