"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { messages } from "@/lib/messages/es-AR";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label={messages.topBar.themeToggle}
        className="rounded-md border px-2 py-1 text-xs text-[hsl(var(--muted-fg))]"
      >
        ·
      </button>
    );
  }

  const current = theme === "system" ? resolvedTheme : theme;
  const next = current === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={messages.topBar.themeToggle}
      className="rounded-md border px-2 py-1 text-xs hover:surface"
    >
      {current === "dark" ? "☾" : "☀"}
    </button>
  );
}
