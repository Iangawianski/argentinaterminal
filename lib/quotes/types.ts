import { z } from "zod";

/**
 * Common shape for a current quote, normalized across providers.
 * All prices are in the instrument's native currency (ARS for BYMA).
 */
export const QuoteSchema = z.object({
  symbol: z.string(),
  source: z.string(),
  price: z.number(),
  previousClose: z.number().nullable(),
  changePct: z.number().nullable(),
  currency: z.string(),
  asOf: z.string(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const IntradayPointSchema = z.object({
  t: z.string(),
  price: z.number(),
  volume: z.number().nullable(),
});
export type IntradayPoint = z.infer<typeof IntradayPointSchema>;

export const IntradaySeriesSchema = z.object({
  symbol: z.string(),
  source: z.string(),
  asOf: z.string(),
  points: z.array(IntradayPointSchema),
});
export type IntradaySeries = z.infer<typeof IntradaySeriesSchema>;

export const FundamentalsSchema = z.object({
  symbol: z.string(),
  source: z.string(),
  asOf: z.string(),
  marketCap: z.number().nullable(),
  peRatio: z.number().nullable(),
  dividendYield: z.number().nullable(),
  fiftyTwoWeekHigh: z.number().nullable(),
  fiftyTwoWeekLow: z.number().nullable(),
});
export type Fundamentals = z.infer<typeof FundamentalsSchema>;

export interface QuoteProvider {
  readonly name: string;
  getQuote(symbol: string): Promise<Quote>;
  getIntraday(symbol: string): Promise<IntradaySeries>;
  getFundamentals(symbol: string): Promise<Fundamentals>;
}
