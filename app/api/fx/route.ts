import { NextResponse } from "next/server";

import { getDefaultFxProvider } from "@/lib/fx";

/**
 * Server-side proxy for FX quotes. The reason this exists rather than
 * calling DolarApi directly from the browser:
 *   1. Centralized 30s cache aligns server + client view.
 *   2. The browser does not ship our User-Agent / referrer to the provider.
 *   3. We can swap providers (Bluelytics, BCRA) in one place.
 */
export const revalidate = 30;

export async function GET() {
  try {
    const provider = getDefaultFxProvider();
    const quotes = await provider.getAll();
    return NextResponse.json(
      { quotes, asOf: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "FX provider failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
