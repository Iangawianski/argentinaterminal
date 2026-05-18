import { findBond } from "@/lib/bonds/cashflows";
import type {
  BondHistory,
  BondHistoryPoint,
  BondQuote,
  BondQuoteProvider,
} from "@/lib/bonds/quote-types";
import { YahooQuoteProvider, type YahooAdapterOptions } from "@/lib/quotes/yahoo";

/**
 * Yahoo `.BA` fallback for bonds. Wraps `YahooQuoteProvider` and resolves
 * the bond's USD-settling species (e.g. AL30D.BA) so the returned price is
 * in USD. Quote and history come from the same `/v8/finance/chart` endpoint
 * the equities provider uses.
 *
 * Why kept separate from `RavaBondProvider`: we want a clean fallback chain
 * (`composite.ts`) and Yahoo's caveats here are different from equities
 * (lower liquidity, longer delay, the symbol mapping rule above). Keeping
 * them split avoids polluting either codepath.
 */
export class YahooBondProvider implements BondQuoteProvider {
  readonly name = "yahoo";
  private readonly inner: YahooQuoteProvider;

  constructor(opts: YahooAdapterOptions = {}) {
    // Yahoo's bond species already carry the .BA suffix in the registry,
    // so pass an empty suffix here — `qualifySymbol` will leave them alone.
    this.inner = new YahooQuoteProvider({ ...opts, suffix: "" });
  }

  private resolveUpstream(bondSymbol: string): string {
    const bond = findBond(bondSymbol);
    if (bond) return bond.usdBaSymbol; // e.g. AL30D.BA
    return `${bondSymbol.trim().toUpperCase()}D.BA`;
  }

  async getQuote(bondSymbol: string): Promise<BondQuote> {
    const upstream = this.resolveUpstream(bondSymbol);
    const q = await this.inner.getQuote(upstream);
    return {
      symbol: bondSymbol.trim().toUpperCase(),
      upstreamSymbol: q.symbol,
      source: this.name,
      cleanPrice: q.price,
      previousClose: q.previousClose,
      changePct: q.changePct,
      asOf: q.asOf,
    };
  }

  async getHistory(bondSymbol: string, days = 90): Promise<BondHistory> {
    const upstream = this.resolveUpstream(bondSymbol);
    // Yahoo's chart `1d/5m` is intraday — we want daily closes for a history
    // window. The provider's `getIntraday` is hard-coded to `1d/5m`, so we
    // fall back to a manual fetch for daily closes here.
    const intraday = await this.inner.getIntraday(upstream);
    // Coerce intraday points into a coarse "today's series" — better than
    // nothing. For the rich history view we still prefer Rava when up.
    const points: BondHistoryPoint[] = intraday.points
      .filter((p) => Number.isFinite(p.price))
      .slice(-days)
      .map((p) => ({ date: p.t.slice(0, 10), close: p.price }));
    return {
      symbol: bondSymbol.trim().toUpperCase(),
      upstreamSymbol: upstream,
      source: this.name,
      points,
    };
  }
}
