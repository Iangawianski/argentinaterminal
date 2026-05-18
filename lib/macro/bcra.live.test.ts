import { describe, expect, it } from "vitest";

import { BcraProvider } from "./bcra";

const LIVE = process.env.TERMINAL_LIVE_TESTS === "1";

describe.skipIf(!LIVE)("BCRA live (set TERMINAL_LIVE_TESTS=1)", () => {
  it("fetches reservas — current value should be > 1000 USD millions", async () => {
    const p = new BcraProvider();
    const snap = await p.getLatest("reservas");
    expect(snap.value).toBeGreaterThan(1000);
    expect(snap.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("fetches BADLAR rate — current value in 0-200 band", async () => {
    const p = new BcraProvider();
    const snap = await p.getLatest("badlar");
    expect(snap.value).toBeGreaterThan(0);
    expect(snap.value).toBeLessThan(200);
  });
});
