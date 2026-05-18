import { describe, expect, it } from "vitest";

import { Data912BondProvider, Data912ContractError } from "./data912";

const PAYLOAD = [
  { symbol: "AL30D", c: 63.35, pct_change: -0.07 },
  { symbol: "GD30D", c: 64.53, pct_change: -0.26 },
  { symbol: "GD35D", c: 79.32 },
];

function makeProvider(payload: unknown): Data912BondProvider {
  const fetchImpl = async (): Promise<Response> =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  return new Data912BondProvider({ fetchImpl: fetchImpl as typeof fetch });
}

describe("Data912BondProvider.getQuote", () => {
  it("returns cleanPrice + changePct from data912 row", async () => {
    const p = makeProvider(PAYLOAD);
    const q = await p.getQuote("AL30");
    expect(q.symbol).toBe("AL30");
    expect(q.upstreamSymbol).toBe("AL30D");
    expect(q.source).toBe("data912");
    expect(q.cleanPrice).toBe(63.35);
    expect(q.changePct).toBe(-0.07);
    expect(q.previousClose).toBeCloseTo(63.35 / (1 - 0.07 / 100), 4);
  });

  it("leaves previousClose null when pct_change is absent", async () => {
    const p = makeProvider(PAYLOAD);
    const q = await p.getQuote("GD35");
    expect(q.cleanPrice).toBe(79.32);
    expect(q.changePct).toBeNull();
    expect(q.previousClose).toBeNull();
  });

  it("throws Data912ContractError when the symbol isn't in the snapshot", async () => {
    const p = makeProvider(PAYLOAD);
    await expect(p.getQuote("XYZ")).rejects.toBeInstanceOf(Data912ContractError);
  });

  it("throws Data912ContractError on malformed payload", async () => {
    const p = makeProvider({ wrong: "shape" });
    await expect(p.getQuote("AL30")).rejects.toBeInstanceOf(Data912ContractError);
  });
});

describe("Data912BondProvider.getHistory", () => {
  it("returns a single-point series for the symbol", async () => {
    const p = makeProvider(PAYLOAD);
    const h = await p.getHistory("AL30");
    expect(h.symbol).toBe("AL30");
    expect(h.source).toBe("data912");
    expect(h.points).toHaveLength(1);
    expect(h.points[0]!.close).toBe(63.35);
  });
});
