import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

// --- helpers ---

let counter = 0;
function uniqueEmail() {
  counter += 1;
  return `merchant${counter}.${Date.now()}@test.dev`;
}

async function registerMerchant() {
  const email = uniqueEmail();
  const res = await request(app)
    .post("/auth/register")
    .send({ email, password: "supersecret", name: "Test Merchant" });
  expect(res.status).toBe(201);
  return { email, token: res.body.token as string, merchant: res.body.merchant };
}

async function createSecretKey(token: string) {
  const res = await request(app)
    .post("/dashboard/api-keys")
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "secret" });
  expect(res.status).toBe(201);
  return res.body.key as string;
}

async function createPayment(secretKey: string, body: object, idemKey?: string) {
  const req = request(app)
    .post("/v1/payments")
    .set("Authorization", `Bearer ${secretKey}`);
  if (idemKey) req.set("Idempotency-Key", idemKey);
  return req.send(body);
}

beforeAll(() => {
  // Surface a clear failure if the app failed to construct.
  expect(typeof app).toBe("function");
});

describe("health", () => {
  it("responds ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("auth", () => {
  it("registers a merchant and returns a token", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: uniqueEmail(), password: "supersecret", name: "Acme" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.merchant.name).toBe("Acme");
  });

  it("rejects duplicate emails with 409", async () => {
    const email = uniqueEmail();
    await request(app)
      .post("/auth/register")
      .send({ email, password: "supersecret", name: "Acme" });
    const res = await request(app)
      .post("/auth/register")
      .send({ email, password: "supersecret", name: "Acme" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("email_taken");
  });

  it("validates input with 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "x", name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe("invalid_request_error");
    expect(res.body.error.param).toBeTruthy();
  });

  it("logs in with valid credentials", async () => {
    const { email } = await registerMerchant();
    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "supersecret" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects a wrong password with 401", async () => {
    const { email } = await registerMerchant();
    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "WRONG" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("invalid_credentials");
  });

  it("requires a JWT for /dashboard/me", async () => {
    const noAuth = await request(app).get("/dashboard/me");
    expect(noAuth.status).toBe(401);

    const { token, email } = await registerMerchant();
    const ok = await request(app)
      .get("/dashboard/me")
      .set("Authorization", `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.merchant.email).toBe(email);
  });
});

describe("api keys", () => {
  it("creates a key (plaintext shown once) and never leaks it on list", async () => {
    const { token } = await registerMerchant();
    const create = await request(app)
      .post("/dashboard/api-keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "secret" });
    expect(create.status).toBe(201);
    expect(create.body.key).toMatch(/^sk_test_/);

    const list = await request(app)
      .get("/dashboard/api-keys")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const listed = list.body.data[0];
    expect(listed.key).toBeUndefined();
    expect(listed.keyHash).toBeUndefined();
    expect(listed.prefix).toMatch(/^sk_test_/);
  });

  it("rejects a revoked key on /v1", async () => {
    const { token } = await registerMerchant();
    const create = await request(app)
      .post("/dashboard/api-keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "secret" });
    const keyId = create.body.id as string;
    const plaintext = create.body.key as string;

    const before = await request(app)
      .get("/v1/account")
      .set("Authorization", `Bearer ${plaintext}`);
    expect(before.status).toBe(200);

    const revoke = await request(app)
      .delete(`/dashboard/api-keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(revoke.status).toBe(204);

    const after = await request(app)
      .get("/v1/account")
      .set("Authorization", `Bearer ${plaintext}`);
    expect(after.status).toBe(401);
  });
});

describe("payments", () => {
  it("creates a payment and normalizes the currency", async () => {
    const { token } = await registerMerchant();
    const key = await createSecretKey(token);
    const res = await createPayment(key, {
      amount: 4990,
      currency: "myr",
      description: "Order #1",
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(4990);
    expect(res.body.currency).toBe("MYR");
    expect(res.body.status).toBe("requires_payment_method");
  });

  it("rejects a non-positive amount with 400", async () => {
    const { token } = await registerMerchant();
    const key = await createSecretKey(token);
    const res = await createPayment(key, { amount: -1, currency: "MYR" });
    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe("invalid_request_error");
  });

  it("rejects requests without a secret key", async () => {
    const res = await request(app)
      .post("/v1/payments")
      .send({ amount: 100, currency: "MYR" });
    expect(res.status).toBe(401);
  });
});

describe("idempotency", () => {
  it("returns the same payment for a repeated Idempotency-Key", async () => {
    const { token } = await registerMerchant();
    const key = await createSecretKey(token);

    const first = await createPayment(
      key,
      { amount: 2500, currency: "MYR" },
      "idem-key-1",
    );
    expect(first.status).toBe(201);

    const second = await createPayment(
      key,
      { amount: 2500, currency: "MYR" },
      "idem-key-1",
    );
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    // Only one payment actually exists for this merchant.
    const list = await request(app)
      .get("/v1/payments")
      .set("Authorization", `Bearer ${key}`);
    expect(list.body.data).toHaveLength(1);
  });

  it("creates distinct payments for different keys", async () => {
    const { token } = await registerMerchant();
    const key = await createSecretKey(token);
    const a = await createPayment(key, { amount: 100, currency: "MYR" }, "a");
    const b = await createPayment(key, { amount: 100, currency: "MYR" }, "b");
    expect(a.body.id).not.toBe(b.body.id);
  });

  it("handles concurrent requests with the same key", async () => {
    const { token } = await registerMerchant();
    const key = await createSecretKey(token);
    const [r1, r2] = await Promise.all([
      createPayment(key, { amount: 700, currency: "MYR" }, "race"),
      createPayment(key, { amount: 700, currency: "MYR" }, "race"),
    ]);
    expect(r1.body.id).toBe(r2.body.id);
    const list = await request(app)
      .get("/v1/payments")
      .set("Authorization", `Bearer ${key}`);
    expect(list.body.data).toHaveLength(1);
  });
});

describe("checkout + state machine", () => {
  it("drives a payment to succeeded and blocks re-finalization", async () => {
    const { token } = await registerMerchant();
    const key = await createSecretKey(token);
    const created = await createPayment(key, {
      amount: 1999,
      currency: "MYR",
      description: "Checkout test",
    });
    const id = created.body.id as string;

    const view = await request(app).get(`/checkout/${id}`);
    expect(view.status).toBe(200);
    expect(view.body.merchantName).toBe("Test Merchant");

    const pay = await request(app)
      .post(`/checkout/${id}`)
      .send({ outcome: "succeed" });
    expect(pay.status).toBe(200);
    expect(pay.body.status).toBe("succeeded");

    const again = await request(app)
      .post(`/checkout/${id}`)
      .send({ outcome: "fail" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("payment_already_finalized");
  });

  it("supports a failed outcome", async () => {
    const { token } = await registerMerchant();
    const key = await createSecretKey(token);
    const created = await createPayment(key, { amount: 500, currency: "MYR" });
    const res = await request(app)
      .post(`/checkout/${created.body.id}`)
      .send({ outcome: "fail" });
    expect(res.body.status).toBe("failed");
  });
});

describe("tenant isolation", () => {
  it("does not let a merchant read another merchant's payment", async () => {
    const a = await registerMerchant();
    const aKey = await createSecretKey(a.token);
    const created = await createPayment(aKey, { amount: 100, currency: "MYR" });
    const paymentId = created.body.id as string;

    const b = await registerMerchant();
    const bKey = await createSecretKey(b.token);

    const res = await request(app)
      .get(`/v1/payments/${paymentId}`)
      .set("Authorization", `Bearer ${bKey}`);
    expect(res.status).toBe(404);
  });
});
