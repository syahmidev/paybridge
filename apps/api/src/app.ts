import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";
import { requireApiKey, requireJwt } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiLimiter, authLimiter } from "./middleware/rate-limit.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { v1Router } from "./routes/v1.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Liveness probe.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Dashboard auth (JWT issuance) — rate-limited.
  app.use("/auth", authLimiter, authRouter);

  // Dashboard resources — JWT required. Scoped under /dashboard so the guard
  // never leaks onto /v1 or unmatched routes.
  app.use("/dashboard", requireJwt, meRouter);

  // Programmatic API — API key required + general rate limit.
  app.use("/v1", apiLimiter, requireApiKey, v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
