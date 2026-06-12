"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { usePayments } from "@/lib/queries";

export default function OverviewPage() {
  const { merchant } = useAuth();
  const { data, isLoading } = usePayments();
  const payments = data?.data ?? [];

  const succeeded = payments.filter((p) => p.status === "succeeded");
  const volumeByCurrency = succeeded.reduce<Record<string, number>>((acc, p) => {
    acc[p.currency] = (acc[p.currency] ?? 0) + p.amount;
    return acc;
  }, {});
  const volumeLabel =
    Object.entries(volumeByCurrency)
      .map(([cur, amt]) => formatMoney(amt, cur))
      .join(" · ") || "—";

  const stats = [
    { label: "Total payments", value: isLoading ? "…" : payments.length },
    { label: "Succeeded", value: isLoading ? "…" : succeeded.length },
    { label: "Captured volume", value: isLoading ? "…" : volumeLabel },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {merchant?.name}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s a snapshot of your sandbox activity.
          </p>
        </div>
        <Button render={<Link href="/dashboard/payments" />} nativeButton={false}>
          View payments
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
          <CardDescription>
            Create a secret API key, then create a payment from the API or the
            Payments page and complete it on the hosted checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            render={<Link href="/dashboard/api-keys" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            Create API key
          </Button>
          <Button
            render={<Link href="/dashboard/payments" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            Create payment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
