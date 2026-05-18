import { describe, expect, it, vi } from "vitest";

import chartFixture from "./__fixtures__/yahoo-ggal.json";
import summaryFixture from "./__fixtures__/yahoo-aapl-summary.json";
import { qualifySymbol, YahooQuoteProvider } from "./yahoo";

function mockFetch(body: unknown, init?: { ok?: boolean; status?: number }) {
  return vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Headers(),
  })) as unknown as typeof fetch;
}

/**
 * Lookup-based mock fetch so a single test can serve multiple endpoints
 * (chart + quoteSummary). Keys are URL substrings.
 */
function routedFetch(routes: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [needle, body] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return {
          ok: true,
          status: 200,
          json: async () => body,
          text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
          headers: new Headers(),
        } as Response;
      }
    }
    throw new Error(`routedFetch: no route for ${url}`);
  }) as unknown as typeof fetch;
}

describe("qualifySymbol", () => {
  it("appends suffix when no exchange suffix present", () => {
    expect(qualifySymbol("ggal", ".BA")).toBe("GGAL.BA");
  });
  it("leaves already-qualified symbols intact when a suffix is present", () => {
    expect(qualifySymbol("YPF.BA", ".BA")).toBe("YPF.BA");
    expect(qualifySymbol("BRK.B", ".BA")).toBe("BRK.B");
  });
});

describe("YahooQuoteProvider", () => {
  it("parses a quote from the chart fixture", async () => {
    const provider = new YahooQuoteProvider({ fetchImpl: mockFetch(chartFixture) });
    const quote = await provider.getQuote("GGAL");
    expect(quote.symbol).toBe("GGAL.BA");
    expect(quote.source).toBe("yahoo");
    expect(quote.price).toBeCloseTo(5240.5);
    expect(quote.previousClose).toBeCloseTo(5125.0);
    expect(quote.changePct).not.toBeNull();
    expect(quote.changePct!).toBeGreaterThan(0);
    expect(quote.currency).toBe("ARS");
    expect(quote.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("derives an intraday series from chart indicators", async () => {
    const provider = new YahooQuoteProvider({ fetchImpl: mockFetch(chartFixture) });
    const series = await provider.getIntraday("GGAL");
    expect(series.symbol).toBe("GGAL.BA");
    expect(series.points).toHaveLength(4);
    expect(series.points[0]?.price).toBeCloseTo(5180);
    expect(series.points.at(-1)?.price).toBeCloseTo(5240.5);
  });

  it("returns rich fundamentals when quoteSummary succeeds", async () => {
    const provider = new YahooQuoteProvider({
      fetchImpl: routedFetch({
        "quoteSummary": summaryFixture,
        "chart/": chartFixture,
      }),
      crumbResolver: async () => ({ cookie: "A1=stub", crumb: "stubcrumb" }),
      suffix: "",
    });
    const fund = await provider.getFundamentals("AAPL");
    expect(fund.source).toBe("yahoo");
    expect(fund.marketCap).toBe(3_100_000_000_000);
    expect(fund.peRatio).toBeCloseTo(32.4);
    // 0.0048 raw → 0.48% normalized.
    expect(fund.dividendYield).toBeCloseTo(0.48);
    expect(fund.fiftyTwoWeekHigh).toBeCloseTo(220.5);
  });

  it("falls back to chart-only stats when quoteSummary fails", async () => {
    const provider = new YahooQuoteProvider({
      fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("quoteSummary")) {
          return {
            ok: false,
            status: 403,
            json: async () => ({}),
            text: async () => "forbidden",
            headers: new Headers(),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => chartFixture,
          text: async () => JSON.stringify(chartFixture),
          headers: new Headers(),
        } as Response;
      }) as unknown as typeof fetch,
      crumbResolver: async () => ({ cookie: "A1=stub", crumb: "stubcrumb" }),
    });
    const fund = await provider.getFundamentals("GGAL");
    expect(fund.source).toBe("yahoo+chart-fallback");
    expect(fund.fiftyTwoWeekHigh).toBeCloseTo(6210);
    expect(fund.marketCap).toBeNull();
    expect(fund.peRatio).toBeNull();
  });

  it("surfaces upstream errors with the symbol attached", async () => {
    const errBody = {
      chart: {
        result: null,
        error: { code: "Not Found", description: "no quotes found" },
      },
    };
    const provider = new YahooQuoteProvider({ fetchImpl: mockFetch(errBody) });
    await expect(provider.getQuote("XXX")).rejects.toThrow(/Not Found/);
  });

  it("throws on non-2xx HTTP responses", async () => {
    const provider = new YahooQuoteProvider({
      fetchImpl: mockFetch({}, { ok: false, status: 502 }),
    });
    await expect(provider.getQuote("GGAL")).rejects.toThrow(/HTTP 502/);
  });
});
