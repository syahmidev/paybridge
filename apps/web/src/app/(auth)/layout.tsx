import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        Pay<span className="text-muted-foreground">Bridge</span>
      </Link>
      {children}
    </div>
  );
}
