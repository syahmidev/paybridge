import { type Router as RouterType, Router } from "express";
import { prisma } from "@paybridge/db";
import {
  createWebhookEndpointSchema,
  generateSigningSecret,
  updateWebhookEndpointSchema,
} from "@paybridge/shared";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../lib/async-handler.js";
import { attemptDelivery } from "../webhooks/delivery.js";

// Dashboard webhook management (JWT-authenticated). Mounted under /dashboard.
export const webhooksRouter: RouterType = Router();

// --- Endpoints ---

webhooksRouter.get(
  "/webhook-endpoints",
  asyncHandler(async (req, res) => {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { merchantId: req.merchantId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: endpoints });
  }),
);

webhooksRouter.post(
  "/webhook-endpoints",
  asyncHandler(async (req, res) => {
    const input = createWebhookEndpointSchema.parse(req.body);
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        merchantId: req.merchantId!,
        url: input.url,
        enabled: input.enabled,
        signingSecret: generateSigningSecret(),
      },
    });
    res.status(201).json(endpoint);
  }),
);

webhooksRouter.patch(
  "/webhook-endpoints/:id",
  asyncHandler(async (req, res) => {
    const input = updateWebhookEndpointSchema.parse(req.body);
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, merchantId: req.merchantId },
    });
    if (!existing) throw ApiError.notFound("Webhook endpoint not found");

    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: { url: input.url, enabled: input.enabled },
    });
    res.json(endpoint);
  }),
);

webhooksRouter.delete(
  "/webhook-endpoints/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, merchantId: req.merchantId },
    });
    if (!existing) throw ApiError.notFound("Webhook endpoint not found");
    await prisma.webhookEndpoint.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

// --- Deliveries ---

// Recent deliveries across all of the merchant's endpoints.
webhooksRouter.get(
  "/webhook-deliveries",
  asyncHandler(async (req, res) => {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpoint: { merchantId: req.merchantId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { endpoint: { select: { url: true } } },
    });
    res.json({ data: deliveries });
  }),
);

// Manually retry a delivery. Awaits the attempt so the dashboard reflects the
// fresh outcome.
webhooksRouter.post(
  "/webhook-deliveries/:id/retry",
  asyncHandler(async (req, res) => {
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: req.params.id, endpoint: { merchantId: req.merchantId } },
    });
    if (!delivery) throw ApiError.notFound("Delivery not found");

    await attemptDelivery(delivery.id);

    const updated = await prisma.webhookDelivery.findUnique({
      where: { id: delivery.id },
      include: { endpoint: { select: { url: true } } },
    });
    res.json(updated);
  }),
);
