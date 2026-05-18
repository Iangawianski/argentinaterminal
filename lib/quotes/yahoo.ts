import { z } from "zod";

import type {
  Fundamentals,
  IntradayPoint,
  IntradaySeries,
  Quote,
  QuoteProvider,
} from "@/lib/quotes/types";

/**
 * Yahoo Finance quote adapter.
 *
 * Why Yahoo: the only reliable free source for BYMA-listed equities (via the
 * `.BA` suffix) and ADR/US fundamentals in a single shape. We keep parsing
 * local so a swap (Rava, BYMA direct, Twelve Data) is contained.
 *
 * Two endpoints are used:
 *   - /v8/finance/chart  → quote + intraday + 52w hi/lo (no crumb needed)
 *   - /v10/finance/quoteSummary → market cap / PE / dividend yield (crumb)
 *
 * The crumb endpoint needs a cookie+crumb dance (Yahoo enforces it since
 * 2023). We cache the crumb per-instance for an hour. If the dance fails
 * (Yahoo changes contract, region block, network), `getFundamentals` falls
 * back to the chart-only data so the UI degrades gracefully.
 */

export const YAHOO_BASE = "https://query1.finance.yahoo.com";
export const YAHOO_BASE_Q2 = "https://query2.finance.yahoo.com";
export const YAHOO_COOKIE_URL = "https://fc.yahoo.com";

const ChartResponseSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            symbol: z.string(),
            regularMarketPrice: z.number().optional(),
            chartPreviousClose: z.number().optional(),
            previousClose: z.number().optional(),
            currency: z.string().optional(),
            regularMarketTime: z.number().optional(),
            fiftyTwoWeekHigh: z.number().optional(),
            fiftyTwoWeekLow: z.number().optional(),
          }),
          timestamp: z.array(z.number()).optional(),
          indicators: z.object({
            quote: z
              .array(
                z.object({
                  close: z.array(z.number().nullable()).optional(),
                  volume: z.array(z.number().nullable()).optional(),
                })
              )
              .optional(),
          }),
        })
      )
      .nullable(),
    error: z
      .object({
        code: z.string().optional(),
        description: z.string().optional(),
      })
      .nullable(),
  }),
});

export type YahooChartResponse = z.infer<typeof ChartResponseSchema>;

const RawValueSchema = z
  .object({ raw: z.number().nullable().optional() })
  .partial()
  .optional();

const QuoteSummaryResponseSchema = z.object({
  quoteSummary: z.object({
    result: z
      .array(
        z.object({
          price: z
            .object({
              marketCap: RawValueSchema,
              regularMarketChangePercent: RawValueSchema,
            })
            .partial()
            .optional(),
          summaryDetail: z
            .object({
              trailingPE: RawValueSchema,
              dividendYield: RawValueSchema,
              fiftyTwoWeekHigh: RawValueSchema,
              fiftyTwoWeekLow: RawValueSchema,
            })
            .partial()
            .optional(),
          defaultKeyStatistics: z
            .object({
              forwardPE: RawValueSchema,
            })
            .partial()
            .optional(),
        })
      )
      .nullable(),
    error: z
      .object({
        code: z.string().optional(),
        description: z.string().optional(),
      })
      .nullable(),
  }),
});

export type YahooQuoteSummaryResponse = z.infer<typeof QuoteSummaryResponseSchema>;

export interface YahooCrumb {
  cookie: string;
  crumb: string;
}

export interface YahooAdapterOptions {
  fetchImpl?: typeof fetch;
  base?: string;
  baseQ2?: string;
  /** Suffix appended to symbols when not already qualified. Default: `.BA`. */
  suffix?: string;
  /** Cache TTL in seconds for the chart endpoint. Default 30. */
  cacheTtlSeconds?: number;
  /** Inject a precomputed crumb/cookie (tests). */
  crumbResolver?: () => Promise<YahooCrumb>;
}

export function qualifySymbol(symbol: string, suffix: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper.includes(".")) return upper;
  return `${upper}${suffix}`;
}

function rawNumber(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { raw?: unknown }).raw;
  return typeof raw === "number" ? raw : null;
}

const USER_AGENT =
  "ArgentinaTerminal/0.1 (+https://github.com/argentinaterminal/argentinaterminal)";

export class YahooQuoteProvider implements QuoteProvider {
  readonly name = "yahoo";
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;
  private readonly baseQ2: string;
  private readonly suffix: string;
  private readonly cacheTtlSeconds: number;
  private readonly crumbResolver: () => Promise<YahooCrumb>;
  private cachedCrumb: { value: YahooCrumb; expiresAt: number } | null = null;

  constructor(opts: YahooAdapterOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.base = opts.base ?? YAHOO_BASE;
    this.baseQ2 = opts.baseQ2 ?? YAHOO_BASE_Q2;
    this.suffix = opts.suffix ?? ".BA";
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 30;
    this.crumbResolver = opts.crumbResolver ?? (() => this.resolveCrumb());
  }

