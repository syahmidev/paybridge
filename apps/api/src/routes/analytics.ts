import { type Router as RouterType, Router } from "express";
import { PaymentStatus, prisma } from "@paybridge/db";
import { asyncHandler } from "../lib/async-handler.js";

// JWT-authenticated analytics for the dashboard. Aggregates in-process — fine at
// sandbox scale; a production system would push this into SQL or a warehouse.
export const analyticsRouter: RouterType = Router();

const DAYS = 30;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

analyticsRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const merchantId = req.merchantId;

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (DAYS - 1));

    const [all, recent] = await Promise.all([
      prisma.payment.findMany({
        where: { merchantId },
        select: { status: true, amount: true, currency: true },
      }),
      prisma.payment.findMany({
        where: { merchantId, createdAt: { gte: since } },
        select: { status: true, amount: true, currency: true, createdAt: true },
      }),
    ]);

    // Status breakdown (all time).
    const statusBreakdown = Object.values(PaymentStatus).map((status) => ({
      status,
      count: all.filter((p) => p.status === status).length,
    }));

    const succeeded = all.filter((p) => p.status === PaymentStatus.succeeded);
    const failed = all.filter((p) => p.status === PaymentStatus.failed);
    const decided = succeeded.length + failed.length;

    // Captured volume by currency.
    const volumeMap = succeeded.reduce<Record<string, number>>((acc, p) => {
      acc[p.currency] = (acc[p.currency] ?? 0) + p.amount;
      return acc;
    }, {});
    const volume = Object.entries(volumeMap).map(([currency, amount]) => ({
      currency,
      amount,
    }));

    // Primary currency = the one with the most captured volume (for the chart).
    const primaryCurrency =
      volume.sort((a, b) => b.amount - a.amount)[0]?.currency ?? "MYR";

    // Build a continuous 30-day series (zero-filled).
    const buckets = new Map<string, { count: number; succeeded: number; volume: number }>();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      buckets.set(dayKey(d), { count: 0, succeeded: 0, volume: 0 });
    }
    for (const p of recent) {
      const bucket = buckets.get(dayKey(p.createdAt));
      if (!bucket) continue;
      bucket.count += 1;
      if (p.status === PaymentStatus.succeeded && p.currency === primaryCurrency) {
        bucket.succeeded += 1;
        bucket.volume += p.amount;
      }
    }
    const timeSeries = [...buckets.entries()].map(([date, v]) => ({ date, ...v }));

    res.json({
      summary: {
        totalPayments: all.length,
        succeeded: succeeded.length,
        failed: failed.length,
        successRate: decided > 0 ? succeeded.length / decided : 0,
        volume,
      },
      statusBreakdown,
      primaryCurrency,
      timeSeries,
    });
  }),
);
