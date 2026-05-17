import { z } from "zod";

/**
 * Bond quote shape — distinct from `Quote` in `lib/quotes/types.ts` because:
 *   - Bonds are always quoted USD per 100 face (precio limpio).
 *   - The "previous close" comparison is over the same USD price, not ARS.
 *   - We retain the upstream symbol that was actually hit (e.g. AL30D for
 *     Rava, AL30D.BA for Yahoo) for traceability in the UI.
 */
export const BondQuoteSchema = z.object({
  /** Canonical bond symbol (AL30, GD30, ...) — the BondDefinition key. */
  symbol: z.string(),
  /** Upstream symbol that was actually hit (AL30D, AL30D.BA, ...). */
  upstreamSymbol: z.string(),
  source: z.string(),
  /** Clean price per 100 face, in USD. */
  cleanPrice: z.number(),
  /** Previous session's clean price, when the source provides it. */
  previousClose: z.number().nullable(),
  /** Day-over-day percent change, derived from previousClose when possible. */
  changePct: z.number().nullable(),
  asOf: z.string(),
});
export type BondQuote = z.infer<typeof BondQuoteSchema>;

export const BondHistoryPointSchema = z.object({
  date: z.string(),
  close: z.number(),
});
export type BondHistoryPoint = z.infer<typeof BondHistoryPointSchema>;

export const BondHistorySchema = z.object({
  symbol: z.string(),
  upstreamSymbol: z.string(),
  source: z.string(),
  points: z.array(BondHistoryPointSchema),
});
export type BondHistory = z.infer<typeof BondHistorySchema>;

export interface BondQuoteProvider {
  readonly name: string;
  getQuote(bondSymbol: string): Promise<BondQuote>;
  getHistory(bondSymbol: string, days?: number): Promise<BondHistory>;
}
