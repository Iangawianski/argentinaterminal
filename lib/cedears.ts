/**
 * CEDEAR catalog with conversion ratio and underlying ADR/equity mapping.
 *
 * Ratio convention: `ratio` CEDEARs equal 1 underlying share. So the
 * implicit USD price of one underlying derived from the local ARS price is:
 *
 *     impliedUSD = (priceARS * ratio) / fxCCL
 *
 * And the implicit FX (CCL) implied by the CEDEAR vs. the ADR price is:
 *
 *     impliedFX_CCL = (priceARS * ratio) / priceUSD
 *
 * Ratios change over time (BYMA periodically rebalances after splits or
 * issuer actions). Values below are as of 2025 — keep `ratioAsOf` updated
 * when a re-ratio happens. Source: BYMA technical notes / Comafi CEDEAR
 * conversion tables.
 */

export interface Cedear {
  /** BYMA-listed CEDEAR symbol (same ticker as underlying for these names). */
  symbol: string;
  /** Underlying ticker on its home exchange (NYSE / NASDAQ). */
  underlying: string;
  /** CEDEARs per 1 underlying share. */
  ratio: number;
  /** Display name for the underlying company. */
  name: string;
  /** Date the ratio above was last verified. */
  ratioAsOf: string;
}

export const CEDEARS: Cedear[] = [
  {
    symbol: "AAPL",
    underlying: "AAPL",
    ratio: 10,
    name: "Apple Inc.",
    ratioAsOf: "2025-01-01",
  },
  {
    symbol: "MSFT",
    underlying: "MSFT",
    ratio: 19,
    name: "Microsoft Corp.",
    ratioAsOf: "2025-01-01",
  },
  {
    symbol: "KO",
    underlying: "KO",
    ratio: 5,
    name: "Coca-Cola Co.",
    ratioAsOf: "2025-01-01",
  },
  {
    symbol: "GOOGL",
    underlying: "GOOGL",
    ratio: 58,
    name: "Alphabet Inc. Class A",
    ratioAsOf: "2025-01-01",
  },
  {
    symbol: "TSLA",
    underlying: "TSLA",
    ratio: 30,
    name: "Tesla Inc.",
    ratioAsOf: "2025-01-01",
  },
];

export function findCedear(symbol: string): Cedear | undefined {
  const upper = symbol.trim().toUpperCase();
  return CEDEARS.find((c) => c.symbol === upper);
}

export interface CedearParity {
  /** Local CEDEAR price in ARS. */
  priceARS: number;
  /** Underlying ADR/equity price in USD. */
  priceUSD: number;
  /** FX used for the conversion (typically CCL or MEP). */
  fx: number;
  /** Conversion ratio used (CEDEARs per 1 underlying share). */
  ratio: number;
  /** Implicit USD price of 1 underlying derived from the local CEDEAR. */
  impliedUSD: number;
  /** Implicit FX rate implied by the CEDEAR vs. the ADR. */
  impliedFX: number;
  /** Premium (positive) or discount (negative) of CEDEAR vs. ADR, in pct. */
  premiumPct: number;
}

export function computeParity(args: {
  priceARS: number;
  priceUSD: number;
  fx: number;
  ratio: number;
}): CedearParity {
  const { priceARS, priceUSD, fx, ratio } = args;
  const impliedUSD = (priceARS * ratio) / fx;
  const impliedFX = priceUSD === 0 ? 0 : (priceARS * ratio) / priceUSD;
  const premiumPct = priceUSD === 0 ? 0 : ((impliedUSD - priceUSD) / priceUSD) * 100;
  return { priceARS, priceUSD, fx, ratio, impliedUSD, impliedFX, premiumPct };
}
