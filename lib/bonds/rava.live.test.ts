import { describe, expect, it } from "vitest";

import { RavaBondProvider } from "./rava";

const LIVE = process.env.TERMINAL_LIVE_TESTS === "1";
const runner = LIVE ? describe : describe.skip;

/**
 * Live smoke against Rava. Skipped in CI; run with `npm run test:live`.
 * Verifies the AL30D CSV endpoint still responds with the expected shape.
 */
runner("RavaBondProvider (live)", () => {
  it("returns a positive AL30 clean price under 200", async () => {
    const provider = new RavaBondProvider();
    const quote = await provider.getQuote("AL30");
    expect(quote.cleanPrice).toBeGreaterThan(0);
    expect(quote.cleanPrice).toBeLessThan(200);
    expect(quote.upstreamSymbol).toBe("AL30D");
  }, 15_000);
});
