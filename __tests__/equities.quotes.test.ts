import { afterEach, describe, expect, it } from "vitest";
import {
  __resetEquitiesCache,
  getEquitiesSnapshot,
} from "@/lib/equities/quotes";

function chartPayload(opts: {
  price: number;
  prevClose: number;
  ytdAnchor: number;
  volume?: number;
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
            regularMarketVolume: opts.volume ?? 100_000,
            regularMarketTime: opts.time ?? 1_747_416_000,
          },
          indicators: {
            quote: [
              {
                close: [opts.ytdAnchor, opts.ytdAnchor + 1, null, opts.price],
              },
            ],
          },
        },
      ],
      error: null,
    },
  };
}

describe("getEquitiesSnapshot", () => {
  afterEach(() => __resetEquitiesCache());

  it("returns one snapshot per requested catalog symbol", async () => {
    const snaps = await getEquitiesSnapshot(["GGAL", "YPFD"], {
      useCache: false,
      fetcher: async (sym) => {
        if (sym === "GGAL.BA") {
          return chartPayload({ price: 6450, prevClose: 6320, ytdAnchor: 5000 });
        }
        if (sym === "YPFD.BA") {
          return chartPayload({ price: 38500, prevClose: 38200, ytdAnchor: 28000 });
        }
        throw new Error(`unexpected ${sym}`);
      },
    });

    expect(snaps).toHaveLength(2);
    const ggal = snaps.find((s) => s.symbol === "GGAL")!;
    expect(ggal.last).toBe(6450);
    expect(ggal.prevClose).toBe(6320);
    expect(ggal.dayChange).toBeCloseTo(130, 5);
    expect(ggal.dayChangePct).toBeCloseTo(130 / 6320, 6);
    expect(ggal.ytdChangePct).toBeCloseTo((6450 - 5000) / 5000, 6);
    expect(ggal.sector).toBe("banks");
    expect(ggal.bucket).toBe("large");
  });

  it("drops symbols not in the catalog", async () => {
    const snaps = await getEquitiesSnapshot(["GGAL", "NOPE"], {
      useCache: false,
      fetcher: async () => chartPayload({ price: 1, prevClose: 1, ytdAnchor: 1 }),
    });
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.symbol).toBe("GGAL");
  });

  it("returns an error row when the fetcher throws for one symbol", async () => {
    const snaps = await getEquitiesSnapshot(["GGAL", "YPFD"], {
      useCache: false,
      fetcher: async (sym) => {
        if (sym === "GGAL.BA") {
          return chartPayload({ price: 6450, prevClose: 6320, ytdAnchor: 5000 });
        }
        throw new Error("yahoo down");
      },
    });
    const ypfd = snaps.find((s) => s.symbol === "YPFD")!;
    expect(ypfd.last).toBeNull();
    expect(ypfd.dayChangePct).toBeNull();
    expect(ypfd.error).toContain("yahoo down");
  });

  it("honors the in-process cache across calls", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return chartPayload({ price: 6450, prevClose: 6320, ytdAnchor: 5000 });
    };
    await getEquitiesSnapshot(["GGAL"], { fetcher });
    await getEquitiesSnapshot(["GGAL"], { fetcher });
    expect(calls).toBe(1);
  });

  it("ignores duplicate symbols within a single batch", async () => {
    let calls = 0;
    const snaps = await getEquitiesSnapshot(["GGAL", "ggal", "GGAL"], {
      useCache: false,
      fetcher: async () => {
        calls++;
        return chartPayload({ price: 6450, prevClose: 6320, ytdAnchor: 5000 });
      },
    });
    expect(snaps).toHaveLength(1);
    expect(calls).toBe(1);
  });
});
