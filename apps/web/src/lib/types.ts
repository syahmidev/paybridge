// Shapes returned by the PayBridge API (mirrors the server serializers).

export interface Merchant {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export type PaymentStatus =
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export interface Payment {
  id: string;
  object: "payment";
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  type: "secret" | "publishable";
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey {
  id: string;
  type: "secret" | "publishable";
  prefix: string;
  createdAt: string;
  key: string; // plaintext, shown once
}

export interface AuthResponse {
  token: string;
  merchant: Merchant;
}
