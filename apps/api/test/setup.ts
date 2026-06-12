import { beforeEach } from "vitest";

// Point the app at the test database BEFORE any module (and thus the Prisma
// client) is imported. dotenv in env.ts won't override an already-set var.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/paybridge_test?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-at-least-16-chars";

const { prisma } = await import("@paybridge/db");

// Clean slate before each test. Deleting merchants cascades to keys, payments,
// and webhook endpoints/deliveries, but clear children first to be explicit.
beforeEach(async () => {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.merchant.deleteMany();
});
