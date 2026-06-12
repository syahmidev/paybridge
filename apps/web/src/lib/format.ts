import type { PaymentStatus } from "@/lib/types";

// Amounts are integer minor units; format for display only.
export function formatMoney(minorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(minorUnits / 100);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  requires_payment_method: "Requires payment",
  processing: "Processing",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

// Maps a payment status to a Badge variant.
export function statusVariant(
  status: PaymentStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "succeeded":
      return "default";
    case "failed":
    case "canceled":
      return "destructive";
    case "processing":
      return "secondary";
    default:
      return "outline";
  }
}
