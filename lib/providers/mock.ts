import { QuoteSchema, type Quote, type QuoteProvider } from "./types";

const FIXED_TIMESTAMP = Date.UTC(2026, 4, 16, 17, 0, 0);

const FIXTURES: Record<string, Omit<Quote, "symbol" | "source" | "timestamp" | "currency">> = {
  GGAL: {
    last: 6450,
    previousClose: 6320,
    change: 130,
    open: 6330,
    dayHigh: 6500,
    dayLow: 6280,
    volume: 1_234_567,
  },
  YPFD: {
    last: 38_500,
    previousClose: 38_200,
    change: 300,
    open: 38_200,
    dayHigh: 39_100,
    dayLow: 37_900,
    volume: 220_000,
  },
};

export function createMockProvider(now: number = FIXED_TIMESTAMP): QuoteProvider {
  return {
    name: "mock",
    async fetchQuote(symbol: string): Promise<Quote> {
      const upper = symbol.toUpperCase();
      const fx = FIXTURES[upper];
      if (!fx) {
        throw new Error(`Mock provider has no fixture for ${upper}`);
      }
      return QuoteSchema.parse({
        ...fx,
        symbol: upper,
        timestamp: now,
        currency: "ARS",
        source: "mock",
      });
    },
  };
}
