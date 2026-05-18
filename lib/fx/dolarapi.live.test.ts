import { describe, expect, it } from "vitest";

import { DolarApiProvider } from "./dolarapi";

const LIVE = process.env.TERMINAL_LIVE_TESTS === "1";
const runner = LIVE ? describe : describe.skip;

/**
 * Skipped in CI by default. Run with `npm run test:live` to verify
 * DolarApi still returns the expected shape and the five canonical rates.
 */
runner("DolarApiProvider (live)", () => {
  it("returns oficial / mayorista / mep / ccl / blue", async () => {
    const provider = new DolarApiProvider();
    const all = await provider.getAll();
    const keys = new Set(all.map((q) => q.key));
    expect(keys.has("oficial")).toBe(true);
    expect(keys.has("ccl")).toBe(true);
    expect(keys.has("mep")).toBe(true);
    expect(keys.has("blue")).toBe(true);
    for (const q of all) {
      expect(q.ask).toBeGreaterThan(0);
    }
  }, 15_000);
});
