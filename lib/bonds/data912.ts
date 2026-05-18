import { z } from "zod";

import { findBond } from "@/lib/bonds/cashflows";
import type {
  BondHistory,
  BondHistoryPoint,
  BondQuote,
  BondQuoteProvider,
} from "@/lib/bonds/quote-types";

/**
 * data912.com bond snapshot adapter.
 *
 *   GET https://data912.com/live/arg_bonds → array of bond rows
 *
 * Free, no API key, no rate-limit headers in evidence. Returns a snapshot
 * of every BYMA-listed bond (AL30, AL30C, AL30D, GD30, GD30C, GD30D, …)
 * with bid/ask/close/volume. Liquidity is real-time during trading hours;
 * outside hours it returns the last session's close.
 *
 * We use this as the **primary** bond price source because the original
 * Rava CSV endpoint (`precioshistoricos.php?e=AL30D&csv=1`) now 404s for
 * every USD-settling symbol (verified 2026-05-18 against production
 * Vercel; same 404 from sandbox), and Yahoo never carried the AR
 * sovereign D-species ("No data found, symbol may be delisted").
 *
 * Snapshot only — data912 does not expose history through this endpoint.
 * `getHistory` returns the latest close as a single-point series so the
 * caller still gets a stable shape; richer history requires falling back
 * to Rava (currently broken) or Yahoo (currently empty).
 */

export const DATA912_BASE = "https://data912.com";

export class Data912ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Data912ContractError";
  }
}

const Data912RowSchema = z.object({
  symbol: z.string(),
  /** Close (or last) clean price per 100 face, USD-settling for D-species. */
  c: z.number(),
  /** Day percent change, e.g. -0.32. */
  pct_change: z.number().optional(),
});

const Data912PayloadSchema = z.array(Data912RowSchema);

export interface Data912AdapterOptions {
  fetchImpl?: typeof fetch;
  base?: string;
  cacheTtlSeconds?: number;
  /** Override symbol mapping. Default appends "D" (USD-settling species). */
  symbolMap?: (bondSymbol: string) => string;
}

function defaultSymbolMap(bondSymbol: string): string {
  const bond = findBond(bondSymbol);
  if (bond) return bond.usdBaSymbol.replace(/\.BA$/i, "");
  return `${bondSymbol.trim().toUpperCase()}D`;
}

const USER_AGENT =
  "ArgentinaTerminal/0.1 (+https://github.com/argentinaterminal/argentinaterminal)";

export class Data912BondProvider implements BondQuoteProvider {
  readonly name = "data912";
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;
  private readonly cacheTtlSeconds: number;
  private readonly symbolMap: (s: string) => string;

  constructor(opts: Data912AdapterOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.base = opts.base ?? DATA912_BASE;
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 30;
    this.symbolMap = opts.symbolMap ?? defaultSymbolMap;
  }

  private async fetchAll(): Promise<z.infer<typeof Data912PayloadSchema>> {
    const url = `${this.base}/live/arg_bonds`;
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      next: { revalidate: this.cacheTtlSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (!res.ok) {
      throw new Error(`data912 fetch failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as unknown;
    const parsed = Data912PayloadSchema.safeParse(json);
    if (!parsed.success) {
      throw new Data912ContractError(
        `data912 payload failed schema: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  async getQuote(bondSymbol: string): Promise<BondQuote> {
    const upstreamSymbol = this.symbolMap(bondSymbol);
    const rows = await this.fetchAll();
    const row = rows.find((r) => r.symbol === upstreamSymbol);
    if (!row) {
      throw new Data912ContractError(
        `data912 has no row for symbol ${upstreamSymbol}`,
      );
    }
    const changePct = typeof row.pct_change === "number" ? row.pct_change : null;
    // data912 doesn't surface previousClose directly — derive it from the
    // change percent so the BondQuote contract is satisfied. When change
    // is absent we leave it null.
    const previousClose =
      changePct !== null && Number.isFinite(changePct) && changePct !== -100
        ? row.c / (1 + changePct / 100)
        : null;
    return {
      symbol: bondSymbol.trim().toUpperCase(),
      upstreamSymbol,
      source: this.name,
      cleanPrice: row.c,
      previousClose,
      changePct,
      asOf: new Date().toISOString(),
    };
  }

  async getHistory(bondSymbol: string, _days = 90): Promise<BondHistory> {
    // Snapshot-only source. Return a single-point series so the caller can
    // still chart a marker; a richer history requires a different source.
    void _days;
    const upstreamSymbol = this.symbolMap(bondSymbol);
    const rows = await this.fetchAll();
    const row = rows.find((r) => r.symbol === upstreamSymbol);
    if (!row) {
      throw new Data912ContractError(
        `data912 has no row for symbol ${upstreamSymbol}`,
      );
    }
    const points: BondHistoryPoint[] = [
      { date: new Date().toISOString().slice(0, 10), close: row.c },
    ];
    return {
      symbol: bondSymbol.trim().toUpperCase(),
      upstreamSymbol,
      source: this.name,
      points,
    };
  }
}
