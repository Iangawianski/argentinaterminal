import { ProviderError } from "@/lib/providers/types";
import {
  EQUITY_CATALOG,
  findEquity,
  isEquitySymbol,
  type EquityMeta,
  type MarketCapBucket,
} from "./catalog";

// Batch quote adapter for the equities universe.
//
// Implementation notes:
//
//   - Yahoo's `chart` endpoint is the same one we already use for single
//     quotes (lib/providers/yahoo.ts). We hit it once per symbol in
//     parallel rather than using the v7 quote endpoint, because v7 has
//     intermittently required cookies/crumbs and is rate-limited harder.
//     Chart with `range=ytd&interval=1d` gives us both the day move and
//     the YTD anchor (first close of the year) in a single call.
//
//   - Concurrency is bounded to MAX_CONCURRENT to keep us polite. The
//     batch resolves with a partial result if individual symbols fail —
//     callers can decide whether to render the row with `null` deltas.
//
//   - Cache is a 30s in-process map, same TTL pattern as the bonds
//     adapter. The cache key is the symbol, not the batch, so two
//     concurrent /acciones renders share work.
//
//   - Market cap *value* is not available from the chart endpoint; we
//     surface the qualitative bucket from the catalog ("large", "mid",
//     "small"). When/if we adopt the v7 quote endpoint we can return a
//     real number too — the field is typed `null` for that future.

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const TTL_MS = 30_000;
const MAX_CONCURRENT = 6;

export type EquitySnapshot = {
  symbol: string;
  name: string;
  sector: EquityMeta["sector"];
  bucket: MarketCapBucket;
  adr?: string;
  // Last trade in ARS. `null` when the provider didn't return a price.
  last: number | null;
  prevClose: number | null;
  // Absolute day change in ARS.
  dayChange: number | null;
  // Day change as a decimal fraction (0.012 = +1.2%).
  dayChangePct: number | null;
  // YTD change as a decimal fraction, anchored to the first close of the
  // current calendar year. `null` if Yahoo didn't return YTD data.
  ytdChangePct: number | null;
  // Last regular-session volume in shares.
  volume: number | null;
  // Numeric market cap in ARS — currently always null (see note above).
  marketCap: number | null;
  // Best-effort fetch timestamp in milliseconds since epoch.
  timestamp: number;
  // When set, the snapshot row is stale/failed; UI should show a dash.
  error?: string;
};

export type SnapshotFetcher = (
  yahooSymbol: string,
  init?: RequestInit,
) => Promise<unknown>;

const defaultFetcher: SnapshotFetcher = async (yahooSymbol, init) => {
  const url = `${YAHOO_CHART}/${encodeURIComponent(yahooSymbol)}?interval=1d&range=ytd`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent":
        "ArgentinaTerminal/0.0.1 (+https://github.com/argentina-terminal)",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new ProviderError(`Yahoo HTTP ${res.status}`, "yahoo");
  }
  return res.json();
};

type CacheEntry = { expiresAt: number; snapshot: EquitySnapshot };
const cache = new Map<string, CacheEntry>();

export type GetEquitiesSnapshotOptions = {
  fetcher?: SnapshotFetcher;
  useCache?: boolean;
  now?: () => number;
  maxConcurrent?: number;
};

