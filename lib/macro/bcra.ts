import { z } from "zod";

/**
 * BCRA "Principales Variables" adapter — public v4.0 REST API.
 *
 *   Endpoint: https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{idVariable}
 *
 * Free, no API key. Returns daily series for FX, base monetaria, interest
 * rates and monthly series for IPC. We expose a small registry of curated
 * variable IDs (the ones an Argentine investor actually watches) and two
 * methods: latest snapshot + a historical window.
 *
 * Why v4.0: v3.0 was deprecated in 2026 and now responds with HTTP 400
 * `Método correspondiente a la v3 ha sido deprecado`. v4.0 is the current
 * stable surface.
 *
 * Variable IDs were sourced from `GET /v4.0/Monetarias` (lists every
 * variable). They're hardcoded here because the BCRA semantics drift slowly
 * — when they re-number a series we'll notice via a stale `lastValue` in
 * production and update the table. Doing a discovery-by-name lookup on
 * every request would cost an extra round-trip and add fragility.
 *
 * BCRA returns numeric values as JSON numbers (with trailing zeros — the API
 * preserves source precision). We coerce through `z.number()` to drop the
 * representation noise.
 */

export const BCRA_BASE = "https://api.bcra.gob.ar/estadisticas/v4.0";

/** Human-friendly keys for the curated set of variables we expose. */
export const BCRA_VARIABLES = {
  reservas: {
    id: 1,
    label: "Reservas internacionales",
    short: "Reservas",
    unit: "USD millones",
    cadence: "daily" as const,
    direction: "level" as const,
  },
  fxMinorista: {
    id: 4,
    label: "Tipo de cambio minorista (vendedor)",
    short: "Dólar minorista",
    unit: "ARS/USD",
    cadence: "daily" as const,
    direction: "level" as const,
  },
  fxMayorista: {
    id: 5,
    label: "Tipo de cambio mayorista de referencia (A 3500)",
    short: "Dólar mayorista",
    unit: "ARS/USD",
    cadence: "daily" as const,
    direction: "level" as const,
  },
  badlar: {
    id: 7,
    label: "Tasa BADLAR de bancos privados",
    short: "BADLAR",
    unit: "% TNA",
    cadence: "daily" as const,
    direction: "rate" as const,
  },
  tamar: {
    id: 44,
    label: "Tasa TAMAR de bancos privados",
    short: "TAMAR",
    unit: "% TNA",
    cadence: "daily" as const,
    direction: "rate" as const,
  },
  baseMonetaria: {
    id: 15,
    label: "Base monetaria",
    short: "Base monetaria",
    unit: "ARS millones",
    cadence: "daily" as const,
    direction: "level" as const,
  },
  politicaMonetaria: {
    id: 160,
    label: "Tasa de política monetaria",
    short: "Tasa política",
    unit: "% TNA",
    cadence: "daily" as const,
    direction: "rate" as const,
  },
  ipcMensual: {
    id: 27,
    label: "IPC — variación mensual",
    short: "IPC m/m",
    unit: "%",
    cadence: "monthly" as const,
    direction: "rate" as const,
  },
  ipcInteranual: {
    id: 28,
    label: "IPC — variación interanual",
    short: "IPC YoY",
    unit: "%",
    cadence: "monthly" as const,
    direction: "rate" as const,
  },
} as const;

export type BcraKey = keyof typeof BCRA_VARIABLES;
export const BCRA_KEYS = Object.keys(BCRA_VARIABLES) as BcraKey[];

export class BcraContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BcraContractError";
  }
}

const BcraPointSchema = z.object({
  fecha: z.string(),
  valor: z.number(),
});

const BcraSeriesPayloadSchema = z.object({
  status: z.number().optional(),
  metadata: z.unknown().optional(),
  results: z.array(
    z.object({
      idVariable: z.number(),
      detalle: z.array(BcraPointSchema),
    }),
  ),
});

export interface BcraPoint {
  /** ISO YYYY-MM-DD. */
  date: string;
  value: number;
}

export interface BcraSeries {
  key: BcraKey;
  idVariable: number;
  points: BcraPoint[];
  /** Source label for the UI ("bcra" or "bcra+cache"). */
  source: string;
  /** Local timestamp when this snapshot was assembled. */
  asOf: string;
}

