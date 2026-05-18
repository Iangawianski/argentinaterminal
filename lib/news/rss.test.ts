import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  NEWS_SOURCES,
  RssParseError,
  __canonicalUrl,
  fetchNews,
  filterByKeywords,
  parseRssDocument,
  type NewsItem,
} from "./rss";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "__fixtures__", name), "utf8");

const AMBITO = NEWS_SOURCES.find((s) => s.id === "ambito-economia")!;
const LANACION = NEWS_SOURCES.find((s) => s.id === "lanacion-economia")!;

describe("parseRssDocument", () => {
  it("parses Ámbito RSS 2.0 with CDATA into normalised items", () => {
    const items = parseRssDocument(fixture("ambito-economia.xml"), AMBITO);
    expect(items.length).toBeGreaterThan(3);
    const first = items[0]!;
    expect(first.url).toMatch(/^https:\/\/www\.ambito\.com\//);
    expect(first.title.length).toBeGreaterThan(5);
    expect(first.source.id).toBe("ambito-economia");
    expect(first.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("parses La Nación RSS with namespaces", () => {
    const items = parseRssDocument(fixture("lanacion-economia.xml"), LANACION);
    expect(items.length).toBeGreaterThan(0);
    const sample = items[0]!;
    expect(sample.url).toMatch(/^https:\/\/www\.lanacion\.com\.ar\//);
    expect(sample.source.label).toContain("La Nación");
    // The summary should be HTML-stripped.
    expect(sample.summary).not.toMatch(/<[^>]+>/);
  });

  it("classifies dolar-themed items", () => {
    const items = parseRssDocument(fixture("ambito-economia.xml"), AMBITO);
    const dolarItem = items.find((i) => /d[óo]lar/i.test(i.title));
    if (dolarItem) {
      expect(dolarItem.tag).toBe("dolar");
    }
  });

  it("throws RssParseError on garbage XML", () => {
    expect(() => parseRssDocument("<not><real>", AMBITO)).toThrow(RssParseError);
  });

  it("throws RssParseError when feed shape is unrecognised", () => {
    expect(() => parseRssDocument("<root><foo/></root>", AMBITO)).toThrow(RssParseError);
  });
});

describe("filterByKeywords", () => {
  const sample: NewsItem[] = [
    {
      url: "https://x/a",
      title: "Dólar MEP sube",
      summary: "",
      publishedAt: null,
      source: { id: "x", label: "X", topic: "economia" },
      tag: "dolar",
    },
    {
      url: "https://x/b",
      title: "Inflación INDEC",
      summary: "abril 2026",
      publishedAt: null,
      source: { id: "x", label: "X", topic: "economia" },
      tag: "economia",
    },
  ];

  it("returns all items when keyword list empty", () => {
    expect(filterByKeywords(sample, [])).toHaveLength(2);
  });

  it("matches case-insensitively on title or summary", () => {
    expect(filterByKeywords(sample, ["mep"])).toHaveLength(1);
    expect(filterByKeywords(sample, ["INDEC"])).toHaveLength(1);
    expect(filterByKeywords(sample, ["zzznotfound"])).toHaveLength(0);
  });
});

describe("canonicalUrl", () => {
  it("strips query + hash + trailing slash + lowers host", () => {
    expect(__canonicalUrl("https://Ambito.COM/a/b/?utm=x#frag")).toBe(
      "https://ambito.com/a/b",
    );
  });

  it("falls back to lowercase on garbage input", () => {
    expect(__canonicalUrl("NOT A URL")).toBe("not a url");
  });
});

describe("fetchNews", () => {
  it("aggregates two sources, dedupes, sorts by recency", async () => {
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input);
      if (u.includes("ambito.com/rss/pages/economia.xml")) {
        return new Response(fixture("ambito-economia.xml"), { status: 200 });
      }
      if (u.includes("lanacion.com.ar")) {
        return new Response(fixture("lanacion-economia.xml"), { status: 200 });
      }
      return new Response("", { status: 404 });
    };
    const out = await fetchNews({
      fetchImpl: fetchImpl as typeof fetch,
      sourceIds: ["ambito-economia", "lanacion-economia"],
      limit: 20,
    });
    expect(out.items.length).toBeGreaterThan(2);
    expect(out.items.length).toBeLessThanOrEqual(20);
    expect(out.errors).toEqual([]);
    // sort: most recent first
    const ts = out.items
      .map((i) => (i.publishedAt ? Date.parse(i.publishedAt) : 0))
      .filter((n) => n > 0);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i - 1]!).toBeGreaterThanOrEqual(ts[i]!);
    }
  });

  it("isolates a single source failure as an error entry", async () => {
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input);
      if (u.includes("ambito.com/rss/pages/economia.xml")) {
        return new Response(fixture("ambito-economia.xml"), { status: 200 });
      }
      return new Response("", { status: 503 });
    };
    const out = await fetchNews({
      fetchImpl: fetchImpl as typeof fetch,
      sourceIds: ["ambito-economia", "lanacion-economia", "clarin-economia"],
    });
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.errors.map((e) => e.sourceId).sort()).toEqual([
      "clarin-economia",
      "lanacion-economia",
    ]);
  });

  it("respects the keyword filter", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(fixture("ambito-economia.xml"), { status: 200 });
    const out = await fetchNews({
      fetchImpl: fetchImpl as typeof fetch,
      sourceIds: ["ambito-economia"],
      keywords: ["dólar", "plazo fijo"],
    });
    for (const item of out.items) {
      const hay = `${item.title} ${item.summary}`.toLowerCase();
      expect(/(dólar|plazo fijo)/.test(hay)).toBe(true);
    }
  });
});
