import type { Payment } from "@paybridge/db";

// Public representation of a Payment. Never leaks internal-only fields.
export function serializePayment(p: Payment) {
  return {
    id: p.id,
    object: "payment",
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    description: p.description,
    metadata: p.metadata ?? {},
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
