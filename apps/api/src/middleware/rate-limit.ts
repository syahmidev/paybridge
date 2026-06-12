import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ApiError } from "../errors.js";

const handler = (_req: Request, res: Response) => {
  res
    .status(429)
    .json(
      new ApiError("rate_limit_error", "rate_limited", "Too many requests").toJSON(),
    );
};

// Per-API-key limiter for /v1. Runs after requireApiKey, so each merchant's key
// gets its own bucket (falling back to IP if somehow unauthenticated).
// In-memory for the sandbox; a production deployment would back this with Redis.
export const apiKeyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.apiKeyId ?? req.ip ?? "unknown",
  handler,
});

// Tighter limit to slow credential stuffing on auth endpoints (keyed by IP).
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});
