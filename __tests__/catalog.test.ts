import { describe, expect, it } from "vitest";
import { SYMBOL_CATALOG, findSymbol } from "@/lib/catalog";

describe("symbol catalog", () => {
  it("exposes GGAL as a BYMA stock", () => {
    const ggal = findSymbol("GGAL");
    expect(ggal).toBeDefined();
    expect(ggal?.market).toBe("BYMA");
    expect(ggal?.kind).toBe("stock");
  });

  it("is case-insensitive on lookup", () => {
    expect(findSymbol("ggal")).toEqual(findSymbol("GGAL"));
  });

  it("returns undefined for unknown symbols", () => {
    expect(findSymbol("UNKNOWN")).toBeUndefined();
  });

  it("has no duplicate symbols", () => {
    const seen = new Set<string>();
    for (const s of SYMBOL_CATALOG) {
      expect(seen.has(s.symbol)).toBe(false);
      seen.add(s.symbol);
    }
  });
});
