import { type Router as RouterType, Router } from "express";
import { prisma } from "@paybridge/db";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../lib/async-handler.js";

// Programmatic API (API-key authenticated). Mounted at /v1 behind requireApiKey.
// Payment endpoints are added in step 4; for now an account probe to confirm auth.
export const v1Router: RouterType = Router();

v1Router.get(
  "/account",
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { id: true, email: true, name: true },
    });
    if (!merchant) throw ApiError.notFound("Merchant not found");
    res.json({ account: merchant });
  }),
);
