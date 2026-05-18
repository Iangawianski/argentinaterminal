import { z } from "zod";

import {
  FX_LABELS,
  FxQuoteSchema,
  type FxKey,
  type FxProvider,
  type FxQuote,
} from "@/lib/fx/types";

/**
 * DolarApi (dolarapi.com) FX adapter.
 *
 * Why DolarApi: free, no API key, public CORS, covers all five rates we
 * care about and updates roughly every minute. Endpoint:
 *
 *     GET https://dolarapi.com/v1/dolares
 *
 * Returns an array of objects with shape:
 *     { casa, nombre, compra, venta, fechaActualizacion }
 *
 * If DolarApi rate-limits us or changes contract, register the gap and
 * propose a swap (Bluelytics or Comparadolar) via request_confirmation.
 *
 * Cache TTL defaults to 30s, matching the issue scope.
 */

export const DOLARAPI_BASE = "https://dolarapi.com";

/**
 * DolarApi "casa" identifiers. We map them to our internal taxonomy.
 * Reference: https://dolarapi.com/docs (as of 2026-05).
 */
const CASA_TO_KEY: Record<string, FxKey> = {
  oficial: "oficial",
  mayorista: "mayorista",
  blue: "blue",
  bolsa: "mep",
  contadoconliqui: "ccl",
};

const DolarItemSchema = z.object({
  casa: z.string(),
  nombre: z.string().optional(),
  compra: z.number().nullable().optional(),
  venta: z.number(),
  fechaActualizacion: z.string().optional(),
});
const DolarListSchema = z.array(DolarItemSchema);
type DolarItem = z.infer<typeof DolarItemSchema>;

export interface DolarApiOptions {
  fetchImpl?: typeof fetch;
  base?: string;
  cacheTtlSeconds?: number;
}

function normalize(item: DolarItem): FxQuote | null {
  const key = CASA_TO_KEY[item.casa.toLowerCase()];
  if (!key) return null;
  return FxQuoteSchema.parse({
    key,
    label: FX_LABELS[key],
    source: "dolarapi",
    bid: item.compra ?? null,
    ask: item.venta,
    // DolarApi does not expose intraday % change; the UI computes it client-
    // side once we accumulate samples (or leaves it null).
    changePct: null,
    asOf: item.fechaActualizacion ?? new Date().toISOString(),
  });
}

export class DolarApiProvider implements FxProvider {
  readonly name = "dolarapi";
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;
  private readonly cacheTtlSeconds: number;

  constructor(opts: DolarApiOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.base = opts.base ?? DOLARAPI_BASE;
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 30;
  }

  private async fetchAll(): Promise<DolarItem[]> {
    const url = `${this.base}/v1/dolares`;
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent":
          "ArgentinaTerminal/0.1 (+https://github.com/argentinaterminal/argentinaterminal)",
        Accept: "application/json",
      },
      next: { revalidate: this.cacheTtlSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (!res.ok) {
      throw new Error(`DolarApi fetch failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as unknown;
    return DolarListSchema.parse(json);
  }

  async getAll(): Promise<FxQuote[]> {
    const items = await this.fetchAll();
    const quotes: FxQuote[] = [];
    for (const item of items) {
      const q = normalize(item);
      if (q) quotes.push(q);
    }
    // Sort by our canonical taxonomy order so the UI can render cards in a
    // predictable layout without re-sorting on the client.
    const order: Record<FxKey, number> = {
      oficial: 0,
      mayorista: 1,
      mep: 2,
      ccl: 3,
      blue: 4,
    };
    quotes.sort((a, b) => order[a.key] - order[b.key]);
    return quotes;
  }

  async get(key: FxKey): Promise<FxQuote> {
    const all = await this.getAll();
    const hit = all.find((q) => q.key === key);
    if (!hit) throw new Error(`DolarApi did not return ${key}`);
    return hit;
  }
}

export { CASA_TO_KEY as DOLARAPI_CASA_TO_KEY };
