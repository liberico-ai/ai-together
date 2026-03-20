import { db } from "./index";
import { users } from "@drizzle/schema/users";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  await db.update(users).set({ role: "admin" }).where(eq(users.email, "admin@libe.aios"));
  await db.update(users).set({ role: "chairman" }).where(eq(users.email, "chairman@libe.aios"));
  console.log("✅ Custom roles applied.");
  process.exit();
}

run();
