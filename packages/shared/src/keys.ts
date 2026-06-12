import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// API keys are high-entropy random tokens, so a fast cryptographic hash (SHA-256)
// is the correct choice for at-rest storage — unlike user passwords, which need a
// slow KDF (bcrypt). We never store the plaintext secret key.

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomString(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export type ApiKeyKind = "secret" | "publishable";

export interface GeneratedKey {
  /** Full plaintext key — shown to the user once, never stored for secret keys. */
  plaintext: string;
  /** SHA-256 hash for at-rest storage and lookup. */
  keyHash: string;
  /** Short safe-to-display prefix, e.g. "sk_test_a1b2". */
  prefix: string;
}

// Sandbox is test-mode only, hence the `_test_` segment.
export function generateApiKey(kind: ApiKeyKind): GeneratedKey {
  const leader = kind === "secret" ? "sk_test_" : "pk_test_";
  const body = randomString(32);
  const plaintext = `${leader}${body}`;
  return {
    plaintext,
    keyHash: hashApiKey(plaintext),
    prefix: `${leader}${body.slice(0, 4)}`,
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// Constant-time comparison of two hex hashes.
export function safeHashEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
