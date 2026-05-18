import { ProviderError } from "@/lib/providers/types";

// Indices coverage for Phase 5.
//
// Yahoo carries the headline BYMA indices under the symbols listed below.
// `^MERVAL` aliases to `^MERV` on Yahoo today; we keep both in the catalog
// so the UI doesn't silently drop coverage if Yahoo flips between them.
//
// The S&P/BYMA USD index does not have a stable Yahoo ticker — when we
// query it we fall back to the proxy of "^MERV in ARS divided by the CCL"
// in a later phase. For now we surface only what we can pull cleanly.

export type IndexMeta = {
  symbol: string;
  // Display name in Rioplatense Spanish.
  name: string;
  // Yahoo ticker used to fetch the index.
  yahooSymbol: string;
  // BYMA leader-panel constituents to spotlight under the index card. We
  // cap at five names per the Phase-5 spec.
  topConstituents: ReadonlyArray<string>;
  // Currency the index is denominated in.
  currency: "ARS" | "USD" | "POINTS";
};

export const INDEX_CATALOG: readonly IndexMeta[] = [
  {
    symbol: "MERVAL",
    name: "Merval",
    yahooSymbol: "^MERV",
    topConstituents: ["GGAL", "YPFD", "PAMP", "BMA", "TXAR"],
    currency: "POINTS",
  },
  {
    symbol: "MERVAL_ARG",
    name: "Merval Argentina",
    yahooSymbol: "^IMV",
    topConstituents: ["GGAL", "PAMP", "TXAR", "TGSU2", "ALUA"],
    currency: "POINTS",
  },
  {
    symbol: "ARGT",
    name: "Global X MSCI Argentina (ARGT)",
    yahooSymbol: "ARGT",
    topConstituents: ["YPF", "BMA", "GGAL", "PAM", "TEO"],
    currency: "USD",
  },
] as const;

export type IndexSnapshot = {
  symbol: string;
  name: string;
  currency: IndexMeta["currency"];
  last: number | null;
  prevClose: number | null;
  dayChangePct: number | null;
  ytdChangePct: number | null;
  // Most-recent ~20 daily closes for the inline sparkline. Oldest first.
  sparkline: ReadonlyArray<number>;
  topConstituents: ReadonlyArray<string>;
  timestamp: number;
  error?: string;
};

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const SPARKLINE_POINTS = 20;

export type IndexFetcher = (
  yahooSymbol: string,
  init?: RequestInit,
) => Promise<unknown>;

const defaultFetcher: IndexFetcher = async (yahooSymbol, init) => {
  // 3mo range gives us enough trading days (~63) to comfortably take the
  // last 20 closes for the sparkline, plus the YTD anchor as a side
  // benefit (computed from the first valid close in the response when
  // we're early in the year, otherwise from a separate request).
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

export type GetIndexSnapshotOptions = {
  fetcher?: IndexFetcher;
  now?: () => number;
};

export async function getIndexSnapshot(
  index: IndexMeta,
  options: GetIndexSnapshotOptions = {},
): Promise<IndexSnapshot> {
  const now = options.now ?? Date.now;
  const fetcher = options.fetcher ?? defaultFetcher;
  try {
    const payload = (await fetcher(index.yahooSymbol)) as YahooChartPayload | undefined;
    const result = payload?.chart?.result?.[0];
    const meta = result?.meta;
    const closesRaw = result?.indicators?.quote?.[0]?.close ?? [];
    if (!result || !meta || typeof meta.regularMarketPrice !== "number") {
      throw new ProviderError(
        `Yahoo response invalid for ${index.symbol}`,
        "yahoo",
      );
    }
    const last = meta.regularMarketPrice;
    const prevClose =
      typeof meta.previousClose === "number"
        ? meta.previousClose
        : typeof meta.chartPreviousClose === "number"
          ? meta.chartPreviousClose
          : null;
    const dayChangePct =
      prevClose !== null && prevClose !== 0
        ? (last - prevClose) / prevClose
        : null;

    const cleanCloses: number[] = [];
    for (const c of closesRaw) {
      if (typeof c === "number" && Number.isFinite(c) && c > 0) {
        cleanCloses.push(c);
      }
    }
    const ytdAnchor = cleanCloses[0] ?? null;
    const ytdChangePct =
      ytdAnchor !== null && ytdAnchor !== 0
        ? (last - ytdAnchor) / ytdAnchor
        : null;
    const sparkline = cleanCloses.slice(-SPARKLINE_POINTS);

    return {
      symbol: index.symbol,
      name: index.name,
      currency: index.currency,
      last,
      prevClose,
      dayChangePct,
      ytdChangePct,
      sparkline,
      topConstituents: index.topConstituents,
      timestamp:
        typeof meta.regularMarketTime === "number"
          ? meta.regularMarketTime * 1000
          : now(),
    };
  } catch (err) {
    return {
      symbol: index.symbol,
      name: index.name,
      currency: index.currency,
      last: null,
      prevClose: null,
      dayChangePct: null,
      ytdChangePct: null,
      sparkline: [],
      topConstituents: index.topConstituents,
      timestamp: now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getAllIndices(
  options: GetIndexSnapshotOptions = {},
): Promise<IndexSnapshot[]> {
  return Promise.all(INDEX_CATALOG.map((idx) => getIndexSnapshot(idx, options)));
}

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
      };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { description?: string } | null;
  };
};
