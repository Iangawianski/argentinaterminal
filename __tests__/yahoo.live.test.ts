import { describe, expect, it } from "vitest";
import { createYahooProvider } from "@/lib/providers/yahoo";

// Live integration test against Yahoo Finance. Skipped in CI by default.
// Enable explicitly with `ARG_LIVE_PROVIDER=1 npm run test`.
const enabled = process.env.ARG_LIVE_PROVIDER === "1";

(enabled ? describe : describe.skip)("yahoo provider (live)", () => {
  it("returns a current GGAL.BA quote with ARS currency", async () => {
    const provider = createYahooProvider();
    const quote = await provider.fetchQuote("GGAL");
    expect(quote.symbol).toBe("GGAL");
    expect(quote.currency).toBe("ARS");
    expect(quote.last).toBeGreaterThan(0);
    expect(quote.timestamp).toBeGreaterThan(0);
    expect(quote.source).toBe("yahoo");
  }, 15_000);
});
