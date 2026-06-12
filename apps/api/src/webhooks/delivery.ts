import type { Payment } from "@paybridge/db";
import { WebhookDeliveryStatus, prisma } from "@paybridge/db";
import { SIGNATURE_HEADER, buildSignatureHeader, prefixedId } from "@paybridge/shared";
import { logger } from "../logger.js";
import { serializePayment } from "../payments/serialize.js";

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 5_000;

export type WebhookEventType = "payment.succeeded" | "payment.failed";

// Backoff schedule (seconds) indexed by the attempt that just failed.
// attempt 1 failed -> wait 5s, attempt 2 -> 30s, etc. Short for a sandbox.
const BACKOFF_SECONDS = [5, 30, 120, 600];

function backoffMs(attempts: number): number {
  const idx = Math.min(attempts - 1, BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[idx] * 1000;
}

// Build the event envelope sent to receivers.
function buildEvent(type: WebhookEventType, payment: Payment) {
  return {
    id: prefixedId("evt"),
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: serializePayment(payment) },
  };
}

// Emit an event to every enabled endpoint for the payment's merchant. Creates a
// WebhookDelivery per endpoint and kicks off delivery in the background.
export async function emitPaymentEvent(
  payment: Payment,
  type: WebhookEventType,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { merchantId: payment.merchantId, enabled: true },
  });
  if (endpoints.length === 0) return;

  const event = buildEvent(type, payment);

  for (const endpoint of endpoints) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventId: event.id,
        eventType: event.type,
        payload: event,
      },
    });
    // Fire-and-forget; failures are recorded and retried.
    void attemptDelivery(delivery.id);
  }
}

// Attempt (or retry) a single delivery. Records the outcome and schedules a
// backoff retry while attempts remain.
export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || delivery.status === WebhookDeliveryStatus.succeeded) return;

  const body = JSON.stringify(delivery.payload);
  const signature = buildSignatureHeader(delivery.endpoint.signingSecret, body);
  const attempts = delivery.attempts + 1;

  let responseStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [SIGNATURE_HEADER]: signature,
          "PayBridge-Event-Id": delivery.eventId,
          "PayBridge-Event-Type": delivery.eventType,
        },
        body,
        signal: controller.signal,
      });
      responseStatus = res.status;
      if (!res.ok) errorMessage = `Received HTTP ${res.status}`;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Delivery failed";
  }

  const delivered = responseStatus !== null && responseStatus >= 200 && responseStatus < 300;

  if (delivered) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: WebhookDeliveryStatus.succeeded,
        attempts,
        responseStatus,
        error: null,
        lastAttemptAt: new Date(),
        nextRetryAt: null,
      },
    });
    return;
  }

  const exhausted = attempts >= MAX_ATTEMPTS;
  const nextRetryAt = exhausted ? null : new Date(Date.now() + backoffMs(attempts));

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: exhausted
        ? WebhookDeliveryStatus.failed
        : WebhookDeliveryStatus.pending,
      attempts,
      responseStatus,
      error: errorMessage,
      lastAttemptAt: new Date(),
      nextRetryAt,
    },
  });

  if (!exhausted && nextRetryAt) {
    logger.info(
      { deliveryId: delivery.id, attempts, retryInMs: backoffMs(attempts) },
      "Scheduling webhook retry",
    );
    // In-process retry. A production system would use a durable queue.
    setTimeout(() => void attemptDelivery(delivery.id), backoffMs(attempts)).unref();
  }
}
