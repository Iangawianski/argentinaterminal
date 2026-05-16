import { describe, expect, it } from "vitest";
import { formatArs, formatPct } from "@/lib/format";

describe("formatArs", () => {
  it("formats ARS with the es-AR locale", () => {
    const out = formatArs(6450.5);
    // The locale uses a non-breaking space and "$" as the symbol.
    expect(out).toMatch(/\$/);
    expect(out).toMatch(/6\.450,50/);
  });
});

describe("formatPct", () => {
  it("formats positive percentages with a sign", () => {
    expect(formatPct(0.0205)).toMatch(/\+2,05/);
  });
  it("formats negatives with a minus", () => {
    expect(formatPct(-0.011)).toMatch(/-1,10/);
  });
});
