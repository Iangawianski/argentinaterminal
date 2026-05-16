"use client";

import Link from "next/link";
import { messages } from "@/lib/messages/es-AR";
import { ThemeToggle } from "./theme-toggle";
import { PaletteTrigger } from "./command-palette";

export function TopBar() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold">
            {messages.app.name}
          </span>
          <span className="hidden text-xs text-[hsl(var(--muted-fg))] sm:inline">
            {messages.app.tagline}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <PaletteTrigger />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
