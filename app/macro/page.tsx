import type { Metadata } from "next";

import { MacroSparkline } from "@/components/macro-sparkline";
import {
  BCRA_KEYS,
  BCRA_VARIABLES,
  getDefaultBcraProvider,
  type BcraKey,
  type BcraPoint,
  type BcraSnapshot,
} from "@/lib/macro/bcra";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Macro",
  description:
    "Variables clave del BCRA: reservas, base monetaria, tasas BADLAR/TAMAR, IPC e inflación, dólar mayorista y minorista.",
};

export const revalidate = 300;

interface MacroRow {
  key: BcraKey;
  meta: (typeof BCRA_VARIABLES)[BcraKey];
  snapshot: BcraSnapshot | null;
  points: BcraPoint[];
  error: string | null;
}

export default async function MacroPage() {
  const provider = getDefaultBcraProvider();
  const rows: MacroRow[] = await Promise.all(
    BCRA_KEYS.map(async (key) => {
      try {
        const series = await provider.getSeries(key, 30);
        const points = series.points;
        if (points.length === 0) {
          return {
            key,
            meta: BCRA_VARIABLES[key],
            snapshot: null,
            points: [],
            error: "Sin observaciones recientes",
          };
        }
        const latest = points[points.length - 1]!;
        const prev = points.length >= 2 ? points[points.length - 2]! : null;
        const direction = BCRA_VARIABLES[key].direction;
        const delta = prev !== null ? latest.value - prev.value : null;
        const deltaPct =
          direction === "level" && prev !== null && prev.value !== 0
            ? ((latest.value - prev.value) / prev.value) * 100
            : null;
        return {
          key,
          meta: BCRA_VARIABLES[key],
          snapshot: {
            key,
            value: latest.value,
            date: latest.date,
            previousValue: prev?.value ?? null,
            previousDate: prev?.date ?? null,
            delta,
            deltaPct,
            source: series.source,
            asOf: series.asOf,
          },
          points,
          error: null,
        };
      } catch (err) {
        return {
          key,
          meta: BCRA_VARIABLES[key],
          snapshot: null,
          points: [],
          error: err instanceof Error ? err.message : "Unknown BCRA error",
        };
      }
    }),
  );

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-fg))]">
          BCRA · Principales variables
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Macro</h1>
        <p className="mt-1 max-w-prose text-sm text-[hsl(var(--muted-fg))]">
          Reservas, tasas y precios desde la API pública del BCRA (`v4.0/Monetarias`). Se
          actualiza cada 5 minutos en el server. Las tasas se muestran como TNA — para anualizar
          comparable con TEA usá la conversión estándar.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm" aria-label="Variables macro BCRA">
          <thead className="bg-[hsl(var(--muted))] text-xs uppercase tracking-wider text-[hsl(var(--muted-fg))]">
            <tr>
              <th className="px-3 py-2 text-left">Variable</th>
              <th className="px-3 py-2 text-right">Último</th>
              <th className="px-3 py-2 text-right">Variación</th>
              <th className="px-3 py-2 text-center">30 obs</th>
              <th className="px-3 py-2 text-right">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MacroRow key={row.key} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-[hsl(var(--muted-fg))]">
        Fuente: BCRA · variables curadas. IPC mensual e interanual son mensuales (oficial INDEC,
        publicado vía BCRA). El resto son diarias.
      </p>
    </section>
  );
}

function MacroRow({ row }: { row: MacroRow }) {
  const snap = row.snapshot;
  const direction = row.meta.direction;
  const decimals = direction === "rate" ? 2 : row.meta.unit.includes("ARS/USD") ? 2 : 0;
  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <div className="font-medium">{row.meta.short}</div>
        <div className="text-[11px] text-[hsl(var(--muted-fg))]">{row.meta.unit}</div>
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {snap ? formatNumber(snap.value, decimals) : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {snap === null ? (
          <span className="text-[hsl(var(--muted-fg))]">—</span>
        ) : direction === "level" && snap.deltaPct !== null ? (
          <span style={{ color: `hsl(var(--${snap.deltaPct >= 0 ? "positive" : "negative"}))` }}>
            {snap.deltaPct >= 0 ? "+" : ""}
            {snap.deltaPct.toFixed(2)}%
          </span>
        ) : snap.delta !== null ? (
          <span
            style={{ color: `hsl(var(--${snap.delta >= 0 ? "positive" : "negative"}))` }}
          >
            {snap.delta >= 0 ? "+" : ""}
            {snap.delta.toFixed(2)}
            <span className="text-[hsl(var(--muted-fg))]"> pp</span>
          </span>
        ) : (
          <span className="text-[hsl(var(--muted-fg))]">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <MacroSparkline
          points={row.points}
          ariaLabel={`Sparkline ${row.meta.short}`}
        />
      </td>
      <td className="px-3 py-2 text-right font-mono text-[11px] text-[hsl(var(--muted-fg))]">
        {snap ? snap.date : row.error ?? "—"}
      </td>
    </tr>
  );
}
