import Link from "next/link";

import { buildCashflows, findBond, futureCashflows } from "@/lib/bonds/cashflows";
import { computeBondMath } from "@/lib/bonds/math";
import type { BondQuote } from "@/lib/bonds/quote-types";
import type { CashflowItem } from "@/lib/bonds/types";
import { formatNumber, formatPct, formatUSD } from "@/lib/utils";

interface BondTickerProps {
  symbol: string;
  quote: BondQuote | null;
  error: string | null;
}

export function BondTicker({ symbol, quote, error }: BondTickerProps) {
  const bond = findBond(symbol);
  if (!bond) return null;

  const today = new Date().toISOString().slice(0, 10);
  const allFlows = buildCashflows(bond);
  const future = futureCashflows(allFlows, today);
  const math = quote
    ? computeBondMath({
        bond,
        cleanPrice: quote.cleanPrice,
        settlementIso: today,
        cashflows: allFlows,
      })
    : null;

  const change = quote?.changePct ?? null;
  const trendClass =
    change === null ? "text-muted-foreground" : change >= 0 ? "text-up" : "text-down";
  const sourceLabel = quote?.source
    ? quote.source.includes("fallback")
      ? `${quote.source} (delayed)`
      : quote.source
    : "—";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            BYMA · Bono soberano · Ley {bond.law === "AR" ? "argentina" : "NY"}
          </p>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{bond.symbol}</h1>
          <p className="text-muted-foreground">{bond.name}</p>
        </div>
        <div className="text-right">
          {quote ? (
            <>
              <div className="text-3xl font-semibold tabular-nums">
                {formatUSD(quote.cleanPrice)}
                <span className="ml-1 text-xs text-muted-foreground">/100 face</span>
              </div>
              <div className={`text-sm font-medium ${trendClass}`}>
                {change === null ? "—" : formatPct(change)}{" "}
                <span className="text-muted-foreground">vs. cierre anterior</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Fuente: {sourceLabel} ({quote.upstreamSymbol}) ·{" "}
                {new Date(quote.asOf).toLocaleString("es-AR")}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
              No se pudo obtener cotización en vivo.
              {error ? <span className="block text-xs opacity-80">{error}</span> : null}
            </div>
          )}
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="TIR"
          value={math ? math.ytm * 100 : null}
          format={(v) => `${v.toFixed(2)}%`}
        />
        <Stat
          label="Paridad técnica"
          value={math ? math.paridad * 100 : null}
          format={(v) => `${v.toFixed(2)}%`}
        />
        <Stat
          label="MD (años)"
          value={math?.modifiedDuration ?? null}
          format={(v) => v.toFixed(2)}
        />
        <Stat
          label="Valor técnico"
          value={math?.valorTecnico ?? null}
          format={(v) => formatUSD(v)}
        />
      </section>

      <section className="mt-8 rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Cashflow futuro
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Cupón {bond.couponSchedule[bond.couponSchedule.length - 1]?.annualRatePct}% anual ·
            vence {bond.maturity} · {future.length} pagos pendientes
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm" aria-label={`Cashflow de ${bond.symbol}`}>
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">Fecha</th>
                <th className="px-2 py-1 text-right">Interés</th>
                <th className="px-2 py-1 text-right">Amortización</th>
                <th className="px-2 py-1 text-right">Total</th>
                <th className="px-2 py-1 text-right">Residual</th>
              </tr>
            </thead>
            <tbody>
              {future.slice(0, 14).map((cf) => (
                <CashflowRow key={cf.date} cf={cf} />
              ))}
              {future.length > 14 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                    + {future.length - 14} pagos posteriores hasta {bond.maturity}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Cifras por cada 100 USD de valor nominal original. Esquema de cupón y amortización
          según prospecto del canje 2020 — actualizado a mano si hay re-tap.
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Cómo se calcula
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            <span className="text-foreground">TIR</span> resuelve Newton-Raphson sobre el cashflow
            futuro, base actual/365, compuesto anual. Para comparar con TIR semestral del broker:
            <span className="font-mono"> BEY = 2·((1+TIR)^0.5 − 1)</span>.
          </li>
          <li>
            <span className="text-foreground">Paridad técnica</span> ={" "}
            <span className="font-mono">precio limpio / valor técnico</span>, con{" "}
            <span className="font-mono">valor técnico = residual + intereses corridos</span>.
          </li>
          <li>
            <span className="text-foreground">MD</span> es duration modificada por convención
            yield-based ({" "}
            <span className="font-mono">−dP/dy / P</span>).
          </li>
        </ul>
      </section>

      <p className="mt-8 max-w-prose text-sm text-muted-foreground">
        {bond.description}{" "}
        <Link href="/bonos" className="text-accent hover:underline">
          Ver panel completo →
        </Link>
      </p>
    </div>
  );
}

function CashflowRow({ cf }: { cf: CashflowItem }) {
  const total = cf.interest + cf.principal;
  return (
    <tr className="border-t border-border">
      <td className="px-2 py-1 font-mono text-xs">{cf.date}</td>
      <td className="px-2 py-1 text-right font-mono tabular-nums">
        {formatNumber(cf.interest, 4)}
      </td>
      <td className="px-2 py-1 text-right font-mono tabular-nums">
        {cf.principal > 0 ? formatNumber(cf.principal, 4) : "—"}
      </td>
      <td className="px-2 py-1 text-right font-mono tabular-nums">{formatNumber(total, 4)}</td>
      <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-foreground">
        {formatNumber(cf.faceAfter, 4)}
      </td>
    </tr>
  );
}

interface StatProps {
  label: string;
  value: number | null;
  format: (v: number) => string;
}

function Stat({ label, value, format }: StatProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {value === null ? <span className="text-muted-foreground">—</span> : format(value)}
      </p>
    </div>
  );
}
