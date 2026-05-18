import { Data912BondProvider, Data912ContractError } from "@/lib/bonds/data912";
import type {
  BondHistory,
  BondQuote,
  BondQuoteProvider,
} from "@/lib/bonds/quote-types";
import { RavaBondProvider, RavaContractError } from "@/lib/bonds/rava";
import { YahooBondProvider } from "@/lib/bonds/yahoo-fallback";

/**
 * Composite bond quote provider with a three-tier fallback chain.
 *
 *   1. **data912.com** — primary. JSON snapshot of every BYMA-listed bond,
 *      free, no key. Snapshot-only (no history). Works for the D-suffix
 *      species we need (AL30D, GD30D, GD35D, GD38D, GD41D).
 *   2. **Rava CSV** — fallback for getQuote and the canonical source for
 *      getHistory when its endpoint is up. As of 2026-05-18 its
 *      `precioshistoricos.php` returns 404 for USD bonds, but we keep it
 *      wired so the chain self-heals if Rava restores it.
 *   3. **Yahoo `.BA`** — last resort. Currently empty for AR sovereign
 *      D-species ("symbol may be delisted"); kept for symmetry and in
 *      case Yahoo backfills.
 *
 * `source` on the returned quote always reflects which tier produced the
 * data so the UI can render the right disclaimer.
 */
export class CompositeBondProvider implements BondQuoteProvider {
  readonly name = "data912+rava+yahoo";

  constructor(
    private readonly primary: BondQuoteProvider = new Data912BondProvider(),
    private readonly fallback1: BondQuoteProvider = new RavaBondProvider(),
    private readonly fallback2: BondQuoteProvider = new YahooBondProvider(),
  ) {}

  async getQuote(bondSymbol: string): Promise<BondQuote> {
    try {
      return await this.primary.getQuote(bondSymbol);
    } catch (primaryErr) {
      if (!shouldFallback(primaryErr)) throw primaryErr;
      try {
        const q = await this.fallback1.getQuote(bondSymbol);
        return { ...q, source: `${q.source}+fallback` };
      } catch (fb1Err) {
        if (!shouldFallback(fb1Err)) throw fb1Err;
        const q = await this.fallback2.getQuote(bondSymbol);
        return { ...q, source: `${q.source}+fallback` };
      }
    }
  }

  async getHistory(bondSymbol: string, days?: number): Promise<BondHistory> {
    // Prefer Rava (real history) when up; fall through to data912 (single
    // point) and Yahoo for the chart shell. Order is opposite from quote.
    try {
      return await this.fallback1.getHistory(bondSymbol, days);
    } catch (ravaErr) {
      if (!shouldFallback(ravaErr)) throw ravaErr;
      try {
        return await this.primary.getHistory(bondSymbol, days);
      } catch (primErr) {
        if (!shouldFallback(primErr)) throw primErr;
        const h = await this.fallback2.getHistory(bondSymbol, days);
        return { ...h, source: `${h.source}+fallback` };
      }
    }
  }
}

function shouldFallback(err: unknown): boolean {
  if (err instanceof RavaContractError) return true;
  if (err instanceof Data912ContractError) return true;
  if (err instanceof Error) {
    return /HTTP [45]\d\d|fetch failed|timeout|network|ECONN|ENOTFOUND|no row for symbol/i.test(
      err.message,
    );
  }
  return false;
}

let defaultProvider: BondQuoteProvider | null = null;

export function getDefaultBondProvider(): BondQuoteProvider {
  if (!defaultProvider) {
    defaultProvider = new CompositeBondProvider();
  }
  return defaultProvider;
}
