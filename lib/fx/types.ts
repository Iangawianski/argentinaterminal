import { z } from "zod";

/**
 * Argentine peso FX taxonomy. We expose the five rates that retail users
 * actually trade against:
 *   - oficial   : retail "official" rate
 *   - mayorista : wholesale interbank rate
 *   - blue      : informal cash market
 *   - mep       : implicit via AL30 bond round-trip (BYMA)
 *   - ccl       : "contado con liquidación" — cross-listed transfer
 *
 * Tarjeta / cripto are intentionally out of scope for Phase 2.
 */
export const FX_KEYS = ["oficial", "mayorista", "blue", "mep", "ccl"] as const;
export type FxKey = (typeof FX_KEYS)[number];

export const FxQuoteSchema = z.object({
  key: z.enum(FX_KEYS),
  label: z.string(),
  source: z.string(),
  /** Compra (bid). */
  bid: z.number().nullable(),
  /** Venta (ask). Treated as the canonical "price" when calculating parities. */
  ask: z.number(),
  /** Day variation in percent, if the provider supplies it. */
  changePct: z.number().nullable(),
  asOf: z.string(),
});
export type FxQuote = z.infer<typeof FxQuoteSchema>;

export interface FxProvider {
  readonly name: string;
  getAll(): Promise<FxQuote[]>;
  get(key: FxKey): Promise<FxQuote>;
}

export const FX_LABELS: Record<FxKey, string> = {
  oficial: "Oficial",
  mayorista: "Mayorista",
  blue: "Blue",
  mep: "MEP",
  ccl: "CCL",
};
