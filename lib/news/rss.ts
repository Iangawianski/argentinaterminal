import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

/**
 * RSS news aggregator for Argentine economy/finance outlets.
 *
 * We picked sources whose RSS still works in May 2026 and that publish
 * decent volume on macro/markets topics. Each source has a `tag` that
 * gives the UI a stable color/label and a `topic` that helps the keyword
 * filter pick relevant items.
 *
 *   - Ámbito Financiero — `economia.xml` + `finanzas.xml`
 *   - La Nación — `arc/outboundfeeds/rss/category/economia`
 *   - Clarín — `rss/economia`
 *
 * Many other outlets (Cronista, BAE, Infobae, iProfesional, Página/12)
 * dropped or broke their RSS during 2024-2026 — we keep them out of the
 * default rotation and revisit when a working feed reappears.
 *
 * Implementation notes:
 *   - We use `fast-xml-parser` (≤ 50 KB gz, zero native deps).
 *   - The parser is tolerant to RSS 2.0 and Atom — Ámbito is RSS 2.0 with
 *     CDATA, La Nación + Clarín are RSS 2.0 with namespaces.
 *   - We dedupe items by canonical URL (lower-cased, query-stripped) so
 *     "dólar hoy" stories that recirculate across sources only show once.
 *   - We sort by `pubDate` descending; items without a pubDate go last.
 *   - Filter step: optional keyword list (case-insensitive substring on
 *     `title + description`). If the keyword list is empty the filter is
 *     a no-op.
 *   - Cache: caller-provided. We keep the adapter cache-free so callers
 *     can plug it into `unstable_cache` / Next route revalidate.
 */

export class RssParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RssParseError";
  }
}

export interface RssSource {
  /** Stable identifier used by the UI for color/tag. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Feed URL. */
  url: string;
  /** Broad topic ("economia", "finanzas") for the UI grouping. */
  topic: "economia" | "finanzas" | "mercados";
}

export const NEWS_SOURCES: readonly RssSource[] = [
  {
    id: "ambito-economia",
    label: "Ámbito · Economía",
    url: "https://www.ambito.com/rss/pages/economia.xml",
    topic: "economia",
  },
  {
    id: "ambito-finanzas",
    label: "Ámbito · Finanzas",
    url: "https://www.ambito.com/rss/pages/finanzas.xml",
    topic: "finanzas",
  },
  {
    id: "lanacion-economia",
    label: "La Nación · Economía",
    url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/",
    topic: "economia",
  },
  {
    id: "clarin-economia",
    label: "Clarín · Economía",
    url: "https://www.clarin.com/rss/economia/",
    topic: "economia",
  },
] as const;

export const NewsItemSchema = z.object({
  /** Stable URL — primary dedup key. */
  url: z.string(),
  title: z.string(),
  summary: z.string(),
  /** ISO8601 publication timestamp; null if upstream omits it. */
  publishedAt: z.string().nullable(),
  source: z.object({
    id: z.string(),
    label: z.string(),
    topic: z.enum(["economia", "finanzas", "mercados"]),
  }),
  /**
   * Loose categorisation used by the UI tags. `economia` is the default
   * bucket. We try to upgrade to `dolar`, `mercados` or `politica` based on
   * a tiny keyword match.
   */
  tag: z.enum(["economia", "dolar", "mercados", "politica", "finanzas"]),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export interface FetchNewsOptions {
  fetchImpl?: typeof fetch;
  /** Hard cap on returned items (after dedup + sort). Default 40. */
  limit?: number;
  /** Restrict to sources whose `id` is in this set. Default = all. */
  sourceIds?: ReadonlyArray<string>;
  /**
   * Case-insensitive keyword filter. If non-empty, an item must mention at
   * least one keyword in title or summary. Empty array = no filter.
   */
  keywords?: ReadonlyArray<string>;
  /**
   * `next.revalidate` to pass on the underlying fetch. Defaults to 600
   * (10 minutes) per the issue scope. Ignored by callers that pass a
   * custom `fetchImpl` without Next semantics.
   */
  cacheTtlSeconds?: number;
}

const USER_AGENT =
  "ArgentinaTerminal/0.1 (+https://github.com/argentinaterminal/argentinaterminal)";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
  // RSS feeds frequently wrap text in CDATA; fast-xml-parser strips it by
  // default but we keep the `cdataPropName` config off so the text just
  // surfaces on the same key.
  parseTagValue: false,
  parseAttributeValue: false,
});

interface RawItem {
  title?: string | { "#text"?: string };
  link?: string | string[] | { "#text"?: string; "@href"?: string };
  description?: string | { "#text"?: string };
  pubDate?: string;
  "dc:date"?: string;
  guid?: string | { "#text"?: string };
}

