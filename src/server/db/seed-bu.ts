import { db } from "./index";
import { businessUnits } from "@drizzle/schema/business-units";
import { kpiPeriods, kpiTargets } from "@drizzle/schema/kpi";
import { users } from "@drizzle/schema/users";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ─── Kỳ KPI hiện tại ──────────────────────────────────────
const CURRENT_QUARTER = "2026-Q3";
const CURRENT_PERIOD_ID = "kpi-period-2026-q3"; // id ổn định để chạy lại an toàn

// ─── Cấu hình 3 Business Unit ────────────────────────────
// leadUserId để null; nếu muốn gán lead, tra user theo tên bên dưới.
const BU_SEED: Array<{
  id: string;
  code: string;
  name: string;
  chargeModel: "revenue_share" | "build_24m" | "subscription";
  jiraProjectKey: string;
  leadName?: string; // optional: tên BOM lead để tra ra leadUserId
}> = [
  {
    id: "BU-001",
    code: "LBRC",
    name: "LBRC + VNPOST",
    chargeModel: "revenue_share",
    jiraProjectKey: "LBR",
  },
  {
    id: "BU-002",
    code: "IBSHI",
    name: "IBSHI (HI)",
    chargeModel: "build_24m",
    jiraProjectKey: "IBSHI",
  },
  {
    id: "BU-003",
    code: "XECA",
    name: "XECA",
    chargeModel: "subscription",
    jiraProjectKey: "XECA",
  },
];

/**
 * Heuristic tempoTarget theo vai trò suy ra từ username / name.
 * Dev 18 · BA 12 · DevOps 10 · Lead 10. Mặc định 12 nếu không rõ.
 */
function resolveTempoTarget(username: string | null, name: string): number {
  const hay = `${username ?? ""} ${name}`.toLowerCase();
  if (/(devops|sre|infra|ops)/.test(hay)) return 10;
  if (/(lead|bom|manager|head|trưởng|leader)/.test(hay)) return 10;
  if (/(\bba\b|business analyst|analyst|phân tích|po|product)/.test(hay)) return 12;
  if (/(dev|engineer|developer|coder|lập trình|fe|be|fullstack)/.test(hay)) return 18;
  // Không đủ thông tin để phân loại → default 12
  return 12;
}

async function seedBusinessUnits() {
  for (const bu of BU_SEED) {
    let leadUserId: string | null = null;
    if (bu.leadName) {
      const lead = await db.query.users.findFirst({
        where: eq(users.name, bu.leadName),
        columns: { id: true },
      });
      if (lead) leadUserId = lead.id;
    }

    await db
      .insert(businessUnits)
      .values({
        id: bu.id,
        code: bu.code,
        name: bu.name,
        chargeModel: bu.chargeModel,
        jiraProjectKey: bu.jiraProjectKey,
        leadUserId,
      })
      .onConflictDoNothing({ target: businessUnits.code });
  }
  console.log(`✅ Seeded ${BU_SEED.length} business units (LBRC, IBSHI, XECA).`);
}

async function seedKpiPeriod() {
  await db
    .insert(kpiPeriods)
    .values({
      id: CURRENT_PERIOD_ID,
      quarter: CURRENT_QUARTER,
      status: "open",
    })
    .onConflictDoNothing({ target: kpiPeriods.quarter });

  // Lấy lại id thực tế (nếu kỳ đã tồn tại từ trước với id khác)
  const period = await db.query.kpiPeriods.findFirst({
    where: eq(kpiPeriods.quarter, CURRENT_QUARTER),
    columns: { id: true },
  });
  const periodId = period?.id ?? CURRENT_PERIOD_ID;
  console.log(`✅ KPI period "${CURRENT_QUARTER}" ready (id=${periodId}).`);
  return periodId;
}

async function seedKpiTargets(periodId: string) {
  const allUsers = await db.query.users.findMany({
    columns: { id: true, username: true, name: true },
  });

  let inserted = 0;
  for (const u of allUsers) {
    const tempoTarget = resolveTempoTarget(u.username, u.name);
    await db
      .insert(kpiTargets)
      .values({
        userId: u.id,
        periodId,
        tempoTarget,
        completionTarget: 0.9,
        qualityTarget: 1,
        aiTarget: 1,
      })
      // unique(userId, periodId) → chạy lại an toàn
      .onConflictDoNothing({
        target: [kpiTargets.userId, kpiTargets.periodId],
      });
    inserted += 1;
  }
  console.log(
    `✅ KPI targets seeded/ensured for ${inserted} user(s) in ${CURRENT_QUARTER}.`
  );
}

async function main() {
  console.log("🌱 Seeding Business Units + KPI period + targets...");
  await seedBusinessUnits();
  const periodId = await seedKpiPeriod();
  await seedKpiTargets(periodId);
  console.log("🎉 seed-bu completed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ seed-bu failed:", err);
    process.exit(1);
  });
