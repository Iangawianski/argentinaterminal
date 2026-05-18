"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Search, Sun } from "lucide-react";

import { useCommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function CommandTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition",
        "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
      )}
    >
      <Search className="h-4 w-4" aria-hidden />
      <span>Buscar ticker, vista o comando…</span>
      <kbd className="ml-2 hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
        Ctrl+K
      </kbd>
    </button>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span>ArgentinaTerminal</span>
        </Link>
        <div className="flex flex-1 justify-end gap-2 sm:flex-none sm:justify-center">
          <CommandTrigger />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