/** Parse a single RSS document into normalised items. Exported for tests. */
export function parseRssDocument(xml: string, source: RssSource): NewsItem[] {
  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml);
  } catch (err) {
    throw new RssParseError(
      `Failed to parse XML for ${source.id}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const root = parsed as { rss?: { channel?: { item?: unknown } }; feed?: { entry?: unknown } };
  // RSS 2.0
  const rssItems = root.rss?.channel?.item;
  if (rssItems !== undefined) {
    const list = Array.isArray(rssItems) ? rssItems : [rssItems];
    return list
      .map((it) => normaliseRss(it as RawItem, source))
      .filter((it): it is NewsItem => it !== null);
  }
  // Atom (fallback — none of our default sources use it, but keep it tolerant)
  const atomEntries = root.feed?.entry;
  if (atomEntries !== undefined) {
    const list = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
    return list
      .map((it) => normaliseAtom(it as RawItem, source))
      .filter((it): it is NewsItem => it !== null);
  }
  throw new RssParseError(`Unrecognised feed shape for ${source.id}`);
}

function normaliseRss(raw: RawItem, source: RssSource): NewsItem | null {
  const title = textOf(raw.title);
  const url = linkOf(raw.link) ?? textOf(raw.guid) ?? "";
  if (!title || !url) return null;
  const summary = stripHtml(textOf(raw.description) ?? "");
  const publishedAt = parseDate(raw.pubDate ?? raw["dc:date"] ?? null);
  return NewsItemSchema.parse({
    url,
    title,
    summary,
    publishedAt,
    source: { id: source.id, label: source.label, topic: source.topic },
    tag: classify(title, summary, source.topic),
  });
}

function normaliseAtom(raw: RawItem, source: RssSource): NewsItem | null {
  const title = textOf(raw.title);
  const url = linkOf(raw.link);
  if (!title || !url) return null;
  const summary = stripHtml(textOf(raw.description) ?? "");
  const publishedAt = parseDate(raw.pubDate ?? raw["dc:date"] ?? null);
  return NewsItemSchema.parse({
    url,
    title,
    summary,
    publishedAt,
    source: { id: source.id, label: source.label, topic: source.topic },
    tag: classify(title, summary, source.topic),
  });
}

function textOf(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "#text" in v) {
    const inner = (v as { "#text"?: unknown })["#text"];
    if (typeof inner === "string") return inner.trim();
  }
  return undefined;
}

function linkOf(v: RawItem["link"]): string | undefined {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    for (const candidate of v) {
      const got = linkOf(candidate as RawItem["link"]);
      if (got) return got;
    }
    return undefined;
  }
  if (v && typeof v === "object") {
    if ("@href" in v && typeof v["@href"] === "string") return v["@href"].trim();
    if ("#text" in v && typeof v["#text"] === "string") return v["#text"].trim();
  }
  return undefined;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const DOLAR_RE = /\b(d[óo]lar|mep|ccl|blue|brecha|cepo)\b/i;
const MERCADO_RE = /\b(bonos?|acciones?|merval|cedears?|byma|tit[uú]los?|riesgo pa[ií]s)\b/i;
const POLITICA_RE = /\b(milei|congreso|caputo|gobierno|fmi|opositor|kirchner|larreta)\b/i;

function classify(
  title: string,
  summary: string,
  topic: RssSource["topic"],
): NewsItem["tag"] {
  const haystack = `${title} ${summary}`;
  if (DOLAR_RE.test(haystack)) return "dolar";
  if (MERCADO_RE.test(haystack)) return "mercados";
  if (POLITICA_RE.test(haystack)) return "politica";
  if (topic === "finanzas") return "finanzas";
  return "economia";
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Fetch all configured feeds in parallel, parse, dedupe by canonical URL,
 * optionally keyword-filter, sort by `publishedAt` descending and cap at
 * `limit`. Individual source failures are isolated — a 5xx from Clarín
 * doesn't drop Ámbito's items.
 */
export async function fetchNews(opts: FetchNewsOptions = {}): Promise<{
  items: NewsItem[];
  errors: Array<{ sourceId: string; message: string }>;
  asOf: string;
}> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const limit = opts.limit ?? 40;
  const ttl = opts.cacheTtlSeconds ?? 600;
  const ids = opts.sourceIds ? new Set(opts.sourceIds) : null;
  const sources = NEWS_SOURCES.filter((s) => !ids || ids.has(s.id));
  const errors: Array<{ sourceId: string; message: string }> = [];

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const res = await fetchImpl(source.url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5",
          },
          next: { revalidate: ttl },
        } as RequestInit & { next?: { revalidate?: number } });
        if (!res.ok) {
          errors.push({ sourceId: source.id, message: `HTTP ${res.status}` });
          return [] as NewsItem[];
        }
        const xml = await res.text();
        return parseRssDocument(xml, source);
      } catch (err) {
        errors.push({
          sourceId: source.id,
          message: err instanceof Error ? err.message : "unknown error",
        });
        return [] as NewsItem[];
      }
    }),
  );

  const all = results.flat();
  // Dedup by canonical URL — keep the first occurrence (which is also the
  // most authoritative since sources are iterated in declared order).
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const item of all) {
    const key = canonicalUrl(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const filtered = filterByKeywords(deduped, opts.keywords ?? []);
  filtered.sort((a, b) => {
    const aT = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bT = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bT - aT;
  });
  return {
    items: filtered.slice(0, limit),
    errors,
    asOf: new Date().toISOString(),
  };
}

export function filterByKeywords(items: NewsItem[], keywords: ReadonlyArray<string>): NewsItem[] {
  if (keywords.length === 0) return items;
  const lc = keywords.map((k) => k.toLowerCase());
  return items.filter((it) => {
    const hay = `${it.title} ${it.summary}`.toLowerCase();
    return lc.some((k) => hay.includes(k));
  });
}

export { canonicalUrl as __canonicalUrl };
