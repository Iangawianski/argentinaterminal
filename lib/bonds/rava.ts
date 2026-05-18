import type {
  BondHistory,
  BondHistoryPoint,
  BondQuote,
  BondQuoteProvider,
} from "@/lib/bonds/quote-types";
import { findBond } from "@/lib/bonds/cashflows";

/**
 * Rava CSV adapter for hard-dollar Argentine sovereigns.
 *
 * Endpoint:
 *
 *     GET https://www.rava.com/empresas/precioshistoricos.php?e={SYM}&csv=1
 *
 * `?csv=1` returns a header row plus N daily rows. The columns are stable
 * (the same page powers Rava's public chart for a decade):
 *
 *     fecha,apertura,maximo,minimo,cierre,volumen,openinterest
 *
 * Rava is free, no API key, public CORS — but it's a scraping target and
 * may rate-limit or change format at any time. We:
 *   - Cache 30s (matches the issue scope).
 *   - Validate the header row strictly and throw a `RavaContractError` on
 *     mismatch — that signals the wrapper to fall back to Yahoo.
 *   - Treat HTTP 5xx, timeouts, and missing rows as soft failures (same
 *     fallback path).
 *
 * Bond symbol mapping: we always hit the USD-settling species (suffix `D`),
 * because that's the species quoted in dollars. Rava lists e.g. `AL30D`,
 * `GD30D`, etc.
 */

export const RAVA_BASE = "https://www.rava.com";

const REQUIRED_HEADERS = [
  "fecha",
  "apertura",
  "maximo",
  "minimo",
  "cierre",
  "volumen",
] as const;

export class RavaContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RavaContractError";
  }
}

export interface RavaAdapterOptions {
  fetchImpl?: typeof fetch;
  base?: string;
  cacheTtlSeconds?: number;
  /** Override the upstream symbol mapping (tests). Default appends "D". */
  symbolMap?: (bondSymbol: string) => string;
}

function defaultSymbolMap(bondSymbol: string): string {
  const bond = findBond(bondSymbol);
  if (bond) {
    // usdBaSymbol is e.g. "AL30D.BA"; strip the `.BA` Yahoo suffix to get the
    // Rava species code.
    return bond.usdBaSymbol.replace(/\.BA$/i, "");
  }
  // Heuristic fallback for symbols not in the registry yet — just suffix D.
  return `${bondSymbol.trim().toUpperCase()}D`;
}

interface ParsedRow {
  date: string; // ISO YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/**
 * Parses Rava's CSV. Permissive on whitespace and trailing newline; strict
 * on header names (any drift triggers `RavaContractError`).
 */
export function parseRavaCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new RavaContractError("Rava CSV is empty");
  }
  const headerRow = lines[0]!.toLowerCase();
  const headers = headerRow.split(",").map((h) => h.trim());
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new RavaContractError(
        `Rava CSV missing required header "${required}" (got: ${headers.join(", ")})`
      );
    }
  }
  const idx = (name: string) => headers.indexOf(name);
  const iFecha = idx("fecha");
  const iOpen = idx("apertura");
  const iHigh = idx("maximo");
  const iLow = idx("minimo");
  const iClose = idx("cierre");
  const iVol = idx("volumen");

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i]!.split(",").map((c) => c.trim());
    if (cells.length < REQUIRED_HEADERS.length) continue;
    const rawDate = cells[iFecha]!;
    const date = normalizeDate(rawDate);
    if (!date) continue;
    const close = Number(cells[iClose]);
    if (!Number.isFinite(close)) continue;
    const open = Number(cells[iOpen]);
    const high = Number(cells[iHigh]);
    const low = Number(cells[iLow]);
    const volRaw = Number(cells[iVol]);
    rows.push({
      date,
      open: Number.isFinite(open) ? open : close,
      high: Number.isFinite(high) ? high : close,
      low: Number.isFinite(low) ? low : close,
      close,
      volume: Number.isFinite(volRaw) ? volRaw : null,
    });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

/**
 * Rava ships dates as either `YYYY-MM-DD` or `DD/MM/YYYY` depending on the
 * page. We accept both and emit canonical ISO `YYYY-MM-DD`.
 */
function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  return null;
}

const USER_AGENT =
  "ArgentinaTerminal/0.1 (+https://github.com/argentinaterminal/argentinaterminal)";

export class RavaBondProvider implements BondQuoteProvider {
  readonly name = "rava";
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;
  private readonly cacheTtlSeconds: number;
  private readonly symbolMap: (s: string) => string;

  constructor(opts: RavaAdapterOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.base = opts.base ?? RAVA_BASE;
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 30;
    this.symbolMap = opts.symbolMap ?? defaultSymbolMap;
  }

  private async fetchCsv(upstreamSymbol: string): Promise<string> {
    const url = `${this.base}/empresas/precioshistoricos.php?e=${encodeURIComponent(upstreamSymbol)}&csv=1`;
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/csv,*/*;q=0.5",
      },
      next: { revalidate: this.cacheTtlSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (!res.ok) {
      throw new Error(`Rava fetch failed for ${upstreamSymbol}: HTTP ${res.status}`);
    }
    const body = await res.text();
    if (body.trim().length === 0) {
      throw new RavaContractError(`Rava returned empty body for ${upstreamSymbol}`);
    }
    return body;
  }

  async getQuote(bondSymbol: string): Promise<BondQuote> {
    const upstreamSymbol = this.symbolMap(bondSymbol);
    const csv = await this.fetchCsv(upstreamSymbol);
    const rows = parseRavaCsv(csv);
    if (rows.length === 0) {
      throw new RavaContractError(`Rava returned no rows for ${upstreamSymbol}`);
    }
    const latest = rows[rows.length - 1]!;
    const prev = rows.length >= 2 ? rows[rows.length - 2]! : null;
    const previousClose = prev?.close ?? null;
    const changePct =
      previousClose && previousClose !== 0
        ? ((latest.close - previousClose) / previousClose) * 100
        : null;
    return {
      symbol: bondSymbol.trim().toUpperCase(),
      upstreamSymbol,
      source: this.name,
      cleanPrice: latest.close,
      previousClose,
      changePct,
      // Rava only gives the day in the CSV — set the timestamp to midnight
      // UTC of that trading day. Good enough for "freshness" badges; the UI
      // can still show "actualizado hoy" since the trading day is implicit.
      asOf: `${latest.date}T00:00:00.000Z`,
    };
  }

  async getHistory(bondSymbol: string, days = 90): Promise<BondHistory> {
    const upstreamSymbol = this.symbolMap(bondSymbol);
    const csv = await this.fetchCsv(upstreamSymbol);
    const rows = parseRavaCsv(csv);
    const trimmed = rows.slice(-Math.max(1, days));
    const points: BondHistoryPoint[] = trimmed.map((r) => ({
      date: r.date,
      close: r.close,
    }));
    return {
      symbol: bondSymbol.trim().toUpperCase(),
      upstreamSymbol,
      source: this.name,
      points,
    };
  }
}
