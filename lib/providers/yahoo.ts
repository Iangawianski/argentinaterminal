import { ProviderError, QuoteSchema, type Quote, type QuoteProvider } from "./types";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

const SYMBOL_TO_YAHOO: Record<string, string> = {
  GGAL: "GGAL.BA",
  YPFD: "YPFD.BA",
  BMA: "BMA.BA",
  PAMP: "PAMP.BA",
  TXAR: "TXAR.BA",
  ALUA: "ALUA.BA",
  CRES: "CRES.BA",
  EDN: "EDN.BA",
  TGSU2: "TGSU2.BA",
  MERVAL: "^MERV",
};

export function toYahooSymbol(symbol: string): string | undefined {
  return SYMBOL_TO_YAHOO[symbol.toUpperCase()];
}

type YahooChartMeta = {
  currency?: string;
  symbol?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      indicators?: {
        quote?: Array<{ open?: Array<number | null> }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

export type YahooFetcher = (
  yahooSymbol: string,
  init?: RequestInit,
) => Promise<YahooChartResponse>;

const defaultFetcher: YahooFetcher = async (yahooSymbol, init) => {
  const url = `${YAHOO_BASE}/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    ...init,
    headers: {
      // Yahoo is more forgiving of a non-default UA.
      "User-Agent":
        "ArgentinaTerminal/0.0.1 (+https://github.com/argentina-terminal)",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new ProviderError(
      `Yahoo HTTP ${res.status}`,
      "yahoo",
    );
  }
  return (await res.json()) as YahooChartResponse;
};

export function createYahooProvider(
  fetcher: YahooFetcher = defaultFetcher,
): QuoteProvider {
  return {
    name: "yahoo",
    async fetchQuote(symbol: string): Promise<Quote> {
      const yahooSymbol = toYahooSymbol(symbol);
      if (!yahooSymbol) {
        throw new ProviderError(
          `Symbol ${symbol} is not mapped to a Yahoo ticker`,
          "yahoo",
        );
      }

      let payload: YahooChartResponse;
      try {
        payload = await fetcher(yahooSymbol);
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(
          err instanceof Error ? err.message : String(err),
          "yahoo",
          err,
        );
      }

      const result = payload.chart?.result?.[0];
      if (!result || !result.meta) {
        const desc = payload.chart?.error?.description ?? "no result in chart payload";
        throw new ProviderError(`Yahoo response invalid: ${desc}`, "yahoo");
      }
      const meta = result.meta;

      const last = meta.regularMarketPrice;
      const previousClose = meta.previousClose ?? meta.chartPreviousClose;
      if (typeof last !== "number" || typeof previousClose !== "number") {
        throw new ProviderError("Yahoo missing price fields", "yahoo");
      }

      const firstOpen = result.indicators?.quote?.[0]?.open?.[0];

      const parsed = QuoteSchema.safeParse({
        symbol: symbol.toUpperCase(),
        last,
        previousClose,
        change: last - previousClose,
        open: typeof firstOpen === "number" ? firstOpen : last,
        dayHigh: meta.regularMarketDayHigh ?? last,
        dayLow: meta.regularMarketDayLow ?? last,
        volume: meta.regularMarketVolume ?? 0,
        timestamp:
          typeof meta.regularMarketTime === "number"
            ? meta.regularMarketTime * 1000
            : Date.now(),
        currency: "ARS",
        source: "yahoo",
      });

      if (!parsed.success) {
        throw new ProviderError(
          `Yahoo response failed schema: ${parsed.error.message}`,
          "yahoo",
          parsed.error,
        );
      }

      return parsed.data;
    },
  };
}
