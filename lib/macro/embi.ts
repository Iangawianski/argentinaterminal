import { z } from "zod";

/**
 * EMBI+ Argentina ("riesgo país") adapter.
 *
 * Ámbito Financiero publishes the JPMorgan EMBI+ Argentina spread on a
 * dedicated page that updates intraday. We scrape it because there is no
 * free, stable JSON API — the page is HTML with a number embedded near a
 * recognizable label.
 *
 *     GET https://www.ambito.com/contenidos/riesgo-pais.html
 *
 * Our parser is tolerant: it looks for the *highest-confidence* numeric
 * value in a small window around the words "Riesgo País" or "EMBI", and
 * rejects matches outside the plausible band (50 bps – 50,000 bps). If
 * Ámbito redesigns the page and the regex breaks, the call throws
 * `EmbiContractError` so the caller can pivot to the FRED-derived fallback.
 *
 * Fallback (FRED): EMBI ≈ (avg(GD30 TIR, GD35 TIR) - UST10Y) * 100 bps.
 * Only computed when `FRED_API_KEY` is present in the environment. If
 * neither source is available, `getRiesgoPais` throws and the UI shows
 * "sin datos".
 */

export const AMBITO_RIESGO_URL = "https://www.ambito.com/contenidos/riesgo-pais.html";
export const FRED_BASE = "https://api.stlouisfed.org";

const RIESGO_MIN_BPS = 50;
const RIESGO_MAX_BPS = 50_000;

export class EmbiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbiContractError";
  }
}

export const RiesgoPaisSchema = z.object({
  /** EMBI+ Argentina in basis points (e.g. 1250 for 12.5%). */
  valueBps: z.number(),
  /** Day variation in bps if available. */
  changeBps: z.number().nullable(),
  /** Day variation in percent if available. */
  changePct: z.number().nullable(),
  source: z.enum(["ambito", "fred-spread", "manual"]),
  asOf: z.string(),
  /** Notes shown in the UI explaining freshness / source nuance. */
  note: z.string().optional(),
});
export type RiesgoPais = z.infer<typeof RiesgoPaisSchema>;

export interface EmbiAdapterOptions {
  fetchImpl?: typeof fetch;
  ambitoUrl?: string;
  cacheTtlSeconds?: number;
  /** Optional UST 10Y fallback resolver — typically backed by FRED. */
  ust10yResolver?: () => Promise<number | null>;
  /** Resolver for the GD30/GD35 average TIR (decimal, e.g. 0.18 = 18%). */
  argSpreadResolver?: () => Promise<number | null>;
}

const USER_AGENT =
  "ArgentinaTerminal/0.1 (+https://github.com/argentinaterminal/argentinaterminal)";

/**
 * Extracts EMBI bps from raw HTML. Robust against:
 *   - Surrounding markup variations.
 *   - Both `1.234` and `1,234` thousands separators.
 *   - A leading sign or trailing "pb" / "bps".
 *
 * We anchor the match on the label words and accept the first plausible
 * number that follows within ~200 characters.
 */
export function parseAmbitoRiesgoHtml(html: string): {
  valueBps: number;
  changeBps: number | null;
} {
  // Strip HTML tags to a flat text blob so the regex doesn't have to deal
  // with `<span>1.234</span>` style noise.
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // Look for "Riesgo País" or "Riesgo Pais" (no tilde), within a short
  // window, followed by a number. Be tolerant of any non-digit chars
  // between the label and the value.
  const labelRe = /(Riesgo\s*Pa[ií]s|EMBI(?:\+|\s+Argentina)?)/i;
  const labelMatch = labelRe.exec(text);
  if (!labelMatch) {
    throw new EmbiContractError("Ámbito HTML: missing 'Riesgo País' / 'EMBI' label");
  }
  const after = text.slice(labelMatch.index, labelMatch.index + 400);
  // Argentine number format: `1.234` (dot = thousands) or plain `1234`.
  // Accept an optional decimal comma group; reject standalone floats.
  const numRe = /(\d{1,3}(?:\.\d{3})+|\d{3,5})(?:\s*pb|\s*bps?|\s*puntos)?/i;
  const numMatch = numRe.exec(after);
  if (!numMatch) {
    throw new EmbiContractError("Ámbito HTML: no plausible bps figure near label");
  }
  const raw = numMatch[1]!.replace(/\./g, "");
  const valueBps = Number(raw);
  if (!Number.isFinite(valueBps) || valueBps < RIESGO_MIN_BPS || valueBps > RIESGO_MAX_BPS) {
    throw new EmbiContractError(
      `Ámbito HTML: parsed value ${valueBps} outside plausible band [${RIESGO_MIN_BPS}, ${RIESGO_MAX_BPS}]`
    );
  }
  // Optional day-change figure: e.g. "−10 pb" / "+25 pb" within the same window.
  const changeRe = /([+−\-]\s*\d{1,3}(?:\.\d{3})*)\s*(?:pb|bps?)/i;
  const changeMatch = changeRe.exec(after.slice(numMatch.index + numMatch[0].length));
  let changeBps: number | null = null;
  if (changeMatch) {
    const sign = changeMatch[1]!.includes("−") || changeMatch[1]!.includes("-") ? -1 : 1;
    const digits = changeMatch[1]!.replace(/[^\d]/g, "");
    if (digits) {
      changeBps = sign * Number(digits);
    }
  }
  return { valueBps, changeBps };
}

