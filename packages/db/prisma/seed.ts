import bcrypt from "bcryptjs";
import { generateApiKey } from "@paybridge/shared";
import { PrismaClient, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Deterministic demo data so the dashboard isn't empty on first run.
async function main() {
  const email = "demo@paybridge.dev";
  const password = "password123";

  const passwordHash = await bcrypt.hash(password, 10);

  const merchant = await prisma.merchant.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo Merchant", passwordHash },
  });

  // Fresh keys each seed run (idempotency on keys isn't meaningful — they're secret).
  await prisma.apiKey.deleteMany({ where: { merchantId: merchant.id } });

  const secret = generateApiKey("secret");
  const publishable = generateApiKey("publishable");

  await prisma.apiKey.createMany({
    data: [
      {
        merchantId: merchant.id,
        type: "secret",
        keyHash: secret.keyHash,
        prefix: secret.prefix,
      },
      {
        merchantId: merchant.id,
        type: "publishable",
        keyHash: publishable.keyHash,
        prefix: publishable.prefix,
      },
    ],
  });

  // A few sample payments across statuses.
  await prisma.payment.deleteMany({ where: { merchantId: merchant.id } });
  await prisma.payment.createMany({
    data: [
      {
        merchantId: merchant.id,
        amount: 4990,
        currency: "MYR",
        status: PaymentStatus.succeeded,
        description: "Pro plan — monthly",
      },
      {
        merchantId: merchant.id,
        amount: 1500,
        currency: "MYR",
        status: PaymentStatus.requires_payment_method,
        description: "Add-on credits",
      },
      {
        merchantId: merchant.id,
        amount: 9900,
        currency: "USD",
        status: PaymentStatus.failed,
        description: "Annual upgrade",
      },
    ],
  });

  console.log("Seed complete.");
  console.log(`  Merchant login: ${email} / ${password}`);
  console.log(`  Secret key (shown once): ${secret.plaintext}`);
  console.log(`  Publishable key:         ${publishable.plaintext}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
