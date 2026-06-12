import type { NextFunction, Request, Response } from "express";
import { prisma } from "@paybridge/db";
import { hashApiKey } from "@paybridge/shared";
import { ApiError } from "../errors.js";
import { verifyToken } from "../lib/jwt.js";

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

// Dashboard auth: validates a JWT and attaches the merchant id.
export function requireJwt(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) {
    next(ApiError.unauthorized("Missing bearer token"));
    return;
  }
  const payload = verifyToken(token);
  req.merchantId = payload.sub;
  next();
}

// Programmatic /v1 auth: validates a secret API key against the hashed store.
export async function requireApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = bearer(req);
  if (!token || !token.startsWith("sk_")) {
    next(ApiError.unauthorized("Provide a secret API key as a bearer token", "missing_api_key"));
    return;
  }

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
  });

  if (!key || key.type !== "secret" || key.revokedAt) {
    next(ApiError.unauthorized("Invalid API key", "invalid_api_key"));
    return;
  }

  req.merchantId = key.merchantId;
  req.apiKeyId = key.id;

  // Best-effort last-used timestamp; never block the request on it.
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  next();
}