  private async fetchChart(symbol: string, range: string, interval: string) {
    const qualified = qualifySymbol(symbol, this.suffix);
    const url = `${this.base}/v8/finance/chart/${encodeURIComponent(qualified)}?range=${range}&interval=${interval}&includePrePost=false`;
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      next: { revalidate: this.cacheTtlSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (!res.ok) {
      throw new Error(`Yahoo chart fetch failed for ${qualified}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as unknown;
    const parsed = ChartResponseSchema.parse(json);
    if (parsed.chart.error) {
      throw new Error(
        `Yahoo error for ${qualified}: ${parsed.chart.error.code ?? "unknown"} ${parsed.chart.error.description ?? ""}`
      );
    }
    const result = parsed.chart.result?.[0];
    if (!result) throw new Error(`Yahoo returned empty result for ${qualified}`);
    return result;
  }

  /**
   * Crumb/cookie dance. Hits `https://fc.yahoo.com` (which 404s but sets the
   * `A1` cookie), then exchanges that cookie for a crumb at
   * `query2/v1/test/getcrumb`. Both values are needed on subsequent
   * `quoteSummary` calls (cookie as `Cookie`, crumb as `?crumb=`).
   */
  private async resolveCrumb(): Promise<YahooCrumb> {
    const cookieRes = await this.fetchImpl(YAHOO_COOKIE_URL, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      redirect: "manual",
    });
    const cookies = readSetCookies(cookieRes);
    const a1 = cookies
      .map((c) => c.split(";")[0] ?? "")
      .find((c) => c.startsWith("A1=") || c.startsWith("A3="));
    if (!a1) {
      throw new Error("Yahoo crumb dance: missing A1 cookie");
    }
    const crumbRes = await this.fetchImpl(`${this.baseQ2}/v1/test/getcrumb`, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: a1,
        Accept: "text/plain",
      },
    });
    if (!crumbRes.ok) {
      throw new Error(`Yahoo crumb fetch failed: HTTP ${crumbRes.status}`);
    }
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) throw new Error("Yahoo crumb fetch returned empty body");
    return { cookie: a1, crumb };
  }

  private async getCrumb(): Promise<YahooCrumb> {
    if (this.cachedCrumb && this.cachedCrumb.expiresAt > Date.now()) {
      return this.cachedCrumb.value;
    }
    const value = await this.crumbResolver();
    this.cachedCrumb = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
    return value;
  }

  private async fetchQuoteSummary(symbol: string): Promise<YahooQuoteSummaryResponse> {
    const qualified = qualifySymbol(symbol, this.suffix);
    const { cookie, crumb } = await this.getCrumb();
    const modules = ["price", "summaryDetail", "defaultKeyStatistics"].join(",");
    const url = `${this.baseQ2}/v10/finance/quoteSummary/${encodeURIComponent(qualified)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: cookie,
        Accept: "application/json",
      },
      next: { revalidate: this.cacheTtlSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (res.status === 401 || res.status === 403) {
      // Crumb may have expired — invalidate and let the caller fall back.
      this.cachedCrumb = null;
      throw new Error(`Yahoo quoteSummary auth failed: HTTP ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(`Yahoo quoteSummary failed for ${qualified}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as unknown;
    return QuoteSummaryResponseSchema.parse(json);
  }

  async getQuote(symbol: string): Promise<Quote> {
    const result = await this.fetchChart(symbol, "1d", "5m");
    const { meta } = result;
    const price = meta.regularMarketPrice;
    if (typeof price !== "number") {
      throw new Error(`Yahoo missing regularMarketPrice for ${meta.symbol}`);
    }
    const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const changePct =
      previousClose && previousClose !== 0 ? ((price - previousClose) / previousClose) * 100 : null;
    const asOf = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString();
    return {
      symbol: meta.symbol,
      source: this.name,
      price,
      previousClose,
      changePct,
      currency: meta.currency ?? "ARS",
      asOf,
    };
  }

  async getIntraday(symbol: string): Promise<IntradaySeries> {
    const result = await this.fetchChart(symbol, "1d", "5m");
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators.quote?.[0]?.close ?? [];
    const volumes = result.indicators.quote?.[0]?.volume ?? [];
    const points: IntradayPoint[] = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const t = timestamps[i];
      const close = closes[i];
      const volume = volumes[i] ?? null;
      if (typeof t !== "number" || close === null || close === undefined) continue;
      points.push({ t: new Date(t * 1000).toISOString(), price: close, volume });
    }
    return {
      symbol: result.meta.symbol,
      source: this.name,
      asOf: new Date().toISOString(),
      points,
    };
  }

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    // Try the rich quoteSummary endpoint first; fall back to the chart-only
    // 52w hi/lo stub if anything in the crumb dance breaks. We never want
    // fundamentals failure to take down the page.
    const qualified = qualifySymbol(symbol, this.suffix);
    try {
      const summary = await this.fetchQuoteSummary(symbol);
      const result = summary.quoteSummary.result?.[0];
      if (!result) throw new Error("empty quoteSummary result");
      const marketCap = rawNumber(result.price?.marketCap);
      const peRatio =
        rawNumber(result.summaryDetail?.trailingPE) ??
        rawNumber(result.defaultKeyStatistics?.forwardPE);
      // Yahoo returns dividendYield as a decimal (e.g. 0.0052 = 0.52%).
      // Normalize to percent so the UI can `formatPct` it directly.
      const yieldRaw = rawNumber(result.summaryDetail?.dividendYield);
      const dividendYield = yieldRaw === null ? null : yieldRaw * 100;
      const fiftyTwoWeekHigh = rawNumber(result.summaryDetail?.fiftyTwoWeekHigh);
      const fiftyTwoWeekLow = rawNumber(result.summaryDetail?.fiftyTwoWeekLow);
      return {
        symbol: qualified,
        source: this.name,
        asOf: new Date().toISOString(),
        marketCap,
        peRatio,
        dividendYield,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
      };
    } catch {
      const result = await this.fetchChart(symbol, "1d", "5m");
      const { meta } = result;
      return {
        symbol: meta.symbol,
        source: `${this.name}+chart-fallback`,
        asOf: new Date().toISOString(),
        marketCap: null,
        peRatio: null,
        dividendYield: null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      };
    }
  }
}

/** Extract Set-Cookie headers from a fetch Response, tolerant of impl shape. */
function readSetCookies(res: Response): string[] {
  // Node 20 undici exposes `getSetCookie()`. In other shims we fall back to
  // splitting the joined `set-cookie` header. Tests can stub either.
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
}
