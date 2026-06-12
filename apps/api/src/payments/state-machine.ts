import { PaymentStatus } from "@paybridge/db";
import { ApiError } from "../errors.js";

// Allowed payment status transitions. The DB enum is the set of states; this
// table is the single source of truth for which moves are legal.
const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.requires_payment_method]: [
    PaymentStatus.processing,
    PaymentStatus.succeeded,
    PaymentStatus.failed,
    PaymentStatus.canceled,
  ],
  [PaymentStatus.processing]: [PaymentStatus.succeeded, PaymentStatus.failed],
  [PaymentStatus.succeeded]: [],
  [PaymentStatus.failed]: [],
  [PaymentStatus.canceled]: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) {
    throw ApiError.conflict(
      `Cannot move payment from ${from} to ${to}`,
      "invalid_state_transition",
    );
  }
}

const TERMINAL: PaymentStatus[] = [
  PaymentStatus.succeeded,
  PaymentStatus.failed,
  PaymentStatus.canceled,
];

export function isTerminal(status: PaymentStatus): boolean {
  return TERMINAL.includes(status);
}
