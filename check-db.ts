import postgres from "postgres";

const sql = postgres("postgresql://ai_together:l6871F0PyOVU@103.141.177.194:15432/ai_together?sslmode=require");

async function check() {
  const count = await sql`SELECT COUNT(*) FROM operations`;
  console.log("Operations count:", count);
  process.exit();
}
check();
