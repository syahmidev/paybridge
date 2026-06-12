import { type Router as RouterType, Router } from "express";
import { prisma } from "@paybridge/db";
import { createApiKeySchema, generateApiKey } from "@paybridge/shared";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../lib/async-handler.js";

// Dashboard API-key management (JWT-authenticated). Mounted under /dashboard.
export const apiKeysRouter: RouterType = Router();

// List keys — never returns the hash or plaintext.
apiKeysRouter.get(
  "/api-keys",
  asyncHandler(async (req, res) => {
    const keys = await prisma.apiKey.findMany({
      where: { merchantId: req.merchantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    res.json({ data: keys });
  }),
);

// Create a key — the plaintext is returned ONCE here and never again.
apiKeysRouter.post(
  "/api-keys",
  asyncHandler(async (req, res) => {
    const { type } = createApiKeySchema.parse(req.body);
    const generated = generateApiKey(type);

    const key = await prisma.apiKey.create({
      data: {
        merchantId: req.merchantId!,
        type,
        keyHash: generated.keyHash,
        prefix: generated.prefix,
      },
      select: { id: true, type: true, prefix: true, createdAt: true },
    });

    res.status(201).json({
      ...key,
      // Shown once. Store it now — it cannot be retrieved later.
      key: generated.plaintext,
    });
  }),
);

// Revoke a key (soft delete via revokedAt).
apiKeysRouter.delete(
  "/api-keys/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.apiKey.findFirst({
      where: { id: req.params.id, merchantId: req.merchantId },
    });
    if (!existing) throw ApiError.notFound("API key not found");

    if (!existing.revokedAt) {
      await prisma.apiKey.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }
    res.status(204).end();
  }),
);
