import rateLimit from "express-rate-limit";
import { ApiError } from "../errors.js";

// Phase 1: in-memory limiter. Phase 2 hardens this to per-API-key (Redis).
const handler = (_req: unknown, res: import("express").Response) => {
  res
    .status(429)
    .json(
      new ApiError("rate_limit_error", "rate_limited", "Too many requests").toJSON(),
    );
};

// Generous default for the programmatic API.
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

// Tighter limit to slow credential stuffing on auth endpoints.
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});
