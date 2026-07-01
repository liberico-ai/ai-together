import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { costItems, buRevenues } from "@drizzle/schema/finance";
import { businessUnits } from "@drizzle/schema/business-units";
import { eq, and } from "drizzle-orm";

/**
 * MỤC TIÊU 3 — Router tài chính: công cụ hoá Mô hình tài chính v7.2.
 * - Chi phí/tháng theo loại; doanh thu/tháng theo BU.
 * - Cover ratio 24 tháng (chỉ số điều hành quan trọng nhất, target 1.05).
 * - Lãi/lỗ theo BU (phân bổ chi phí chung theo tỉ trọng doanh thu).
 * - Nhập liệu (chairman) + mô phỏng 3 phương án A/B/C.
 *
 * Quy ước: DB lưu VND; mọi số tiền TRẢ VỀ đều là TRIỆU VND (đã làm tròn).
 */

const COVER_TARGET = 1.05; // target đạt 105% theo blueprint

// VND → triệu VND, làm tròn
const toMil = (vnd: number): number => Math.round(vnd / 1_000_000);

function health(ratio: number): "green" | "yellow" | "red" {
  if (ratio >= COVER_TARGET) return "green";
  if (ratio >= 1.0) return "yellow";
  return "red";
}

export const financeRouter = router({
  /** Chi phí/tháng: nhóm cost_items theo category + tổng (triệu VND). */
  monthlyCost: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.select().from(costItems);
    const byCategory: Record<string, number> = {};
    let totalVnd = 0;
    for (const it of items) {
      byCategory[it.category] = (byCategory[it.category] ?? 0) + it.amountVnd;
      totalVnd += it.amountVnd;
    }
    return {
      byCategory: Object.entries(byCategory).map(([category, vnd]) => ({
        category,
        amount: toMil(vnd),
      })),
      total: toMil(totalVnd),
    };
  }),

  /** Doanh thu 1 tháng: tổng + chi tiết theo BU (triệu VND). */
  monthlyRevenue: protectedProcedure
    .input(z.object({ month: z.string() })) // "2026-07"
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(buRevenues)
        .where(eq(buRevenues.month, input.month));
      const bus = await ctx.db.select().from(businessUnits);
      const codeById = new Map(bus.map((b) => [b.id, b.code]));

      const byBu = new Map<string, number>();
      let totalVnd = 0;
      for (const r of rows) {
        byBu.set(r.buId, (byBu.get(r.buId) ?? 0) + r.amountVnd);
        totalVnd += r.amountVnd;
      }
      return {
        month: input.month,
        total: toMil(totalVnd),
        byBu: [...byBu.entries()].map(([buId, vnd]) => ({
          buId,
          buCode: codeById.get(buId) ?? buId,
          amount: toMil(vnd),
        })),
      };
    }),

  /**
   * Cover ratio 24 tháng.
   * cost24 = tổng chi phí/tháng × 24.
   * rev24  = doanh thu TB/tháng × 24 (TB = tổng doanh thu / số tháng có dữ liệu, tối thiểu 1).
   */
  coverRatio: protectedProcedure.query(async ({ ctx }) => {
    const costs = await ctx.db.select().from(costItems);
    const revs = await ctx.db.select().from(buRevenues);

    const costMonthVnd = costs.reduce((s, c) => s + c.amountVnd, 0);
    const cost24Vnd = costMonthVnd * 24;

    const totalRevVnd = revs.reduce((s, r) => s + r.amountVnd, 0);
    const months = new Set(revs.map((r) => r.month)).size;
    const monthsCount = Math.max(months, 1);
    const revAvgMonthVnd = totalRevVnd / monthsCount;
    const rev24Vnd = revAvgMonthVnd * 24;

    const ratio = cost24Vnd > 0 ? rev24Vnd / cost24Vnd : 0;
    return {
      cost24: toMil(cost24Vnd),
      rev24: toMil(rev24Vnd),
      ratio: Math.round(ratio * 1000) / 1000,
      diff: toMil(rev24Vnd - cost24Vnd), // dương = lãi
      health: health(ratio),
      monthsWithData: monthsCount,
      target: COVER_TARGET,
    };
  }),

  /**
   * Lãi/lỗ theo BU (triệu VND).
   * Đơn giản hoá: chi phí chung được phân bổ cho mỗi BU theo TỈ TRỌNG doanh thu
   * (BU tạo nhiều doanh thu hơn gánh nhiều chi phí chung hơn). Nếu chưa có doanh thu
   * thì chi phí chia đều cho các BU.
   */
  buProfit: protectedProcedure.query(async ({ ctx }) => {
    const bus = await ctx.db.select().from(businessUnits);
    const revs = await ctx.db.select().from(buRevenues);
    const costs = await ctx.db.select().from(costItems);

    const totalCostVnd = costs.reduce((s, c) => s + c.amountVnd, 0);

    const revByBu = new Map<string, number>();
    for (const r of revs) {
      revByBu.set(r.buId, (revByBu.get(r.buId) ?? 0) + r.amountVnd);
    }
    const totalRevVnd = [...revByBu.values()].reduce((s, v) => s + v, 0);
    const buCount = Math.max(bus.length, 1);

    return bus.map((bu) => {
      const revenueVnd = revByBu.get(bu.id) ?? 0;
      // Phân bổ chi phí chung: theo tỉ trọng doanh thu; fallback chia đều.
      const share =
        totalRevVnd > 0 ? revenueVnd / totalRevVnd : 1 / buCount;
      const costVnd = totalCostVnd * share;
      return {
        buCode: bu.code,
        revenue: toMil(revenueVnd),
        cost: toMil(costVnd),
        profit: toMil(revenueVnd - costVnd),
      };
    });
  }),

  /** Upsert 1 mục chi phí (nhập liệu, chairman). */
  manageCostItem: chairmanProcedure
    .input(
      z.object({
        id: z.string().optional(),
        category: z.enum(["salary", "infra", "license", "office"]),
        vendor: z.string().optional(),
        amountVnd: z.number().int().nonnegative(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const [updated] = await ctx.db
          .update(costItems)
          .set({
            category: input.category,
            vendor: input.vendor ?? null,
            amountVnd: input.amountVnd,
            note: input.note ?? null,
          })
          .where(eq(costItems.id, input.id))
          .returning();
        if (!updated) throw new Error("Cost item not found");
        return updated;
      }
      const [created] = await ctx.db
        .insert(costItems)
        .values({
          category: input.category,
          vendor: input.vendor ?? null,
          amountVnd: input.amountVnd,
          note: input.note ?? null,
        })
        .returning();
      return created;
    }),

  /** Upsert doanh thu 1 BU cho 1 tháng + cơ chế (nhập liệu, chairman). */
  manageBuRevenue: chairmanProcedure
    .input(
      z.object({
        buId: z.string(),
        month: z.string(), // "2026-07"
        mechanism: z.enum(["revenue_share", "subscription", "build_24m"]),
        amountVnd: z.number().int().nonnegative(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Unique(buId, month, mechanism) → upsert thủ công.
      const existing = await ctx.db
        .select()
        .from(buRevenues)
        .where(
          and(
            eq(buRevenues.buId, input.buId),
            eq(buRevenues.month, input.month),
            eq(buRevenues.mechanism, input.mechanism)
          )
        );
      if (existing[0]) {
        const [updated] = await ctx.db
          .update(buRevenues)
          .set({ amountVnd: input.amountVnd, note: input.note ?? null })
          .where(eq(buRevenues.id, existing[0].id))
          .returning();
        return updated;
      }
      const [created] = await ctx.db
        .insert(buRevenues)
        .values({
          buId: input.buId,
          month: input.month,
          mechanism: input.mechanism,
          amountVnd: input.amountVnd,
          note: input.note ?? null,
        })
        .returning();
      return created;
    }),

  /**
   * Mô phỏng cover ratio theo 3 phương án (Sheet 5):
   *  A. Hybrid  — IBSHI dùng phí xây dựng (IVP × giá × hệ số) trả góp 24 tháng.
   *  B. Tăng giá — như A nhưng nhân thêm chargeMultiplier lên toàn bộ doanh thu.
   *  C. Giữ cũ  — subscription cố định (xecaFixed) + revenue_share (lbrcPercent).
   * Chi phí lấy từ cost_items hiện có; doanh thu điền từ input theo từng phương án.
   * Trả bảng so sánh 3 phương án để chọn.
   */
  simulate: protectedProcedure
    .input(
      z.object({
        ivpPrice: z.number().nonnegative().default(2_000_000), // VND / IVP
        chargeMultiplier: z.number().positive().default(1),
        xecaFixed: z.number().nonnegative().default(140_000_000), // VND/tháng
        lbrcPercent: z.number().min(0).max(1).default(0.05), // % DT sản phẩm mới
        expectedIvp: z.number().nonnegative().default(600), // IVP dự kiến IBSHI
        lbrcNewProductRevenue: z
          .number()
          .nonnegative()
          .default(2_820_000_000), // DT SP mới/tháng để tính 5% (~141tr)
      })
    )
    .query(async ({ ctx, input }) => {
      const costs = await ctx.db.select().from(costItems);
      const costMonthVnd = costs.reduce((s, c) => s + c.amountVnd, 0);
      const cost24Vnd = costMonthVnd * 24;

      // Doanh thu/tháng từng nguồn (VND).
      const lbrcMonth = input.lbrcNewProductRevenue * input.lbrcPercent; // revenue_share
      const xecaMonth = input.xecaFixed; // subscription
      // IBSHI: phí xây dựng trả góp /24.
      const ibshiBuildTotal =
        input.expectedIvp * input.ivpPrice * input.chargeMultiplier;
      const ibshiMonthBase = ibshiBuildTotal / 24;

      const buildScenario = (
        key: "A" | "B" | "C",
        label: string,
        ibshiMonth: number,
        multiplier: number
      ) => {
        const revMonthVnd = (lbrcMonth + xecaMonth + ibshiMonth) * multiplier;
        const rev24Vnd = revMonthVnd * 24;
        const ratio = cost24Vnd > 0 ? rev24Vnd / cost24Vnd : 0;
        return {
          key,
          label,
          revMonth: toMil(revMonthVnd),
          rev24: toMil(rev24Vnd),
          cost24: toMil(cost24Vnd),
          ratio: Math.round(ratio * 1000) / 1000,
          diff: toMil(rev24Vnd - cost24Vnd),
          health: health(ratio),
        };
      };

      return {
        target: COVER_TARGET,
        costMonth: toMil(costMonthVnd),
        scenarios: [
          buildScenario("A", "Hybrid (phí xây dựng IVP, trả góp 24m)", ibshiMonthBase, 1),
          buildScenario(
            "B",
            "Tăng giá (× hệ số charge)",
            ibshiMonthBase,
            input.chargeMultiplier
          ),
          // C giữ cũ: IBSHI không tính phí xây dựng, chỉ subscription + revenue_share.
          buildScenario("C", "Giữ cũ (subscription + revenue share)", 0, 1),
        ],
      };
    }),
});
