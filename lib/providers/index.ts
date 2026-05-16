import { createMockProvider } from "./mock";
import { createYahooProvider } from "./yahoo";
import type { Quote, QuoteProvider } from "./types";

let providerOverride: QuoteProvider | null = null;

export function setQuoteProvider(provider: QuoteProvider | null): void {
  providerOverride = provider;
}

function defaultProvider(): QuoteProvider {
  if (process.env.ARG_PROVIDER === "mock") {
    return createMockProvider();
  }
  return createYahooProvider();
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  const provider = providerOverride ?? defaultProvider();
  return provider.fetchQuote(symbol);
}

export { createMockProvider, createYahooProvider };
export type { Quote, QuoteProvider } from "./types";
