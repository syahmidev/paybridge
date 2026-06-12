import { type Router as RouterType, Router } from "express";
import { Prisma, prisma } from "@paybridge/db";
import { createPaymentSchema } from "@paybridge/shared";
import { asyncHandler } from "../lib/async-handler.js";
import { ApiError } from "../errors.js";
import { serializePayment } from "../payments/serialize.js";

// JWT-authenticated payment endpoints for the dashboard. Mirrors /v1/payments but
// is session-authenticated, so merchants don't need a secret key to view or
// create data from the UI. The programmatic /v1 API remains the developer path.
export const dashboardPaymentsRouter: RouterType = Router();

dashboardPaymentsRouter.post(
  "/payments",
  asyncHandler(async (req, res) => {
    const input = createPaymentSchema.parse(req.body);
    const payment = await prisma.payment.create({
      data: {
        merchantId: req.merchantId!,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    res.status(201).json(serializePayment(payment));
  }),
);

dashboardPaymentsRouter.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: { merchantId: req.merchantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ data: payments.map(serializePayment) });
  }),
);

dashboardPaymentsRouter.get(
  "/payments/:id",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, merchantId: req.merchantId },
    });
    if (!payment) throw ApiError.notFound("Payment not found");
    res.json(serializePayment(payment));
  }),
);