export async function getEquitiesSnapshot(
  symbols: ReadonlyArray<string>,
  options: GetEquitiesSnapshotOptions = {},
): Promise<EquitySnapshot[]> {
  const now = options.now ?? Date.now;
  const useCache = options.useCache ?? true;
  const fetcher = options.fetcher ?? defaultFetcher;
  const maxConcurrent = options.maxConcurrent ?? MAX_CONCURRENT;

  const unique = Array.from(
    new Set(symbols.map((s) => s.toUpperCase()).filter(isEquitySymbol)),
  );

  // Phase A: serve cached entries cheaply.
  const result = new Map<string, EquitySnapshot>();
  const toFetch: string[] = [];
  for (const sym of unique) {
    if (useCache) {
      const hit = cache.get(sym);
      if (hit && hit.expiresAt > now()) {
        result.set(sym, hit.snapshot);
        continue;
      }
    }
    toFetch.push(sym);
  }

  // Phase B: fetch the rest in bounded-concurrency batches.
  for (let i = 0; i < toFetch.length; i += maxConcurrent) {
    const slice = toFetch.slice(i, i + maxConcurrent);
    const batch = await Promise.all(
      slice.map((sym) => fetchOne(sym, fetcher, now()).catch((err) => ({
        sym,
        error: err instanceof Error ? err.message : String(err),
      } as const))),
    );
    for (const item of batch) {
      if ("snapshot" in item) {
        if (useCache) {
          cache.set(item.snapshot.symbol, {
            expiresAt: now() + TTL_MS,
            snapshot: item.snapshot,
          });
        }
        result.set(item.snapshot.symbol, item.snapshot);
      } else {
        result.set(item.sym, errorRow(item.sym, item.error, now()));
      }
    }
  }

  // Preserve catalog ordering for stable rendering.
  return unique
    .map((sym) => result.get(sym))
    .filter((x): x is EquitySnapshot => x !== undefined);
}

async function fetchOne(
  symbol: string,
  fetcher: SnapshotFetcher,
  ts: number,
): Promise<{ snapshot: EquitySnapshot }> {
  const meta = findEquity(symbol);
  if (!meta) {
    throw new ProviderError(`Unknown equity symbol ${symbol}`, "yahoo");
  }
  const yahooSymbol = `${symbol}.BA`;
  const payload = (await fetcher(yahooSymbol)) as YahooChartPayload | undefined;

  const result = payload?.chart?.result?.[0];
  const meta1 = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (!result || !meta1 || typeof meta1.regularMarketPrice !== "number") {
    throw new ProviderError(
      `Yahoo response invalid for ${symbol}`,
      "yahoo",
    );
  }

  const last = meta1.regularMarketPrice;
  const prevClose =
    typeof meta1.previousClose === "number"
      ? meta1.previousClose
      : typeof meta1.chartPreviousClose === "number"
        ? meta1.chartPreviousClose
        : null;
  const dayChange = prevClose !== null ? last - prevClose : null;
  const dayChangePct =
    prevClose !== null && prevClose !== 0 ? (last - prevClose) / prevClose : null;

  // First non-null close in the YTD chart is our anchor.
  let ytdAnchor: number | null = null;
  for (const c of closes) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      ytdAnchor = c;
      break;
    }
  }
  const ytdChangePct =
    ytdAnchor !== null && ytdAnchor !== 0 ? (last - ytdAnchor) / ytdAnchor : null;

  return {
    snapshot: {
      symbol: meta.symbol,
      name: meta.name,
      sector: meta.sector,
      bucket: meta.bucket,
      adr: meta.adr,
      last,
      prevClose,
      dayChange,
      dayChangePct,
      ytdChangePct,
      volume: typeof meta1.regularMarketVolume === "number"
        ? meta1.regularMarketVolume
        : null,
      marketCap: null,
      timestamp:
        typeof meta1.regularMarketTime === "number"
          ? meta1.regularMarketTime * 1000
          : ts,
    },
  };
}

function errorRow(symbol: string, error: string, ts: number): EquitySnapshot {
  const meta = findEquity(symbol);
  return {
    symbol,
    name: meta?.name ?? symbol,
    sector: meta?.sector ?? "holdings",
    bucket: meta?.bucket ?? "small",
    adr: meta?.adr,
    last: null,
    prevClose: null,
    dayChange: null,
    dayChangePct: null,
    ytdChangePct: null,
    volume: null,
    marketCap: null,
    timestamp: ts,
    error,
  };
}

// Convenience helper: snapshot of every catalog symbol. Used by /acciones
// and by the home top-movers panel.
export function getFullEquitiesSnapshot(
  options: GetEquitiesSnapshotOptions = {},
): Promise<EquitySnapshot[]> {
  return getEquitiesSnapshot(
    EQUITY_CATALOG.map((e) => e.symbol),
    options,
  );
}

// Test seam.
export function __resetEquitiesCache(): void {
  cache.clear();
}

// -- Yahoo response typing (narrow view of the chart payload) -----------

type YahooChartMeta = {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { description?: string } | null;
  };
};
