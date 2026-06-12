import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Webhook signing, Stripe-style. The signed payload is `${timestamp}.${body}`,
// and the signature header is `t=<unix>,v1=<hex hmac-sha256>`. Receivers
// recompute the HMAC with their endpoint signing secret and compare.

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateSigningSecret(): string {
  const bytes = randomBytes(32);
  let body = "";
  for (let i = 0; i < bytes.length; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return `whsec_${body}`;
}

export function computeSignature(
  secret: string,
  timestamp: number,
  payload: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}

export const SIGNATURE_HEADER = "PayBridge-Signature";

export function buildSignatureHeader(
  secret: string,
  payload: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  return `t=${timestamp},v1=${computeSignature(secret, timestamp, payload)}`;
}

// Verify an incoming signature header. Exposed for receivers / SDK / docs.
export function verifySignature(
  secret: string,
  header: string,
  payload: string,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string]),
  );
  const timestamp = Number(parts.t);
  const provided = parts.v1;
  if (!timestamp || !provided) return false;

  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = computeSignature(secret, timestamp, payload);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
