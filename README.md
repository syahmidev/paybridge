# PayBridge

**A developer-focused payment gateway sandbox.** Register as a merchant, generate API
keys, create payments, send customers to a hosted checkout, and receive **signed
webhooks** — a Stripe-style flow you can build against without touching real money.

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

## Preview

| Analytics (dark) | Hosted checkout |
| --- | --- |
| ![Analytics](docs/screenshots/analytics-dark.png) | ![Checkout](docs/screenshots/checkout.png) |

| Payments | Webhooks & delivery log |
| --- | --- |
| ![Payments](docs/screenshots/payments.png) | ![Webhooks](docs/screenshots/webhooks.png) |

---

## About

PayBridge is a **portfolio project** that recreates the core of a Stripe-style payment
gateway so I could practice **production-minded backend engineering** end to end.

A merchant signs up, generates API keys, and creates payments through a documented REST
API. Customers complete (or fail) those payments on a hosted checkout page, and the
merchant's server is notified through **HMAC-signed webhooks** with automatic retries.
The whole thing runs in test mode — no real money — so the focus is the *engineering*:
idempotency, a payment state machine, two separate auth models, rate limiting, and a
fully tested API.

It's built as a **pnpm monorepo** (Express API + Next.js dashboard + shared packages) in
TypeScript throughout.

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

## Tech Stack

| Layer | Choices |
| --- | --- |
| Language | TypeScript everywhere |
| API | Express, Zod, JWT, bcrypt, pino, express-rate-limit, swagger-ui-express |
| Database | PostgreSQL + Prisma |
| Web | Next.js (App Router), shadcn/ui, TanStack Query + Table, React Hook Form, Recharts |
| Tooling | pnpm workspaces, Vitest + supertest |

---

## System Flow

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

**End-to-end payment lifecycle:**

1. Merchant creates a payment via `POST /v1/payments` (status `requires_payment_method`).
2. The customer is sent to the hosted checkout at `/checkout/:id`.
3. The customer chooses an outcome → the API validates the **state machine** transition and
   updates the payment to `succeeded` / `failed`.
4. The API **fires a signed webhook** to every enabled endpoint (fire-and-forget), recording
   each attempt and retrying failures with exponential backoff.
5. The merchant's server **verifies the signature** and reacts; the dashboard reflects the
   new status and analytics.

---

## Database Overview

PostgreSQL via Prisma. Five tables, all owned by a `Merchant` (cascade on delete):

| Model | Purpose | Key fields |
| --- | --- | --- |
| **Merchant** | a registered shop / account | `email` (unique), `passwordHash` (bcrypt), `name` |
| **ApiKey** | programmatic credential | `keyHash` (SHA-256, unique), `prefix`, `type`, `revokedAt` |
| **Payment** | a payment request | `amount` (**integer minor units**), `currency`, `status` (enum), `idempotencyKey` |
| **WebhookEndpoint** | a merchant's webhook URL | `url`, `signingSecret` (`whsec_…`), `enabled` |
| **WebhookDelivery** | one delivery attempt log | `eventType`, `payload`, `status`, `attempts`, `responseStatus`, `nextRetryAt` |

Notable constraints:
- `Payment` has a composite unique index `@@unique([merchantId, idempotencyKey])` — this is
  what makes idempotent creates **race-safe at the database level**.
- `ApiKey.keyHash` is unique and indexed — API-key auth is a single hashed lookup.
- A `Merchant` has many `ApiKey`, `Payment`, and `WebhookEndpoint`; an endpoint has many
  `WebhookDelivery`.

Schema lives in [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma).

---

## API Endpoints

### Public
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a merchant, returns a JWT |
| `POST` | `/auth/login` | Log in, returns a JWT |
| `GET` | `/checkout/:id` | Hosted-checkout details for a payment |
| `POST` | `/checkout/:id` | Submit the checkout outcome (`succeed` / `fail`) |
| `GET` | `/health` | Liveness probe |
| `GET` | `/openapi.json` · `/docs` | OpenAPI spec + Swagger UI |

