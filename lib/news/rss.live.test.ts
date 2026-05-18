import { describe, expect, it } from "vitest";

import { NEWS_SOURCES, fetchNews } from "./rss";

const LIVE = process.env.TERMINAL_LIVE_TESTS === "1";

describe.skipIf(!LIVE)("RSS live aggregator (set TERMINAL_LIVE_TESTS=1)", () => {
  it("Ámbito Economía still returns items", async () => {
    const out = await fetchNews({
      sourceIds: ["ambito-economia"],
      limit: 5,
    });
    expect(out.errors).toEqual([]);
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.items[0]?.url).toMatch(/^https:\/\//);
  }, 15_000);

  it("returns items from at least 2 of the configured sources", async () => {
    const out = await fetchNews({ limit: 40 });
    const sourceIds = new Set(out.items.map((i) => i.source.id));
    const possible = NEWS_SOURCES.length;
    expect(sourceIds.size).toBeGreaterThanOrEqual(2);
    expect(possible).toBeGreaterThanOrEqual(2);
  }, 30_000);
});
