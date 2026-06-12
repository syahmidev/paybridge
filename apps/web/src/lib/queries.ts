"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ApiKey,
  CreatedApiKey,
  Payment,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/lib/types";

// --- API keys ---

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api<{ data: ApiKey[] }>("/dashboard/api-keys"),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: "secret" | "publishable") =>
      api<CreatedApiKey>("/dashboard/api-keys", {
        method: "POST",
        body: { type },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/dashboard/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

// --- Payments ---
// The dashboard reads payments via the JWT-authenticated /dashboard endpoint.

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: () => api<{ data: Payment[] }>("/dashboard/payments"),
  });
}

export interface CreatePaymentBody {
  amount: number;
  currency: string;
  description?: string;
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePaymentBody) =>
      api<Payment>("/dashboard/payments", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });
}

// --- Webhooks ---

export function useWebhookEndpoints() {
  return useQuery({
    queryKey: ["webhook-endpoints"],
    queryFn: () =>
      api<{ data: WebhookEndpoint[] }>("/dashboard/webhook-endpoints"),
  });
}

export function useCreateWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) =>
      api<WebhookEndpoint>("/dashboard/webhook-endpoints", {
        method: "POST",
        body: { url },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
  });
}

export function useUpdateWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api<WebhookEndpoint>(`/dashboard/webhook-endpoints/${id}`, {
        method: "PATCH",
        body: { enabled },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
  });
}

export function useDeleteWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/dashboard/webhook-endpoints/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
  });
}

export function useWebhookDeliveries() {
  return useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: () =>
      api<{ data: WebhookDelivery[] }>("/dashboard/webhook-deliveries"),
  });
}

export function useRetryDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<WebhookDelivery>(`/dashboard/webhook-deliveries/${id}/retry`, {
        method: "POST",
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["webhook-deliveries"] }),
  });
}
