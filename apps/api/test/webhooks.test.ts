import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  buildSignatureHeader,
  verifySignature,
} from "@paybridge/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

// --- helpers ---

async function registerMerchant() {
  const email = `wh.${Date.now()}.${Math.random()}@test.dev`;
  const res = await request(app)
    .post("/auth/register")
    .send({ email, password: "supersecret", name: "Webhook Merchant" });
  return res.body.token as string;
}

async function makePaymentAndCheckout(token: string, outcome: "succeed" | "fail") {
  const keyRes = await request(app)
    .post("/dashboard/api-keys")
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "secret" });
  const key = keyRes.body.key as string;

  const payRes = await request(app)
    .post("/v1/payments")
    .set("Authorization", `Bearer ${key}`)
    .send({ amount: 4990, currency: "MYR" });
  const id = payRes.body.id as string;

  await request(app).post(`/checkout/${id}`).send({ outcome });
  return id;
}

interface Receiver {
  url: string;
  received: Promise<{ headers: http.IncomingHttpHeaders; body: string }>;
  close: () => void;
}

function startReceiver(): Promise<Receiver> {
  return new Promise((resolve) => {
    let resolveReq: (v: { headers: http.IncomingHttpHeaders; body: string }) => void;
    const received = new Promise<{ headers: http.IncomingHttpHeaders; body: string }>(
      (r) => (resolveReq = r),
    );
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        resolveReq({ headers: req.headers, body });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}/`,
        received,
        close: () => server.close(),
      });
    });
  });
}

async function pollDelivery(
  token: string,
  predicate: (d: { status: string; attempts: number }) => boolean,
  timeoutMs = 10_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request(app)
      .get("/dashboard/webhook-deliveries")
      .set("Authorization", `Bearer ${token}`);
    const match = res.body.data.find(predicate);
    if (match) return match;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("delivery did not reach expected state in time");
}

// --- signing (unit) ---

describe("webhook signing", () => {
  it("round-trips a signature it produced", () => {
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({ hello: "world" });
    const header = buildSignatureHeader(secret, payload);
    expect(verifySignature(secret, header, payload)).toBe(true);
  });

  it("rejects a tampered payload or wrong secret", () => {
    const payload = JSON.stringify({ amount: 100 });
    const header = buildSignatureHeader("whsec_a", payload);
    expect(verifySignature("whsec_a", header, '{"amount":999}')).toBe(false);
    expect(verifySignature("whsec_b", header, payload)).toBe(false);
  });
});

// --- endpoint CRUD ---

describe("webhook endpoints", () => {
  it("creates, lists, toggles, and deletes endpoints", async () => {
    const token = await registerMerchant();

    const create = await request(app)
      .post("/dashboard/webhook-endpoints")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com/hook" });
    expect(create.status).toBe(201);
    expect(create.body.signingSecret).toMatch(/^whsec_/);
    const id = create.body.id as string;

    const list = await request(app)
      .get("/dashboard/webhook-endpoints")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);

    const patch = await request(app)
      .patch(`/dashboard/webhook-endpoints/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: false });
    expect(patch.body.enabled).toBe(false);

    const del = await request(app)
      .delete(`/dashboard/webhook-endpoints/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  it("rejects an invalid URL with 400", async () => {
    const token = await registerMerchant();
    const res = await request(app)
      .post("/dashboard/webhook-endpoints")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "not-a-url" });
    expect(res.status).toBe(400);
  });
});

// --- delivery ---

describe("webhook delivery", () => {
  it("delivers a signed payment.succeeded event to the endpoint", async () => {
    const token = await registerMerchant();
    const receiver = await startReceiver();
    try {
      const create = await request(app)
        .post("/dashboard/webhook-endpoints")
        .set("Authorization", `Bearer ${token}`)
        .send({ url: receiver.url });
      const signingSecret = create.body.signingSecret as string;

      const paymentId = await makePaymentAndCheckout(token, "succeed");

      const { headers, body } = await receiver.received;
      const sigHeader = headers["paybridge-signature"] as string;
      expect(sigHeader).toBeTruthy();
      expect(verifySignature(signingSecret, sigHeader, body)).toBe(true);

      const event = JSON.parse(body);
      expect(event.type).toBe("payment.succeeded");
      expect(event.data.object.id).toBe(paymentId);

      const delivery = await pollDelivery(token, (d) => d.status === "succeeded");
      expect(delivery.responseStatus).toBe(200);
      expect(delivery.attempts).toBe(1);
    } finally {
      receiver.close();
    }
  });

  it("records a failed attempt and supports manual retry", async () => {
    const token = await registerMerchant();
    // Closed port -> connection refused, fast failure.
    const create = await request(app)
      .post("/dashboard/webhook-endpoints")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "http://127.0.0.1:1/hook" });
    expect(create.status).toBe(201);

    await makePaymentAndCheckout(token, "fail");

    const delivery = await pollDelivery(token, (d) => d.attempts >= 1);
    expect(delivery.status).not.toBe("succeeded");
    expect(delivery.error).toBeTruthy();

    const retry = await request(app)
      .post(`/dashboard/webhook-deliveries/${delivery.id}/retry`)
      .set("Authorization", `Bearer ${token}`);
    expect(retry.status).toBe(200);
    expect(retry.body.attempts).toBeGreaterThan(delivery.attempts);
  });

  it("does not deliver to a disabled endpoint", async () => {
    const token = await registerMerchant();
    const receiver = await startReceiver();
    try {
      await request(app)
        .post("/dashboard/webhook-endpoints")
        .set("Authorization", `Bearer ${token}`)
        .send({ url: receiver.url, enabled: false });

      await makePaymentAndCheckout(token, "succeed");

      // Give any (incorrect) delivery a chance to fire, then assert none exist.
      await new Promise((r) => setTimeout(r, 500));
      const list = await request(app)
        .get("/dashboard/webhook-deliveries")
        .set("Authorization", `Bearer ${token}`);
      expect(list.body.data).toHaveLength(0);
    } finally {
      receiver.close();
    }
  });
});
