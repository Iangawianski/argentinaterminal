import { NextResponse } from "next/server";

import { getDefaultEmbiProvider } from "@/lib/macro/embi";

/**
 * EMBI+ Argentina ("riesgo país") endpoint. 5-minute server cache matches
 * the issue scope; EMBI is intraday but slow-moving (deltas of <20 bps over
 * minutes are noise). On parser failure the upstream throws a 502 — the
 * board UI shows "sin datos" rather than stale numbers.
 */
export const revalidate = 300;

export async function GET() {
  try {
    const provider = getDefaultEmbiProvider();
    const data = await provider.getRiesgoPais();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "EMBI provider failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
