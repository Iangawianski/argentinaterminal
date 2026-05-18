import { describe, expect, it, vi } from "vitest";

import { parseRavaCsv, RavaBondProvider, RavaContractError } from "./rava";

// Inline the CSV fixture (same content as __fixtures__/rava-al30d.csv) so the
// test suite runs under the jsdom environment without touching node:fs.
const FIXTURE = [
  "fecha,apertura,maximo,minimo,cierre,volumen,openinterest",
  "2026-05-09,71.50,72.10,71.20,71.85,1250000,0",
  "2026-05-10,71.85,72.40,71.60,72.20,980000,0",
  "2026-05-11,72.20,72.75,71.95,72.05,1430000,0",
  "2026-05-12,72.05,72.30,71.40,71.55,1110000,0",
  "2026-05-13,71.55,72.00,71.10,71.95,1280000,0",
  "2026-05-14,71.95,72.55,71.80,72.40,1075000,0",
  "2026-05-15,72.40,73.10,72.30,72.85,1320000,0",
  "2026-05-16,72.85,73.50,72.65,73.25,1490000,0",
].join("\n");

function mockFetch(body: string, init?: { ok?: boolean; status?: number }) {
  return vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => body,
    json: async () => body,
    headers: new Headers(),
  })) as unknown as typeof fetch;
}

describe("parseRavaCsv", () => {
  it("parses the AL30D fixture into sorted daily rows", () => {
    const rows = parseRavaCsv(FIXTURE);
    expect(rows).toHaveLength(8);
    expect(rows[0]!.date).toBe("2026-05-09");
    expect(rows[rows.length - 1]!.date).toBe("2026-05-16");
    expect(rows[rows.length - 1]!.close).toBeCloseTo(73.25);
    expect(rows[0]!.volume).toBe(1_250_000);
  });

  it("accepts DD/MM/YYYY dates and normalizes to ISO", () => {
    const csv = [
      "fecha,apertura,maximo,minimo,cierre,volumen,openinterest",
      "15/05/2026,72.40,73.10,72.30,72.85,1320000,0",
      "16/05/2026,72.85,73.50,72.65,73.25,1490000,0",
    ].join("\n");
    const rows = parseRavaCsv(csv);
    expect(rows[0]!.date).toBe("2026-05-15");
    expect(rows[1]!.date).toBe("2026-05-16");
  });

  it("throws RavaContractError when a required header is missing", () => {
    const csv = "fecha,apertura,maximo,minimo,volumen\n2026-05-16,72,73,71,1000";
    expect(() => parseRavaCsv(csv)).toThrow(RavaContractError);
  });

  it("throws RavaContractError on an empty body", () => {
    expect(() => parseRavaCsv("")).toThrow(RavaContractError);
  });

  it("skips rows with non-finite close prices", () => {
    const csv = [
      "fecha,apertura,maximo,minimo,cierre,volumen,openinterest",
      "2026-05-16,72.40,73.10,72.30,N/A,1320000,0",
      "2026-05-15,72.85,73.50,72.65,73.25,1490000,0",
    ].join("\n");
    const rows = parseRavaCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2026-05-15");
  });
});

describe("RavaBondProvider", () => {
  it("returns latest close + previous close + changePct for AL30", async () => {
    const provider = new RavaBondProvider({ fetchImpl: mockFetch(FIXTURE) });
    const quote = await provider.getQuote("AL30");
    expect(quote.symbol).toBe("AL30");
    expect(quote.upstreamSymbol).toBe("AL30D");
    expect(quote.source).toBe("rava");
    expect(quote.cleanPrice).toBeCloseTo(73.25);
    expect(quote.previousClose).toBeCloseTo(72.85);
    // (73.25 - 72.85) / 72.85 ≈ 0.549%
    expect(quote.changePct).toBeCloseTo(0.549, 1);
    expect(quote.asOf.startsWith("2026-05-16")).toBe(true);
  });

  it("falls back to last-row close even with a single row (no previousClose)", async () => {
    const csv = [
      "fecha,apertura,maximo,minimo,cierre,volumen,openinterest",
      "2026-05-16,72.40,73.10,72.30,73.25,1320000,0",
    ].join("\n");
    const provider = new RavaBondProvider({ fetchImpl: mockFetch(csv) });
    const quote = await provider.getQuote("AL30");
    expect(quote.cleanPrice).toBeCloseTo(73.25);
    expect(quote.previousClose).toBeNull();
    expect(quote.changePct).toBeNull();
  });

  it("throws on HTTP 5xx (composite fallback signal)", async () => {
    const provider = new RavaBondProvider({
      fetchImpl: mockFetch("upstream broken", { ok: false, status: 503 }),
    });
    await expect(provider.getQuote("AL30")).rejects.toThrow(/HTTP 503/);
  });

  it("getHistory returns trimmed series", async () => {
    const provider = new RavaBondProvider({ fetchImpl: mockFetch(FIXTURE) });
    const hist = await provider.getHistory("AL30", 3);
    expect(hist.points).toHaveLength(3);
    expect(hist.points[hist.points.length - 1]!.date).toBe("2026-05-16");
    expect(hist.points[0]!.date).toBe("2026-05-14");
  });
});
