import { describe, expect, it, vi } from "vitest";

import fixture from "./__fixtures__/dolarapi-dolares.json";
import { DolarApiProvider } from "./dolarapi";

function mockFetch(body: unknown, init?: { ok?: boolean; status?: number }) {
  return vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("DolarApiProvider", () => {
  it("parses the five canonical rates and drops unknown casas", async () => {
    const provider = new DolarApiProvider({ fetchImpl: mockFetch(fixture) });
    const all = await provider.getAll();
    const keys = all.map((q) => q.key);
    expect(keys).toEqual(["oficial", "mayorista", "mep", "ccl", "blue"]);
    expect(all).toHaveLength(5);
    const ccl = all.find((q) => q.key === "ccl");
    expect(ccl?.ask).toBeCloseTo(1275);
    expect(ccl?.bid).toBeCloseTo(1260);
    expect(ccl?.label).toBe("CCL");
    expect(ccl?.source).toBe("dolarapi");
    expect(ccl?.asOf).toBe("2026-05-16T16:00:00.000Z");
  });

  it("`get(key)` returns a single quote by key", async () => {
    const provider = new DolarApiProvider({ fetchImpl: mockFetch(fixture) });
    const mep = await provider.get("mep");
    expect(mep.ask).toBeCloseTo(1245);
    expect(mep.bid).toBeCloseTo(1235);
  });

  it("throws when DolarApi returns non-2xx", async () => {
    const provider = new DolarApiProvider({
      fetchImpl: mockFetch([], { ok: false, status: 503 }),
    });
    await expect(provider.getAll()).rejects.toThrow(/HTTP 503/);
  });

  it("throws when a requested key is missing from upstream", async () => {
    const provider = new DolarApiProvider({ fetchImpl: mockFetch([]) });
    await expect(provider.get("mep")).rejects.toThrow(/mep/);
  });
});
