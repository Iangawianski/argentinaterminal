import { NextResponse } from "next/server";

import { BONDS, buildCashflows } from "@/lib/bonds/cashflows";
import { getDefaultBondProvider } from "@/lib/bonds/composite";
import { computeBondMath } from "@/lib/bonds/math";
import type { BondQuote } from "@/lib/bonds/quote-types";

/**
 * Aggregated bonds board endpoint.
 *
 * Returns the live quote (Rava → Yahoo fallback) joined with the math
 * derivatives (TIR / paridad / MD) for every bond in the registry. The
 * settlement date is "today" — BYMA hard-dollar settles T+1 in practice but
 * the math is insensitive at the third decimal for this view, and using
 * "today" keeps the response cacheable.
 *
 * If a single bond errors, we return a `failed: true` entry rather than
 * blow up the whole response — the board UI degrades gracefully per-row.
 */
export const revalidate = 30;

export interface BoardRow {
  symbol: string;
  name: string;
  law: string;
  maturity: string;
  quote: BondQuote | null;
  math: ReturnType<typeof computeBondMath> | null;
  source: string;
  error: string | null;
}

export async function GET() {
  const provider = getDefaultBondProvider();
  const today = new Date().toISOString().slice(0, 10);
  const rows: BoardRow[] = await Promise.all(
    BONDS.map(async (bond) => {
      try {
        const quote = await provider.getQuote(bond.symbol);
        const math = computeBondMath({
          bond,
          cleanPrice: quote.cleanPrice,
          settlementIso: today,
          cashflows: buildCashflows(bond),
        });
        return {
          symbol: bond.symbol,
          name: bond.name,
          law: bond.law,
          maturity: bond.maturity,
          quote,
          math,
          source: quote.source,
          error: null,
        };
      } catch (err) {
        return {
          symbol: bond.symbol,
          name: bond.name,
          law: bond.law,
          maturity: bond.maturity,
          quote: null,
          math: null,
          source: "unavailable",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })
  );
  return NextResponse.json(
    { rows, asOf: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