### Dashboard — JWT (`Authorization: Bearer <jwt>`)
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/dashboard/me` | Current merchant |
| `GET` `POST` | `/dashboard/api-keys` | List / create API keys (secret shown once) |
| `DELETE` | `/dashboard/api-keys/:id` | Revoke a key |
| `GET` `POST` | `/dashboard/payments` | List / create payments (UI path) |
| `GET` | `/dashboard/payments/:id` | Retrieve a payment |
| `GET` `POST` | `/dashboard/webhook-endpoints` | List / create endpoints |
| `PATCH` `DELETE` | `/dashboard/webhook-endpoints/:id` | Update / delete an endpoint |
| `GET` | `/dashboard/webhook-deliveries` | Recent delivery log |
| `POST` | `/dashboard/webhook-deliveries/:id/retry` | Manually retry a delivery |
| `GET` | `/dashboard/analytics` | Summary, status breakdown, 30-day series |

### Programmatic — API key (`Authorization: Bearer sk_test_…`)
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/v1/account` | The authenticated account |
| `POST` | `/v1/payments` | Create a payment (supports `Idempotency-Key`) |
| `GET` | `/v1/payments` | List payments |
| `GET` | `/v1/payments/:id` | Retrieve a payment |

**Example — create a payment (idempotent).** Amounts are **integer minor units**:

```bash
curl -X POST http://localhost:4000/v1/payments \
  -H "Authorization: Bearer sk_test_..." \
  -H "Idempotency-Key: order-1001" \
  -H "Content-Type: application/json" \
  -d '{"amount": 4990, "currency": "MYR", "description": "Pro plan"}'
```

Full interactive reference: **http://localhost:4000/docs**.

**Verifying a webhook signature.** Each delivery includes a
`PayBridge-Signature: t=<unix>,v1=<hex>` header, where the signature is
`HMAC-SHA256(signingSecret, "<t>.<rawBody>")`:

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

## Getting Started

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

### Run the tests

```bash
pnpm --filter @paybridge/api test
```

25 integration tests (Vitest + supertest) run against a dedicated `paybridge_test`
database that is auto-provisioned and reset between tests — covering auth, API-key
lifecycle, payment creation, **idempotency (including a concurrent race)**, the checkout
state machine, tenant isolation, and **webhook signing + delivery + retry**.

---

## What I Learned

- **Idempotency is a database problem, not just an app problem.** An in-code "check then
  create" still has a race window; backing it with a `@@unique` constraint and handling the
  unique-violation error is what actually makes retries safe.
- **Money should never be a float.** Storing integer minor units (cents) and only formatting
  for display avoids an entire class of rounding bugs.
- **Separate auth models for separate audiences.** A browser dashboard (JWT sessions) and a
  programmatic API (hashed API keys) have different needs — keeping them on distinct route
  prefixes prevented a real bug where one guard leaked onto the other's routes.
- **Webhooks need signing and retries to be trustworthy.** HMAC signatures let receivers
  verify authenticity, and exponential-backoff retries handle the reality that the receiver
  is sometimes down.
- **A state machine makes status changes safe.** Encoding the allowed transitions in one
  place rejects impossible/duplicate state changes cleanly.
- **Tests are easier when the app is constructed, not started.** Building the Express app in
  a function let me run the full suite with supertest against a throwaway database without
  opening a port.
- **Secrets are hashed at rest** — fast SHA-256 for high-entropy API keys, slow bcrypt for
  human passwords — and never logged or returned after creation.

---

## Future Improvements

- **Durable webhook queue** (e.g. Redis + BullMQ) so retries survive a server restart —
  the current in-process timers are an intentional sandbox shortcut.
- **Refunds and partial captures**, plus a richer set of webhook event types.
- **Cursor-based pagination** on list endpoints for large datasets.
- **Team accounts / RBAC** — invite members and add an admin role across merchants.
- **Redis-backed rate limiting** so limits hold across multiple API instances.
- **CI + deployment** — GitHub Actions for lint/typecheck/test, and a Docker Compose /
  hosted deploy.
- **Observability** — request metrics, tracing, and a webhook delivery dashboard with
  filtering.
- **Generate the OpenAPI spec from the Zod schemas** to keep docs and validation in sync.

---

## License

Built for learning and portfolio purposes by [syahmidev](https://www.syahmidev.com).
