import { type Router as RouterType, Router } from "express";
import { prisma } from "@paybridge/db";
import { loginSchema, registerSchema } from "@paybridge/shared";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../lib/async-handler.js";
import { signToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

export const authRouter: RouterType = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);

    const existing = await prisma.merchant.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw ApiError.conflict("Email already registered", "email_taken");
    }

    const merchant = await prisma.merchant.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
    });

    const token = signToken({ sub: merchant.id, email: merchant.email });
    res.status(201).json({
      token,
      merchant: { id: merchant.id, email: merchant.email, name: merchant.name },
    });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);

    const merchant = await prisma.merchant.findUnique({
      where: { email: input.email },
    });
    // Same error whether the email or password is wrong — avoid user enumeration.
    const ok =
      merchant && (await verifyPassword(input.password, merchant.passwordHash));
    if (!merchant || !ok) {
      throw ApiError.unauthorized("Invalid email or password", "invalid_credentials");
    }

    const token = signToken({ sub: merchant.id, email: merchant.email });
    res.json({
      token,
      merchant: { id: merchant.id, email: merchant.email, name: merchant.name },
    });
  }),
);
