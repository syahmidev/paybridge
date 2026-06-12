import { type Router as RouterType, Router } from "express";
import { prisma } from "@paybridge/db";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../lib/async-handler.js";

// Dashboard-facing routes (JWT-authenticated). Mounted behind requireJwt.
export const meRouter: RouterType = Router();

meRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!merchant) throw ApiError.notFound("Merchant not found");
    res.json({ merchant });
  }),
);
