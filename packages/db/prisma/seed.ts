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

  // Generate a spread of payments across the last 30 days so the analytics
  // charts have realistic, varied data.
  await prisma.payment.deleteMany({ where: { merchantId: merchant.id } });

  const descriptions = [
    "Pro plan — monthly",
    "Add-on credits",
    "Annual upgrade",
    "Seat — additional",
    "One-time setup",
    "Team plan — monthly",
  ];
  const amounts = [1500, 2990, 4990, 9900, 1999, 12000];

  // Deterministic pseudo-random so seeds are reproducible.
  let s = 42;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const samples = [];
  for (let day = 29; day >= 0; day--) {
    const perDay = Math.floor(rand() * 5); // 0–4 payments per day
    for (let i = 0; i < perDay; i++) {
      const roll = rand();
      const status =
        roll < 0.65
          ? PaymentStatus.succeeded
          : roll < 0.82
            ? PaymentStatus.failed
            : roll < 0.92
              ? PaymentStatus.requires_payment_method
              : PaymentStatus.canceled;
      const createdAt = new Date();
      createdAt.setUTCDate(createdAt.getUTCDate() - day);
      createdAt.setUTCHours(Math.floor(rand() * 24), Math.floor(rand() * 60), 0, 0);
      samples.push({
        merchantId: merchant.id,
        amount: pick(amounts),
        currency: rand() < 0.85 ? "MYR" : "USD",
        status,
        description: pick(descriptions),
        createdAt,
      });
    }
  }
  await prisma.payment.createMany({ data: samples });
  console.log(`  Seeded ${samples.length} payments across 30 days.`);

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
