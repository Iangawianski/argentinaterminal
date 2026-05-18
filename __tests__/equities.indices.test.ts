import { describe, expect, it } from "vitest";
import {
  INDEX_CATALOG,
  getIndexSnapshot,
} from "@/lib/equities/indices";

function chartPayload(opts: {
  price: number;
  prevClose: number;
  closes: ReadonlyArray<number | null>;
  time?: number;
}) {
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: opts.price,
            previousClose: opts.prevClose,
            chartPreviousClose: opts.prevClose,
            regularMarketTime: opts.time ?? 1_747_416_000,
          },
          indicators: {
            quote: [{ close: opts.closes }],
          },
        },
      ],
      error: null,
    },
  };
}

describe("getIndexSnapshot", () => {
  const merval = INDEX_CATALOG.find((i) => i.symbol === "MERVAL")!;

  it("normalizes a healthy Yahoo response", async () => {
    const snap = await getIndexSnapshot(merval, {
      fetcher: async () =>
        chartPayload({
          price: 2_500_000,
          prevClose: 2_460_000,
          closes: [2_300_000, 2_330_000, 2_400_000, 2_450_000, 2_500_000],
        }),
    });
    expect(snap.last).toBe(2_500_000);
    expect(snap.prevClose).toBe(2_460_000);
    expect(snap.dayChangePct).toBeCloseTo(40_000 / 2_460_000, 6);
    // YTD anchor = first valid close.
    expect(snap.ytdChangePct).toBeCloseTo((2_500_000 - 2_300_000) / 2_300_000, 6);
    expect(snap.sparkline.length).toBeGreaterThan(0);
    expect(snap.topConstituents).toEqual(merval.topConstituents);
  });

  it("returns an error snapshot when Yahoo throws", async () => {
    const snap = await getIndexSnapshot(merval, {
      fetcher: async () => {
        throw new Error("yahoo down");
      },
    });
    expect(snap.last).toBeNull();
    expect(snap.error).toContain("yahoo down");
    expect(snap.sparkline).toEqual([]);
  });

  it("caps the sparkline at the configured window", async () => {
    const closes = Array.from({ length: 60 }, (_, i) => 1_000_000 + i * 1000);
    const snap = await getIndexSnapshot(merval, {
      fetcher: async () =>
        chartPayload({
          price: closes[closes.length - 1]!,
          prevClose: closes[closes.length - 2]!,
          closes,
        }),
    });
    expect(snap.sparkline.length).toBe(20);
    // Sparkline should preserve chronological order (oldest → newest).
    expect(snap.sparkline[0]).toBeLessThan(
      snap.sparkline[snap.sparkline.length - 1]!,
    );
  });
});
