import { z } from "zod";

/**
 * Argentine hard-dollar sovereign bond taxonomy.
 *
 * All bonds covered here come from the 2020 Guzmán restructuring. They share
 * a common shape:
 *   - Issued at par (100), semi-annual step-up coupons on Jan 9 / Jul 9.
 *   - Either amortizing (AL30, GD30, GD38, GD41) or bullet (GD35).
 *   - Quoted clean (precio limpio) in USD per 100 face.
 *
 * "Hard-dollar" means the cashflows are denominated in USD. The local-law
 * variants (AL*) settle in pesos through the Caja de Valores but the
 * coupon and amortization currency is still USD.
 *
 * Two key derived quantities the Argentine market watches every day:
 *   - **TIR** (yield-to-maturity, internal rate of return)
 *   - **Paridad técnica** = precio limpio / valor técnico
 *
 * The math module computes both from the cashflow schedule plus the
 * settlement-date residual face value.
 */

export const BOND_LAWS = ["NY", "AR"] as const;
export type BondLaw = (typeof BOND_LAWS)[number];

export interface BondDefinition {
  /** BYMA symbol (e.g. AL30, GD30). USD-paying species. */
  symbol: string;
  /** Display name, e.g. "Bonar 2030". */
  name: string;
  /** ISO date string of bond issuance. */
  issued: string;
  /** ISO date string of bond maturity. */
  maturity: string;
  /** Governing law — affects investor perception of restructuring risk. */
  law: BondLaw;
  /** Coupon step-up schedule. Each entry is the rate that applies *from* `from`. */
  couponSchedule: CouponStep[];
  /** Amortization schedule. Each entry is the % of original face paid on `date`. */
  amortizationSchedule: AmortizationStep[];
  /** ARS-settling species (e.g. AL30.BA). Optional — used by the Yahoo fallback. */
  arsBaSymbol?: string;
  /** USD-settling species, what we typically quote (e.g. AL30D.BA on Yahoo). */
  usdBaSymbol: string;
  /** One-liner shown in the UI / command palette. */
  description: string;
}

export interface CouponStep {
  /** ISO date — the coupon rate applies from this date onward (inclusive). */
  from: string;
  /** Annual coupon rate, expressed as a percent (e.g. 1.75 for 1.75%). */
  annualRatePct: number;
}

export interface AmortizationStep {
  /** ISO date when the principal slice is paid. */
  date: string;
  /** Percent of original face redeemed on this date (e.g. 7.6923 for 1/13). */
  pctOfFace: number;
}

export const CashflowItemSchema = z.object({
  date: z.string(),
  /** Days from settlement, signed. Negative for past flows. */
  daysFromSettlement: z.number(),
  /** Interest paid on this date, per 100 original face. */
  interest: z.number(),
  /** Principal paid on this date, per 100 original face. */
  principal: z.number(),
  /** Outstanding face *after* this payment, per 100 original face. */
  faceAfter: z.number(),
});
export type CashflowItem = z.infer<typeof CashflowItemSchema>;

export const BondMathSchema = z.object({
  symbol: z.string(),
  asOf: z.string(),
  /** Clean price (precio limpio) per 100 face, in USD. Input. */
  cleanPrice: z.number(),
  /** Residual outstanding face at settlement, per 100 original face. */
  residualFace: z.number(),
  /** Accrued interest at settlement (current coupon period, per 100 face). */
  accruedInterest: z.number(),
  /** Valor técnico = residualFace + accruedInterest. */
  valorTecnico: z.number(),
  /** Paridad técnica = cleanPrice / valorTecnico (as ratio, not percent). */
  paridad: z.number(),
  /** Yield-to-maturity, annualized effective rate (decimal: 0.12 = 12%). */
  ytm: z.number(),
  /** Modified duration in years. */
  modifiedDuration: z.number(),
});
export type BondMath = z.infer<typeof BondMathSchema>;
