import { notFound } from "next/navigation";
import { findSymbol } from "@/lib/catalog";
import { fetchQuote } from "@/lib/providers";
import { messages } from "@/lib/messages/es-AR";
import { formatArs, formatPct, formatTimestamp } from "@/lib/format";

export const revalidate = 30;

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function TickerPage({ params }: PageProps) {
  const { symbol: symbolParam } = await params;
  const symbol = decodeURIComponent(symbolParam).toUpperCase();

  const meta = findSymbol(symbol);
  if (!meta) {
    notFound();
  }

  let quote: Awaited<ReturnType<typeof fetchQuote>> | null = null;
  let errorMessage: string | null = null;
  try {
    quote = await fetchQuote(symbol);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const changePct = quote ? quote.change / quote.previousClose : null;
  const positive = changePct !== null && changePct >= 0;

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">
            {meta.symbol}
          </h1>
          <p className="text-sm text-[hsl(var(--muted-fg))]">{meta.name}</p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide text-[hsl(var(--muted-fg))]">
          {meta.market}
        </span>
      </div>

      {quote ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="surface rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-fg))]">
              {messages.ticker.lastPrice}
            </div>
            <div className="mt-1 font-mono text-3xl">
              {formatArs(quote.last)}
            </div>
            <div
              className="mt-1 font-mono text-sm"
              style={{
                color: `hsl(var(--${positive ? "positive" : "negative"}))`,
              }}
            >
              {positive ? "▲" : "▼"} {formatArs(quote.change)} (
              {formatPct(changePct ?? 0)})
            </div>
          </div>
          <div className="surface rounded-xl border p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-[hsl(var(--muted-fg))]">
                {messages.ticker.previousClose}
              </dt>
              <dd className="font-mono">{formatArs(quote.previousClose)}</dd>
              <dt className="text-[hsl(var(--muted-fg))]">
                {messages.ticker.open}
              </dt>
              <dd className="font-mono">{formatArs(quote.open)}</dd>
              <dt className="text-[hsl(var(--muted-fg))]">
                {messages.ticker.dayRange}
              </dt>
              <dd className="font-mono">
                {formatArs(quote.dayLow)} – {formatArs(quote.dayHigh)}
              </dd>
              <dt className="text-[hsl(var(--muted-fg))]">
                {messages.ticker.volume}
              </dt>
              <dd className="font-mono">{quote.volume.toLocaleString("es-AR")}</dd>
              <dt className="text-[hsl(var(--muted-fg))]">
                {messages.ticker.asOf}
              </dt>
              <dd className="font-mono text-xs">
                {formatTimestamp(quote.timestamp)}
              </dd>
              <dt className="text-[hsl(var(--muted-fg))]">
                {messages.ticker.source}
              </dt>
              <dd className="font-mono text-xs uppercase">{quote.source}</dd>
            </dl>
          </div>
          <div className="sm:col-span-2 rounded-xl border p-4">
            <h2 className="text-xs uppercase tracking-wide text-[hsl(var(--muted-fg))]">
              {messages.ticker.fundamentalsStub}
            </h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-fg))]">
              {messages.ticker.fundamentalsCopy}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-[hsl(var(--negative))] p-4 text-sm">
          <div className="font-medium">{messages.ticker.fetchErrorTitle}</div>
          <div className="mt-1 text-[hsl(var(--muted-fg))]">
            {errorMessage ?? messages.ticker.fetchErrorFallback}
          </div>
        </div>
      )}
    </section>
  );
}
