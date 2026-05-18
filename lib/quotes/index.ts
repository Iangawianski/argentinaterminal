import { YahooQuoteProvider } from "@/lib/quotes/yahoo";
import type { QuoteProvider } from "@/lib/quotes/types";

let defaultProvider: QuoteProvider | null = null;

export function getDefaultQuoteProvider(): QuoteProvider {
  if (!defaultProvider) {
    defaultProvider = new YahooQuoteProvider();
  }
  return defaultProvider;
}

export type { Quote, IntradaySeries, IntradayPoint, Fundamentals, QuoteProvider } from "@/lib/quotes/types";
export { YahooQuoteProvider, qualifySymbol } from "@/lib/quotes/yahoo";
