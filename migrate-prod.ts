import postgres from "postgres";
import fs from "fs";

const sqlContent = fs.readFileSync("./drizzle/migrations/0006_sticky_runaways.sql", "utf-8");
const statements = sqlContent.split("--> statement-breakpoint");

const sql = postgres("postgresql://ai_together:l6871F0PyOVU@103.141.177.194:15432/ai_together?sslmode=require");

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
