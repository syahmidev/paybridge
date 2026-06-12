import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { logger } from "./logger.js";
import { openapiSpec } from "./openapi.js";
import { requireApiKey, requireJwt } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiKeyLimiter, authLimiter } from "./middleware/rate-limit.js";
import { analyticsRouter } from "./routes/analytics.js";
import { apiKeysRouter } from "./routes/api-keys.js";
import { authRouter } from "./routes/auth.js";
import { checkoutRouter } from "./routes/checkout.js";
import { dashboardPaymentsRouter } from "./routes/dashboard-payments.js";
import { meRouter } from "./routes/me.js";
import { paymentsRouter } from "./routes/payments.js";
import { v1Router } from "./routes/v1.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Liveness probe.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // API docs (public): raw spec + Swagger UI.
  app.get("/openapi.json", (_req, res) => res.json(openapiSpec));
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, { customSiteTitle: "PayBridge API" }),
  );

  // Dashboard auth (JWT issuance) — rate-limited.
  app.use("/auth", authLimiter, authRouter);

  // Dashboard resources — JWT required. Scoped under /dashboard so the guard
  // never leaks onto /v1 or unmatched routes.
  app.use(
    "/dashboard",
    requireJwt,
    meRouter,
    apiKeysRouter,
    dashboardPaymentsRouter,
    webhooksRouter,
    analyticsRouter,
  );

  // Public hosted checkout (customer-facing, reached via the payment link).
  app.use("/checkout", checkoutRouter);

  // Programmatic API — API key required, then a per-key rate limit.
  app.use("/v1", requireApiKey, apiKeyLimiter, v1Router, paymentsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
