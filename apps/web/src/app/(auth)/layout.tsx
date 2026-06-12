import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        Pay<span className="text-muted-foreground">Bridge</span>
      </Link>
      {children}
    </div>
  );
}
