import { describe, expect, it } from "vitest";
import { createYahooProvider, toYahooSymbol } from "@/lib/providers/yahoo";
import { ProviderError } from "@/lib/providers/types";

function ggalFixture() {
  return {
    chart: {
      result: [
        {
          meta: {
            currency: "ARS",
            symbol: "GGAL.BA",
            regularMarketPrice: 6450.5,
            previousClose: 6320,
            chartPreviousClose: 6320,
            regularMarketDayHigh: 6500,
            regularMarketDayLow: 6280,
            regularMarketVolume: 1_234_567,
            regularMarketTime: 1_747_416_000,
          },
          indicators: {
            quote: [{ open: [6330] }],
          },
        },
      ],
      error: null,
    },
  };
}

describe("yahoo provider", () => {
  it("maps GGAL to GGAL.BA", () => {
    expect(toYahooSymbol("GGAL")).toBe("GGAL.BA");
    expect(toYahooSymbol("ggal")).toBe("GGAL.BA");
  });

  it("returns undefined for unmapped symbol", () => {
    expect(toYahooSymbol("UNKNOWN")).toBeUndefined();
  });

  it("normalizes a healthy Yahoo response into a Quote", async () => {
    const provider = createYahooProvider(async () => ggalFixture());
    const quote = await provider.fetchQuote("GGAL");
    expect(quote.symbol).toBe("GGAL");
    expect(quote.last).toBe(6450.5);
    expect(quote.previousClose).toBe(6320);
    expect(quote.change).toBeCloseTo(130.5, 5);
    expect(quote.open).toBe(6330);
    expect(quote.dayHigh).toBe(6500);
    expect(quote.dayLow).toBe(6280);
    expect(quote.volume).toBe(1_234_567);
    expect(quote.currency).toBe("ARS");
    expect(quote.source).toBe("yahoo");
    expect(quote.timestamp).toBe(1_747_416_000 * 1000);
  });

  it("falls back to chartPreviousClose when previousClose is missing", async () => {
    const provider = createYahooProvider(async () => {
      const fx = ggalFixture();
      delete (fx.chart.result[0]!.meta as Record<string, unknown>)
        .previousClose;
      return fx;
    });
    const quote = await provider.fetchQuote("GGAL");
    expect(quote.previousClose).toBe(6320);
  });

  it("throws ProviderError on unmapped symbol", async () => {
    const provider = createYahooProvider(async () => ggalFixture());
    await expect(provider.fetchQuote("UNKNOWN")).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("throws ProviderError when chart has no result", async () => {
    const provider = createYahooProvider(async () => ({
      chart: { result: [], error: { description: "empty" } },
    }));
    await expect(provider.fetchQuote("GGAL")).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("throws ProviderError when price field is missing", async () => {
    const provider = createYahooProvider(async () => {
      const fx = ggalFixture();
      delete (fx.chart.result[0]!.meta as Record<string, unknown>)
        .regularMarketPrice;
      return fx;
    });
    await expect(provider.fetchQuote("GGAL")).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
