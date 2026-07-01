import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(DATABASE_URL);

async function check() {
  const count = await sql`SELECT COUNT(*) FROM operations`;
  console.log("Operations count:", count);
  process.exit();
}
check();
