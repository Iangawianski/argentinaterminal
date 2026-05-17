"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { YieldCurve, type YieldCurvePoint } from "@/components/yield-curve";
import type { BondQuote } from "@/lib/bonds/quote-types";
import type { BondMath } from "@/lib/bonds/types";
import type { RiesgoPais } from "@/lib/macro/embi";
import type { FxQuote } from "@/lib/fx";
import { formatNumber, formatPct } from "@/lib/utils";

export interface BoardRow {
  symbol: string;
  name: string;
  law: "AR" | "NY";
  maturity: string;
  quote: BondQuote | null;
  math: BondMath | null;
  source: string;
  error: string | null;
}

interface BondsResponse {
  rows: BoardRow[];
  asOf: string;
}

interface BondsBoardProps {
  initialBonds: BondsResponse;
  initialEmbi: RiesgoPais | null;
  initialMep: FxQuote | null;
}

async function fetchBonds(): Promise<BondsResponse> {
  const res = await fetch("/api/bonds", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as BondsResponse;
}

async function fetchEmbi(): Promise<RiesgoPais> {
  const res = await fetch("/api/macro/embi", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as RiesgoPais;
}

export function BondsBoard({ initialBonds, initialEmbi, initialMep }: BondsBoardProps) {
  const bonds = useQuery<BondsResponse, Error>({
    queryKey: ["bonds", "board"],
    queryFn: fetchBonds,
    initialData: initialBonds,
    refetchInterval: 30_000,
  });

  const embi = useQuery<RiesgoPais, Error>({
    queryKey: ["macro", "embi"],
    queryFn: fetchEmbi,
    initialData: initialEmbi ?? undefined,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  const rows = bonds.data?.rows ?? [];
  const curvePoints: YieldCurvePoint[] = rows
    .filter((r): r is BoardRow & { math: BondMath } => r.math !== null)
    .map((r) => ({
      symbol: r.symbol,
      modifiedDuration: r.math.modifiedDuration,
      ytmPct: r.math.ytm * 100,
      law: r.law,
    }));

  const hasFallback = rows.some((r) => r.source.includes("fallback"));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bonos hard-dollar</h1>
          <p className="text-sm text-muted-foreground">
            Soberanos del canje 2020 — precio limpio en USD, TIR, paridad técnica y duración.
            Actualiza cada 30s.
          </p>
        </div>
        <HeaderStats embi={embi.data ?? null} mep={initialMep} />
      </header>

      <section className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-sm" aria-label="Tabla de bonos hard-dollar">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-[12%] px-3 py-2 text-left">Símbolo</th>
              <th className="w-[8%] px-3 py-2 text-left">Ley</th>
              <th className="w-[14%] px-3 py-2 text-right">Precio limpio</th>
              <th className="w-[12%] px-3 py-2 text-right">Variación día</th>
              <th className="w-[12%] px-3 py-2 text-right">TIR</th>
              <th className="w-[14%] px-3 py-2 text-right">Paridad</th>
              <th className="w-[12%] px-3 py-2 text-right">MD (años)</th>
              <th className="w-[16%] px-3 py-2 text-left">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <BondRow key={row.symbol} row={row} />
            ))}
          </tbody>
        </table>
      </section>

      {hasFallback ? (
        <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground">
          Algunos bonos vienen del fallback Yahoo (.BA): precio delayed y volumen pobre. Volverá a
          Rava cuando el primario esté disponible.
        </p>
      ) : null}

      <section id="curva" className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Curva soberana
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Puntos = un bono · línea = orden por duration
          </span>
        </div>
        <div className="text-foreground">
          <YieldCurve points={curvePoints} />
        </div>
      </section>

      {bonds.isError ? (
        <p className="rounded-md border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          No se pudo obtener bonos: {bonds.error.message}
        </p>
      ) : null}
    </div>
  );
}

function HeaderStats({ embi, mep }: { embi: RiesgoPais | null; mep: FxQuote | null }) {
  return (
    <div id="riesgo" className="flex flex-wrap items-end gap-4">
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Riesgo país</p>
        {embi ? (
          <>
            <p className="font-mono text-xl font-semibold tabular-nums">
              {formatNumber(embi.valueBps)} <span className="text-xs text-muted-foreground">pb</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              Fuente: {embi.source === "ambito" ? "Ámbito" : embi.source === "fred-spread" ? "spread FRED" : "manual"}
              {embi.changeBps !== null
                ? ` · ${embi.changeBps >= 0 ? "+" : ""}${embi.changeBps} pb día`
                : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">sin datos</p>
        )}
      </div>
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dólar MEP</p>
        {mep ? (
          <p className="font-mono text-xl font-semibold tabular-nums">
            ${formatNumber(mep.ask, 2)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">sin datos</p>
        )}
      </div>
    </div>
  );
}

function BondRow({ row }: { row: BoardRow }) {
  const ytmPct = row.math ? row.math.ytm * 100 : null;
  const paridadPct = row.math ? row.math.paridad * 100 : null;
  const change = row.quote?.changePct ?? null;
  const trendClass =
    change === null ? "text-muted-foreground" : change >= 0 ? "text-up" : "text-down";
  return (
    <tr className="border-t border-border focus-within:bg-muted/40 hover:bg-muted/30">
      <td className="px-3 py-2 font-mono text-xs font-semibold">
        <Link href={`/ticker/${row.symbol}`} className="hover:text-accent focus:outline-none">
          {row.symbol}
        </Link>
        <div className="text-[10px] text-muted-foreground">vence {row.maturity}</div>
      </td>
      <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
        {row.law === "AR" ? "AR" : "NY"}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {row.quote ? `US$ ${formatNumber(row.quote.cleanPrice, 2)}` : "—"}
      </td>
      <td className={`px-3 py-2 text-right font-mono tabular-nums ${trendClass}`}>
        {change === null ? "—" : formatPct(change)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {ytmPct === null ? "—" : `${ytmPct.toFixed(2)}%`}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {paridadPct === null ? "—" : `${paridadPct.toFixed(2)}%`}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {row.math ? row.math.modifiedDuration.toFixed(2) : "—"}
      </td>
      <td className="px-3 py-2 text-[11px] text-muted-foreground">
        {row.error ? <span className="text-down">{row.error}</span> : row.source}
      </td>
    </tr>
  );
}
