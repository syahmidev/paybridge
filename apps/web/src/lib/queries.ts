"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiKey, CreatedApiKey, Payment } from "@/lib/types";

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
