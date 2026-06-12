import { z } from "zod";

// --- Auth (dashboard) ---

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(120),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// --- API keys (dashboard) ---

export const createApiKeySchema = z.object({
  type: z.enum(["secret", "publishable"]).default("secret"),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// --- Payments (programmatic /v1) ---

export const createPaymentSchema = z.object({
  // Integer minor units, must be positive.
  amount: z.number().int().positive(),
  // ISO 4217 alpha-3, uppercased.
  currency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase()),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// Drives the fake checkout outcome.
export const checkoutDecisionSchema = z.object({
  outcome: z.enum(["succeed", "fail"]),
});
export type CheckoutDecisionInput = z.infer<typeof checkoutDecisionSchema>;