export interface BcraSnapshot {
  key: BcraKey;
  /** Latest observed value. */
  value: number;
  date: string;
  /** Previous observation (for day-over-day or month-over-month delta). */
  previousValue: number | null;
  previousDate: string | null;
  /** Absolute delta vs. previous. `null` if no previous available. */
  delta: number | null;
  /** Percent delta vs. previous. `null` for rate-style variables. */
  deltaPct: number | null;
  source: string;
  asOf: string;
}

export interface BcraAdapterOptions {
  fetchImpl?: typeof fetch;
  base?: string;
  cacheTtlSeconds?: number;
}

const USER_AGENT =
  "ArgentinaTerminal/0.1 (+https://github.com/argentinaterminal/argentinaterminal)";

export class BcraProvider {
  readonly name = "bcra";
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;
  private readonly cacheTtlSeconds: number;

  constructor(opts: BcraAdapterOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.base = opts.base ?? BCRA_BASE;
    // 5 minutes matches the scope. BCRA daily series only refresh once per
    // working day, so this is conservative.
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 300;
  }

  /**
   * Pulls a time-series window for the variable. `days` is approximate — for
   * monthly series we widen the window to ensure we capture roughly that many
   * observations.
   */
  async getSeries(key: BcraKey, days = 30): Promise<BcraSeries> {
    const meta = BCRA_VARIABLES[key];
    const today = new Date();
    const window = meta.cadence === "monthly" ? days * 32 : days + 5;
    const from = new Date(today.getTime() - window * 24 * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const url = `${this.base}/Monetarias/${meta.id}?desde=${fmt(from)}&hasta=${fmt(today)}&limit=1000`;
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      next: { revalidate: this.cacheTtlSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (!res.ok) {
      throw new Error(`BCRA fetch failed for ${key} (id ${meta.id}): HTTP ${res.status}`);
    }
    const json = (await res.json()) as unknown;
    const parsed = BcraSeriesPayloadSchema.safeParse(json);
    if (!parsed.success) {
      throw new BcraContractError(
        `BCRA payload for ${key} failed schema: ${parsed.error.message}`,
      );
    }
    const record = parsed.data.results.find((r) => r.idVariable === meta.id);
    if (!record) {
      throw new BcraContractError(`BCRA payload missing idVariable=${meta.id}`);
    }
    // BCRA returns most-recent first; normalize to chronological order so
    // sparkline rendering doesn't need to think about it.
    const points: BcraPoint[] = record.detalle
      .map((p) => ({ date: p.fecha.slice(0, 10), value: p.valor }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return {
      key,
      idVariable: meta.id,
      points,
      source: this.name,
      asOf: new Date().toISOString(),
    };
  }

  /**
   * Returns the latest value + the immediately-previous value for the
   * variable, computed off the series window. The "delta percent" is only
   * meaningful for *level* variables (FX, reservas, base monetaria); for
   * rate-style variables (BADLAR, TAMAR, IPC) we keep `deltaPct: null` and
   * let the UI render the absolute basis-point change instead.
   */
  async getLatest(key: BcraKey): Promise<BcraSnapshot> {
    const series = await this.getSeries(key, 15);
    const points = series.points;
    if (points.length === 0) {
      throw new BcraContractError(`BCRA returned no points for ${key}`);
    }
    const latest = points[points.length - 1]!;
    const prev = points.length >= 2 ? points[points.length - 2]! : null;
    const meta = BCRA_VARIABLES[key];
    const delta = prev !== null ? latest.value - prev.value : null;
    const deltaPct =
      meta.direction === "level" && prev !== null && prev.value !== 0
        ? ((latest.value - prev.value) / prev.value) * 100
        : null;
    return {
      key,
      value: latest.value,
      date: latest.date,
      previousValue: prev?.value ?? null,
      previousDate: prev?.date ?? null,
      delta,
      deltaPct,
      source: series.source,
      asOf: series.asOf,
    };
  }
}

let defaultProvider: BcraProvider | null = null;

export function getDefaultBcraProvider(): BcraProvider {
  if (!defaultProvider) defaultProvider = new BcraProvider();
  return defaultProvider;
}
