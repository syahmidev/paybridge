import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../env.js";
import { ApiError } from "../errors.js";

export interface JwtPayload {
  sub: string; // merchant id
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string") throw new Error("Unexpected token payload");
    return { sub: String(decoded.sub), email: String(decoded.email) };
  } catch {
    throw ApiError.unauthorized("Invalid or expired token", "invalid_token");
  }
}
