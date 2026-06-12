import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <span className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        Sandbox · test mode only
      </span>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl font-heading">
        A payment gateway sandbox for developers
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted-foreground">
        Generate API keys, create payments, send customers to a hosted checkout,
        and receive signed webhooks — a Stripe-style flow you can build against
        without touching real money.
      </p>
      <div className="mt-8 flex gap-3">
        <Button render={<Link href="/register" />} nativeButton={false} size="lg">
          Get started
        </Button>
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          size="lg"
          variant="outline"
        >
          Sign in
        </Button>
      </div>
      <div className="mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["API keys", "Issue and revoke test-mode secret keys."],
          ["Payments", "Create payments with idempotency built in."],
          ["Hosted checkout", "Drive payments to success or failure."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border p-4 text-left">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
