"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { use } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { PaymentStatus } from "@/lib/types";

interface CheckoutData {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  status: PaymentStatus;
  merchantName: string;
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["checkout", id],
    queryFn: () => api<CheckoutData>(`/checkout/${id}`, { anonymous: true }),
  });

  const decide = useMutation({
    mutationFn: (outcome: "succeed" | "fail") =>
      api<{ status: PaymentStatus }>(`/checkout/${id}`, {
        method: "POST",
        body: { outcome },
        anonymous: true,
      }),
    onSuccess: () => refetch(),
  });

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        {isLoading && (
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading…
          </CardContent>
        )}

        {isError && (
          <CardContent className="py-12 text-center text-muted-foreground">
            Payment not found.
          </CardContent>
        )}

        {data && (
          <>
            <CardHeader>
              <CardDescription>{data.merchantName}</CardDescription>
              <CardTitle className="text-3xl">
                {formatMoney(data.amount, data.currency)}
              </CardTitle>
              {data.description && (
                <p className="text-sm text-muted-foreground">
                  {data.description}
                </p>
              )}
            </CardHeader>

            <CardContent>
              {data.status === "succeeded" && (
                <p className="rounded-md bg-muted p-4 text-center text-sm font-medium text-foreground">
                  ✓ Payment succeeded
                </p>
              )}
              {(data.status === "failed" || data.status === "canceled") && (
                <p className="rounded-md bg-muted p-4 text-center text-sm font-medium text-destructive">
                  ✕ Payment {data.status}
                </p>
              )}
              {data.status === "requires_payment_method" && (
                <p className="text-center text-sm text-muted-foreground">
                  This is a sandbox checkout. Choose an outcome to simulate the
                  customer&apos;s payment.
                </p>
              )}
            </CardContent>

            {data.status === "requires_payment_method" && (
              <CardFooter className="flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => decide.mutate("succeed")}
                  disabled={decide.isPending}
                >
                  Pay {formatMoney(data.amount, data.currency)}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => decide.mutate("fail")}
                  disabled={decide.isPending}
                >
                  Simulate failure
                </Button>
              </CardFooter>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
