import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../errors.js";
import { logger } from "../logger.js";

// 404 fallback for unmatched routes.
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json(ApiError.notFound("No such endpoint").toJSON());
}

// Central error handler — every thrown/`next(err)` lands here and is rendered
// in the canonical { error: { type, code, message, param? } } shape.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs the 4-arg signature.
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toJSON());
    return;
  }

  // Zod validation failures → 400 with the first offending field.
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const apiErr = ApiError.badRequest(
      first?.message ?? "Invalid request",
      "validation_error",
      first?.path.join("."),
    );
    res.status(apiErr.status).json(apiErr.toJSON());
    return;
  }

  // Anything else is unexpected — log it, don't leak internals to the client.
  logger.error({ err }, "Unhandled error");
  res
    .status(500)
    .json(new ApiError("api_error", "internal_error", "Something went wrong").toJSON());
}
