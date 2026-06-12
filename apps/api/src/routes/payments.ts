import { type Router as RouterType, Router } from "express";
import { Prisma, prisma } from "@paybridge/db";
import { createPaymentSchema } from "@paybridge/shared";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../lib/async-handler.js";
import { serializePayment } from "../payments/serialize.js";

// Programmatic payment API (API-key authenticated). Mounted under /v1.
export const paymentsRouter: RouterType = Router();

function idempotencyKey(req: { headers: Record<string, unknown> }): string | undefined {
  const raw = req.headers["idempotency-key"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Create a payment. Honors the Idempotency-Key header: replaying the same key
// returns the original payment instead of creating a duplicate.
paymentsRouter.post(
  "/payments",
  asyncHandler(async (req, res) => {
    const input = createPaymentSchema.parse(req.body);
    const key = idempotencyKey(req);
    const merchantId = req.merchantId!;

    if (key) {
      const existing = await prisma.payment.findUnique({
        where: { merchantId_idempotencyKey: { merchantId, idempotencyKey: key } },
      });
      if (existing) {
        res.status(200).json(serializePayment(existing));
        return;
      }
    }

    try {
      const payment = await prisma.payment.create({
        data: {
          merchantId,
          amount: input.amount,
          currency: input.currency,
          description: input.description,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          idempotencyKey: key,
        },
      });
      res.status(201).json(serializePayment(payment));
    } catch (err) {
      // Concurrent request with the same idempotency key won the race — return
      // the now-existing payment rather than erroring.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        key
      ) {
        const existing = await prisma.payment.findUnique({
          where: { merchantId_idempotencyKey: { merchantId, idempotencyKey: key } },
        });
        if (existing) {
          res.status(200).json(serializePayment(existing));
          return;
        }
      }
      throw err;
    }
  }),
);

// List the authenticated merchant's payments (newest first).
paymentsRouter.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: { merchantId: req.merchantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: payments.map(serializePayment) });
  }),
);

// Retrieve a single payment, scoped to the merchant.
paymentsRouter.get(
  "/payments/:id",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, merchantId: req.merchantId },
    });
    if (!payment) throw ApiError.notFound("Payment not found");
    res.json(serializePayment(payment));
  }),
);
