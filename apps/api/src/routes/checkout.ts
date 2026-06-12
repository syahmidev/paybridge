import { type Router as RouterType, Router } from "express";
import { PaymentStatus, prisma } from "@paybridge/db";
import { checkoutDecisionSchema } from "@paybridge/shared";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../lib/async-handler.js";
import { assertTransition, isTerminal } from "../payments/state-machine.js";
import { serializePayment } from "../payments/serialize.js";

// Public hosted-checkout endpoints. No merchant auth — the customer reaches these
// via the payment link. The (cuid) payment id is the unguessable capability.
export const checkoutRouter: RouterType = Router();

// Render data for the checkout page.
checkoutRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        amount: true,
        currency: true,
        description: true,
        status: true,
        merchant: { select: { name: true } },
      },
    });
    if (!payment) throw ApiError.notFound("Payment not found");
    res.json({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      status: payment.status,
      merchantName: payment.merchant.name,
    });
  }),
);

// Submit the (fake) checkout decision, driving the payment to a terminal state.
checkoutRouter.post(
  "/:id",
  asyncHandler(async (req, res) => {
    const { outcome } = checkoutDecisionSchema.parse(req.body);
    const target =
      outcome === "succeed" ? PaymentStatus.succeeded : PaymentStatus.failed;

    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
    });
    if (!payment) throw ApiError.notFound("Payment not found");

    if (isTerminal(payment.status)) {
      throw ApiError.conflict(
        `Payment already ${payment.status}`,
        "payment_already_finalized",
      );
    }

    // Enforce the state machine before writing.
    assertTransition(payment.status, target);

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: target },
    });
    res.json(serializePayment(updated));
  }),
);
