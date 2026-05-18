import { describe, expect, it } from "vitest";

import { YahooQuoteProvider } from "./yahoo";

const LIVE = process.env.TERMINAL_LIVE_TESTS === "1";
const runner = LIVE ? describe : describe.skip;

/**
 * Skipped in CI by default. Run with `npm run test:live` locally to verify
 * the Yahoo Finance endpoints still return the expected shape. Network-
 * dependent — do not enable on CI without a retry/backoff strategy.
 */
runner("YahooQuoteProvider (live)", () => {
  it("fetches a real quote for GGAL.BA", async () => {
    const provider = new YahooQuoteProvider();
    const quote = await provider.getQuote("GGAL");
    expect(quote.symbol).toBe("GGAL.BA");
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.currency).toMatch(/ARS|USD/);
  }, 15_000);

  it("fetches real fundamentals for an ADR (AAPL) via quoteSummary", async () => {
    const provider = new YahooQuoteProvider({ suffix: "" });
    const fund = await provider.getFundamentals("AAPL");
    // We tolerate the fallback path here — the assertion is only that
    // something usable came back, since the crumb dance can break on CI.
    expect(fund.symbol).toBe("AAPL");
    expect(typeof fund.source).toBe("string");
    expect(
      fund.marketCap === null || fund.marketCap > 0
    ).toBe(true);
  }, 20_000);
});
