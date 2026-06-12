// Hand-written OpenAPI 3 spec for the programmatic /v1 API. Served as JSON at
// /openapi.json and rendered with Swagger UI at /docs.

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "PayBridge API",
    version: "1.0.0",
    description:
      "Developer payment gateway sandbox. Authenticate with a secret API key " +
      "(`Authorization: Bearer sk_test_...`). Amounts are integer minor units " +
      "(e.g. cents). Webhooks are signed with HMAC-SHA256; verify the " +
      "`PayBridge-Signature: t=<unix>,v1=<hex>` header against your endpoint's " +
      "signing secret over `<t>.<rawBody>`.",
  },
  servers: [{ url: "http://localhost:4000", description: "Local sandbox" }],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: { type: "http", scheme: "bearer", description: "Secret API key" },
    },
    schemas: {
      Payment: {
        type: "object",
        properties: {
          id: { type: "string", example: "pay_abc123" },
          object: { type: "string", example: "payment" },
          amount: { type: "integer", description: "Minor units", example: 4990 },
          currency: { type: "string", example: "MYR" },
          status: {
            type: "string",
            enum: [
              "requires_payment_method",
              "processing",
              "succeeded",
              "failed",
              "canceled",
            ],
          },
          description: { type: "string", nullable: true },
          metadata: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreatePayment: {
        type: "object",
        required: ["amount", "currency"],
        properties: {
          amount: { type: "integer", minimum: 1, example: 4990 },
          currency: { type: "string", minLength: 3, maxLength: 3, example: "MYR" },
          description: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              type: { type: "string" },
              code: { type: "string" },
              message: { type: "string" },
              param: { type: "string" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/v1/account": {
      get: {
        summary: "Retrieve the authenticated account",
        responses: {
          "200": { description: "Account details" },
          "401": {
            description: "Invalid API key",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/v1/payments": {
      post: {
        summary: "Create a payment",
        description:
          "Provide an `Idempotency-Key` header to safely retry: replaying the " +
          "same key returns the original payment instead of creating a duplicate.",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePayment" },
            },
          },
        },
        responses: {
          "201": {
            description: "Payment created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Payment" },
              },
            },
          },
          "200": {
            description: "Existing payment (idempotent replay)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Payment" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      get: {
        summary: "List payments",
        responses: {
          "200": {
            description: "A list of payments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Payment" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/payments/{id}": {
      get: {
        summary: "Retrieve a payment",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The payment",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Payment" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
} as const;
