import { NextResponse } from "next/server";

import {
  BCRA_KEYS,
  BCRA_VARIABLES,
  getDefaultBcraProvider,
  type BcraKey,
  type BcraSeries,
  type BcraSnapshot,
} from "@/lib/macro/bcra";

/**
 * Aggregated BCRA principal variables endpoint.
 *
 * Returns the latest snapshot for every curated variable in the registry,
 * plus the last 30 observations for sparkline rendering. Failures are
 * isolated per-variable so the macro board degrades gracefully if BCRA
 * intermittently drops a single series.
 *
 * Cache 5 minutes — BCRA daily series refresh once per working day, so this
 * is generous.
 */
export const revalidate = 300;

export interface BcraBoardRow {
  key: BcraKey;
  meta: (typeof BCRA_VARIABLES)[BcraKey];
  snapshot: BcraSnapshot | null;
  series: BcraSeries | null;
  error: string | null;
}

export async function GET() {
  const provider = getDefaultBcraProvider();
  const rows: BcraBoardRow[] = await Promise.all(
    BCRA_KEYS.map(async (key) => {
      try {
        const series = await provider.getSeries(key, 30);
        const points = series.points;
        if (points.length === 0) {
          return {
            key,
            meta: BCRA_VARIABLES[key],
            snapshot: null,
            series,
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
          series,
          error: null,
        };
      } catch (err) {
        return {
          key,
          meta: BCRA_VARIABLES[key],
          snapshot: null,
          series: null,
          error: err instanceof Error ? err.message : "Unknown BCRA error",
        };
      }
    }),
  );
  return NextResponse.json(
    { rows, asOf: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
