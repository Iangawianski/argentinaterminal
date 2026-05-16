import Link from "next/link";
import { messages } from "@/lib/messages/es-AR";
import { SYMBOL_CATALOG } from "@/lib/catalog";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {messages.home.title}
      </h1>
      <p className="mt-3 text-[hsl(var(--muted-fg))]">
        {messages.home.subtitle}
      </p>

      <div className="mt-8 surface rounded-xl border p-4">
        <p className="text-sm text-[hsl(var(--muted-fg))]">
          {messages.home.paletteHint}
        </p>
        <kbd className="mt-3 inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
          Ctrl
          <span aria-hidden>+</span>K
        </kbd>
      </div>

      <h2 className="mt-12 text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-fg))]">
        {messages.home.symbolsHeader}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SYMBOL_CATALOG.slice(0, 9).map((s) => (
          <li key={s.symbol}>
            <Link
              href={`/ticker/${s.symbol.toLowerCase()}`}
              className="block rounded-md border px-3 py-2 hover:surface"
            >
              <div className="font-mono text-sm">{s.symbol}</div>
              <div className="text-xs text-[hsl(var(--muted-fg))]">
                {s.name}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
