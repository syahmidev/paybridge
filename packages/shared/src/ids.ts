import { randomBytes } from "node:crypto";

// Stripe-style prefixed IDs for human-readable, type-identifiable resources.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export type IdPrefix = "pay" | "evt" | "mer" | "whk";

export function prefixedId(prefix: IdPrefix, length = 24): string {
  return `${prefix}_${randomToken(length)}`;
}
