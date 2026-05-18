import { describe, expect, it } from "vitest";
import {
  EQUITY_CATALOG,
  EQUITY_SECTORS,
  bucketWeight,
  equitiesBySector,
  findEquity,
  isEquitySymbol,
  leaderPanel,
} from "@/lib/equities/catalog";

describe("equity catalog", () => {
  it("ships at least 50 tickers per Phase 5 universe target", () => {
    expect(EQUITY_CATALOG.length).toBeGreaterThanOrEqual(50);
  });

  it("has no duplicate symbols", () => {
    const seen = new Set<string>();
    for (const e of EQUITY_CATALOG) {
      expect(seen.has(e.symbol), `duplicate ${e.symbol}`).toBe(false);
      seen.add(e.symbol);
    }
  });

  it("places every ticker in a known sector", () => {
    const allowed = new Set(EQUITY_SECTORS);
    for (const e of EQUITY_CATALOG) {
      expect(allowed.has(e.sector), `unknown sector ${e.sector} on ${e.symbol}`).toBe(true);
    }
  });

  it("findEquity is case-insensitive", () => {
    expect(findEquity("ggal")).toEqual(findEquity("GGAL"));
  });

  it("isEquitySymbol identifies catalog members", () => {
    expect(isEquitySymbol("GGAL")).toBe(true);
    expect(isEquitySymbol("UNKNOWN")).toBe(false);
  });

  it("equitiesBySector returns the subset for the sector", () => {
    const banks = equitiesBySector("banks");
    expect(banks.length).toBeGreaterThan(0);
    for (const b of banks) {
      expect(b.sector).toBe("banks");
    }
  });

  it("leaderPanel contains GGAL, YPFD and at least 10 names", () => {
    const leaders = leaderPanel();
    expect(leaders.length).toBeGreaterThanOrEqual(10);
    expect(leaders.some((e) => e.symbol === "GGAL")).toBe(true);
    expect(leaders.some((e) => e.symbol === "YPFD")).toBe(true);
  });

  it("bucketWeight is monotone: large > mid > small", () => {
    expect(bucketWeight("large")).toBeGreaterThan(bucketWeight("mid"));
    expect(bucketWeight("mid")).toBeGreaterThan(bucketWeight("small"));
  });

  it("every ADR mapping is uppercase letters/digits only", () => {
    for (const e of EQUITY_CATALOG) {
      if (e.adr) {
        expect(e.adr).toMatch(/^[A-Z0-9]+$/);
      }
    }
  });
});
