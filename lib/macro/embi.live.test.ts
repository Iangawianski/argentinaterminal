import { describe, expect, it } from "vitest";

import { AmbitoEmbiProvider } from "./embi";

const LIVE = process.env.TERMINAL_LIVE_TESTS === "1";
const runner = LIVE ? describe : describe.skip;

/**
 * Live smoke against Ámbito's riesgo país page. Skipped in CI;
 * run with `npm run test:live`.
 */
runner("AmbitoEmbiProvider (live)", () => {
  it("returns a positive bps figure in the plausible band", async () => {
    const provider = new AmbitoEmbiProvider();
    const r = await provider.getRiesgoPais();
    expect(r.valueBps).toBeGreaterThan(100);
    expect(r.valueBps).toBeLessThan(20_000);
    expect(["ambito", "fred-spread"]).toContain(r.source);
  }, 15_000);
});
