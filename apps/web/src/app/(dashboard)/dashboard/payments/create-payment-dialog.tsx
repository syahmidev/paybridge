"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePayment } from "@/lib/queries";

// The form takes a major-unit amount for humans; we convert to minor units.
const schema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  currency: z
    .string()
    .length(3, "3-letter code")
    .transform((s) => s.toUpperCase()),
  description: z.string().max(500).optional(),
});
type Values = z.input<typeof schema>;

export function CreatePaymentDialog() {
  const [open, setOpen] = useState(false);
  const createPayment = useCreatePayment();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currency: "MYR" },
  });

  async function onSubmit(raw: Values) {
    const values = schema.parse(raw);
    try {
      await createPayment.mutateAsync({
        amount: Math.round(values.amount * 100),
        currency: values.currency,
        description: values.description || undefined,
      });
      toast.success("Payment created");
      reset({ currency: "MYR" });
      setOpen(false);
    } catch {
      toast.error("Could not create payment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Create payment</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create payment</DialogTitle>
          <DialogDescription>
            Amount is entered in major units (e.g. 49.90) and stored as minor
            units.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="49.90"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} {...register("currency")} />
              {errors.currency && (
                <p className="text-sm text-destructive">
                  {errors.currency.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Pro plan — monthly"
              {...register("description")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createPayment.isPending}>
              {createPayment.isPending ? "Creating…" : "Create payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