export class AmbitoEmbiProvider {
  readonly name = "ambito";
  private readonly fetchImpl: typeof fetch;
  private readonly url: string;
  private readonly cacheTtlSeconds: number;
  private readonly ust10yResolver: () => Promise<number | null>;
  private readonly argSpreadResolver: () => Promise<number | null>;

  constructor(opts: EmbiAdapterOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.url = opts.ambitoUrl ?? AMBITO_RIESGO_URL;
    // 5 minutes per the issue scope — EMBI is intraday but slow-moving.
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 300;
    this.ust10yResolver = opts.ust10yResolver ?? defaultUst10yFromFred(this.fetchImpl);
    this.argSpreadResolver = opts.argSpreadResolver ?? (async () => null);
  }

  async getRiesgoPais(): Promise<RiesgoPais> {
    try {
      return await this.fetchFromAmbito();
    } catch (primaryErr) {
      try {
        return await this.fetchFromFredFallback();
      } catch {
        const message =
          primaryErr instanceof Error ? primaryErr.message : "Ámbito unavailable";
        throw new Error(`EMBI sources unavailable: ${message}`);
      }
    }
  }

  private async fetchFromAmbito(): Promise<RiesgoPais> {
    const res = await this.fetchImpl(this.url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.5",
      },
      next: { revalidate: this.cacheTtlSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (!res.ok) {
      throw new EmbiContractError(`Ámbito HTTP ${res.status}`);
    }
    const html = await res.text();
    const { valueBps, changeBps } = parseAmbitoRiesgoHtml(html);
    // Without a strong "previous" baseline we leave changePct null; the
    // bps change is what the market actually quotes.
    return {
      valueBps,
      changeBps,
      changePct: null,
      source: "ambito",
      asOf: new Date().toISOString(),
      note: "Scraping Ámbito Financiero — sin SLA contractual",
    };
  }

  private async fetchFromFredFallback(): Promise<RiesgoPais> {
    const [ust10y, argYield] = await Promise.all([
      this.ust10yResolver(),
      this.argSpreadResolver(),
    ]);
    if (ust10y === null || argYield === null) {
      throw new Error("FRED fallback requires both UST 10Y and AR yield");
    }
    const spreadDecimal = argYield - ust10y;
    const valueBps = Math.round(spreadDecimal * 10_000);
    if (valueBps < RIESGO_MIN_BPS || valueBps > RIESGO_MAX_BPS) {
      throw new Error(
        `FRED fallback produced implausible value ${valueBps} bps (UST10Y=${ust10y}, ARyield=${argYield})`
      );
    }
    return {
      valueBps,
      changeBps: null,
      changePct: null,
      source: "fred-spread",
      asOf: new Date().toISOString(),
      note: "Spread propio: avg(TIR GD30, GD35) − UST 10Y (FRED). Sin Ámbito en vivo.",
    };
  }
}

/**
 * Default UST 10Y resolver using FRED's DGS10 series. Returns `null` when:
 *   - `FRED_API_KEY` is not set (free tier still needs the key).
 *   - FRED is unreachable / returns no data.
 *
 * Network failures are swallowed — the EMBI caller will surface a single
 * "sin datos" state to the user rather than a stack trace.
 */
export function defaultUst10yFromFred(fetchImpl: typeof fetch): () => Promise<number | null> {
  return async () => {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) return null;
    const url = `${FRED_BASE}/fred/series/observations?series_id=DGS10&sort_order=desc&limit=1&file_type=json&api_key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        next: { revalidate: 24 * 60 * 60 },
      } as RequestInit & { next?: { revalidate?: number } });
      if (!res.ok) return null;
      const json = (await res.json()) as unknown;
      // Schema is `{ observations: [{ value: "4.25" | "." }] }`. Treat "." as missing.
      const obs = (json as { observations?: Array<{ value?: string }> }).observations?.[0];
      if (!obs?.value || obs.value === ".") return null;
      const parsed = Number(obs.value);
      if (!Number.isFinite(parsed)) return null;
      // FRED ships UST yields as a percent (e.g. 4.25 = 4.25%). Convert to decimal.
      return parsed / 100;
    } catch {
      return null;
    }
  };
}

let defaultProvider: AmbitoEmbiProvider | null = null;

export function getDefaultEmbiProvider(): AmbitoEmbiProvider {
  if (!defaultProvider) {
    defaultProvider = new AmbitoEmbiProvider();
  }
  return defaultProvider;
}
