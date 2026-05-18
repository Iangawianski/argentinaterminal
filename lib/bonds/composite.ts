import type {
  BondHistory,
  BondQuote,
  BondQuoteProvider,
} from "@/lib/bonds/quote-types";
import { RavaBondProvider, RavaContractError } from "@/lib/bonds/rava";
import { YahooBondProvider } from "@/lib/bonds/yahoo-fallback";

/**
 * Composite bond quote provider: tries Rava first, falls back to Yahoo on
 * any error. Records which source produced the data so the UI can flag
 * fallback mode in a disclaimer.
 *
 * Fallback triggers:
 *   - HTTP 5xx / network errors from Rava.
 *   - `RavaContractError` (CSV missing required headers, empty response).
 *   - Any non-`RavaContractError` parse error — same fallback path.
 *
 * Note: Yahoo .BA bond data is delayed and thin. The disclaimer on /bonos
 * surfaces this when `source === "yahoo"`.
 */
export class CompositeBondProvider implements BondQuoteProvider {
  readonly name = "rava+yahoo";

  constructor(
    private readonly primary: BondQuoteProvider = new RavaBondProvider(),
    private readonly fallback: BondQuoteProvider = new YahooBondProvider()
  ) {}

  async getQuote(bondSymbol: string): Promise<BondQuote> {
    try {
      return await this.primary.getQuote(bondSymbol);
    } catch (err) {
      if (!shouldFallback(err)) throw err;
      // Mark the fallback source so the UI can show "Yahoo (delayed)".
      const q = await this.fallback.getQuote(bondSymbol);
      return { ...q, source: `${q.source}+fallback` };
    }
  }

  async getHistory(bondSymbol: string, days?: number): Promise<BondHistory> {
    try {
      return await this.primary.getHistory(bondSymbol, days);
    } catch (err) {
      if (!shouldFallback(err)) throw err;
      const h = await this.fallback.getHistory(bondSymbol, days);
      return { ...h, source: `${h.source}+fallback` };
    }
  }
}

function shouldFallback(err: unknown): boolean {
  if (err instanceof RavaContractError) return true;
  if (err instanceof Error) {
    return /HTTP [45]\d\d|fetch failed|timeout|network|ECONN|ENOTFOUND/i.test(err.message);
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
