"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Toggles between light and dark. Resolves the active theme (handling "system")
// so the icon and the next theme are always correct.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid a hydration mismatch — render a stable placeholder until mounted.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  function toggle() {
    // Fall back to the DOM if next-themes hasn't resolved yet, so the very
    // first click always toggles in the right direction.
    const currentlyDark =
      resolvedTheme === "dark" ||
      (resolvedTheme === undefined &&
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark"));
    setTheme(currentlyDark ? "light" : "dark");
  }

  return (
    <Button variant="outline" size="icon" aria-label="Toggle theme" onClick={toggle}>
      {mounted && isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
