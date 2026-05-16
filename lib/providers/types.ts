import { z } from "zod";

export const QuoteSchema = z.object({
  symbol: z.string(),
  last: z.number().finite(),
  previousClose: z.number().finite(),
  change: z.number().finite(),
  open: z.number().finite(),
  dayHigh: z.number().finite(),
  dayLow: z.number().finite(),
  volume: z.number().int().nonnegative(),
  timestamp: z.number().int().positive(),
  currency: z.literal("ARS"),
  source: z.enum(["yahoo", "rava", "mock"]),
});

export type Quote = z.infer<typeof QuoteSchema>;

export type QuoteProvider = {
  readonly name: Quote["source"];
  fetchQuote(symbol: string): Promise<Quote>;
};

export class ProviderError extends Error {
  public readonly provider: Quote["source"];
  public readonly cause?: unknown;

  constructor(
    message: string,
    provider: Quote["source"],
    cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.cause = cause;
  }
}
