"use client";

import { useQuery } from "@tanstack/react-query";

import type { FxKey, FxQuote } from "@/lib/fx";
import { formatNumber } from "@/lib/utils";

interface FxResponse {
  quotes: FxQuote[];
  asOf: string;
}

async function fetchFx(): Promise<FxResponse> {
  const res = await fetch("/api/fx", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as FxResponse;
}

interface FxBoardProps {
  initialData?: FxResponse;
}

const KEY_DESCRIPTIONS: Record<FxKey, string> = {
  oficial: "Tipo de cambio minorista del BNA.",
  mayorista: "Interbancario / referencia BCRA A3500.",
  blue: "Mercado informal de efectivo.",
  mep: "AL30 / AL30D — bolsa local.",
  ccl: "Contado con liquidación — transferencia al exterior.",
};

export function FxBoard({ initialData }: FxBoardProps) {
  const query = useQuery<FxResponse, Error>({
    queryKey: ["fx", "all"],
    queryFn: fetchFx,
    initialData,
    refetchInterval: 30_000,
  });

  const quotes = query.data?.quotes ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">FX paralelo</h1>
          <p className="text-sm text-muted-foreground">
            Cinco cotizaciones del dólar relevantes para el inversor argentino. Actualiza cada 30s.
          </p>
        </div>
        <FreshnessTag query={query} />
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.map((q) => (
          <li key={q.key}>
            <FxCard quote={q} />
          </li>
        ))}
      </ul>

      {query.isError ? (
        <div className="rounded-md border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          No se pudo obtener FX: {query.error.message}
        </div>
      ) : null}
    </div>
  );
}

function FxCard({ quote }: { quote: FxQuote }) {
  const spread =
    quote.bid !== null && quote.ask !== 0 ? ((quote.ask - quote.bid) / quote.ask) * 100 : null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Dólar {quote.label}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {quote.source}
        </p>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
        ${formatNumber(quote.ask, 2)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <dt>Compra</dt>
        <dd className="text-right text-foreground tabular-nums">
          {quote.bid === null ? "—" : `$${formatNumber(quote.bid, 2)}`}
        </dd>
        <dt>Venta</dt>
        <dd className="text-right text-foreground tabular-nums">
          ${formatNumber(quote.ask, 2)}
        </dd>
        <dt>Spread</dt>
        <dd className="text-right text-foreground tabular-nums">
          {spread === null ? "—" : `${spread.toFixed(2)}%`}
        </dd>
      </dl>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        {KEY_DESCRIPTIONS[quote.key]}
      </p>
    </div>
  );
}

function FreshnessTag({ query }: { query: ReturnType<typeof useQuery<FxResponse, Error>> }) {
  const asOf = query.data?.asOf;
  return (
    <div className="text-right text-xs text-muted-foreground">
      {query.isFetching ? (
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> live
        </span>
      ) : asOf ? (
        <span>actualizado {new Date(asOf).toLocaleTimeString("es-AR")}</span>
      ) : null}
    </div>
  );
}
