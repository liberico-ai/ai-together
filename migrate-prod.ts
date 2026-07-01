import postgres from "postgres";
import fs from "fs";

const sqlContent = fs.readFileSync("./drizzle/migrations/0006_sticky_runaways.sql", "utf-8");
const statements = sqlContent.split("--> statement-breakpoint");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(DATABASE_URL);

async function run() {
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await sql.unsafe(statement.trim());
        console.log("Success:", statement.trim().substring(0, 50));
      } catch (e) {
        console.error("Error executing:", statement.trim().substring(0, 50), e);
      }
    }
  }
  process.exit(0);
}
run();
