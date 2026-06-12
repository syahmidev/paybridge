# PayBridge

**A developer-focused payment gateway sandbox.** Register as a merchant, generate API
keys, create payments, send customers to a hosted checkout, and receive **signed
webhooks** — a Stripe-style flow you can build against without touching real money.

Built as a portfolio project to demonstrate production-minded backend engineering:
idempotency, a payment state machine, HMAC-signed webhooks with retries, per-key rate
limiting, JWT + API-key auth, and an OpenAPI-documented API — all under test.

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D20-339933?logo=nodedotjs&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-000000?logo=express&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-25%20passing-2ea44f">
</p>

> **Sandbox / test mode only.** No real funds move. The "checkout" simulates the
> customer's success or failure outcome.

---

## Screenshots

| Analytics (dark) | Hosted checkout |
| --- | --- |
| ![Analytics](docs/screenshots/analytics-dark.png) | ![Checkout](docs/screenshots/checkout.png) |

| Payments | Webhooks & delivery log |
| --- | --- |
| ![Payments](docs/screenshots/payments.png) | ![Webhooks](docs/screenshots/webhooks.png) |

> Screenshots live in [`docs/screenshots/`](docs/screenshots/)

---

## Features

**Core**
- Email/password auth with **JWT** sessions (bcrypt-hashed passwords)
- **API keys** — `sk_test_` secret keys shown once and stored **SHA-256 hashed**; revocable
- **Payments** — created via the API with money stored as **integer minor units**
- **Hosted checkout** — a public page that drives a payment through a **state machine**
- Transaction list + payment status updates

**Developer-grade**
- **Idempotency** — `Idempotency-Key` header; replays return the original payment (race-safe)
- **Webhooks** — endpoint management + **HMAC-SHA256 signed** delivery on
  `payment.succeeded` / `payment.failed`, with a delivery log, **exponential-backoff
  retries**, and a manual retry
- **Rate limiting** — per-API-key buckets on `/v1`
- **OpenAPI 3** spec at `/openapi.json` with **Swagger UI** at `/docs`

**Polish**
- Dashboard **analytics** — success rate, captured volume, and 30-day charts
- **Dark mode** with a persisted theme toggle
- Tenant isolation (a merchant only ever sees its own data), centralized error
  middleware, structured request logging, and database seeding

---

## Architecture

![Architecture](docs/architecture.svg)

A pnpm monorepo with two apps and two shared packages:

```
paybridge/
├── apps/
│   ├── api/        Express + TypeScript REST API (the product)
│   └── web/        Next.js dashboard + hosted checkout
└── packages/
    ├── db/         Prisma schema, client, migrations, seed
    └── shared/     Zod schemas, key hashing, webhook signing, money/ID utils
```

Two **distinct auth domains** keep the surfaces clean:

| Path | Auth | Used by |
| --- | --- | --- |
| `/auth/*` | public | login / register (issues JWT) |
| `/dashboard/*` | **JWT** | the merchant dashboard |
| `/v1/*` | **API key** (`Bearer sk_test_…`) | programmatic/developer access |
| `/checkout/*`, `/docs` | public | customer checkout, API docs |

---

## Tech stack

| Layer | Choices |
| --- | --- |
| Language | TypeScript everywhere |
| API | Express, Zod, JWT, bcrypt, pino, express-rate-limit, swagger-ui-express |
| Database | PostgreSQL + Prisma |
| Web | Next.js (App Router), shadcn/ui, TanStack Query + Table, React Hook Form, Recharts |
| Tooling | pnpm workspaces, Vitest + supertest |

---

## Getting started

### Prerequisites
- Node ≥ 20 and **pnpm**
- A local **PostgreSQL** instance

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Adjust `DATABASE_URL` if needed. Defaults assume Postgres on
`127.0.0.1:5432` with user/password `postgres`:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/paybridge?schema=public"
JWT_SECRET="change-me-to-a-long-random-string"
DEFAULT_CURRENCY="MYR"
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### 3. Set up the database

```bash
# create the database first if it doesn't exist, e.g.
createdb paybridge

pnpm db:migrate     # apply migrations
pnpm db:seed        # demo merchant + ~55 sample payments across 30 days
```

### 4. Run both apps

```bash
pnpm dev:api        # http://localhost:4000   (API + Swagger at /docs)
pnpm dev:web        # http://localhost:3000   (dashboard + checkout)
```

### Demo credentials

```
email:    demo@paybridge.dev
password: password123
```

---

## Using the API

Authenticate with a secret API key (create one in the dashboard, or use the one the
seed prints). Amounts are **integer minor units**.

```bash
# Create a payment (idempotent)
curl -X POST http://localhost:4000/v1/payments \
  -H "Authorization: Bearer sk_test_..." \
  -H "Idempotency-Key: order-1001" \
  -H "Content-Type: application/json" \
  -d '{"amount": 4990, "currency": "MYR", "description": "Pro plan"}'
```

Full interactive reference: **http://localhost:4000/docs**.

### Verifying a webhook signature

Each delivery includes a `PayBridge-Signature: t=<unix>,v1=<hex>` header. The signature
is `HMAC-SHA256(signingSecret, "<t>.<rawBody>")`:

```ts
import crypto from "node:crypto";

function verify(rawBody: string, header: string, secret: string): boolean {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

---

## Testing

```bash
pnpm --filter @paybridge/api test
```

25 integration tests (Vitest + supertest) run against a dedicated `paybridge_test`
database that is auto-provisioned and reset between tests — covering auth, API-key
lifecycle, payment creation, **idempotency (including a concurrent race)**, the checkout
state machine, tenant isolation, and **webhook signing + delivery + retry**.

---

## Notable design decisions

- **Money is never a float** — integer minor units (cents) with an ISO-4217 currency.
- **Idempotency at the database layer** — a `@@unique([merchantId, idempotencyKey])`
  constraint backs the replay logic, so concurrent requests collapse to one payment.
- **Secrets are hashed at rest** — API keys are SHA-256 hashed (high-entropy tokens);
  passwords use bcrypt.
- **Webhook retries are in-process** with exponential backoff — a production system
  would swap in a durable queue; the boundary is intentionally small.

---

## License

MIT — it's a sandbox; build on it freely.

Built for learning and portfolio practice by syahmidev
