import {
  buildCashflows,
  futureCashflows,
  residualState,
} from "@/lib/bonds/cashflows";
import type { BondDefinition, BondMath, CashflowItem } from "@/lib/bonds/types";

/**
 * Bond math: YTM, modified duration, paridad técnica.
 *
 * Conventions:
 *
 *   - Time `t_i` for a cashflow is in *years* from settlement = days / 365.
 *     We use a uniform 365-day basis (actual/365) which matches what BYMA
 *     screens publish; calendar-aware day counts (30/360, actual/actual)
 *     would change the YTM in the third decimal — out of scope.
 *   - YTM `y` is the annualized effective rate that satisfies
 *
 *         dirtyPrice = sum_i CF_i / (1 + y)^t_i
 *
 *     i.e. annual compounding. To compare against a broker quoting
 *     semi-annual bond-equivalent yield, convert with
 *
 *         BEY = 2 * ((1 + y)^0.5 - 1)
 *
 *   - dirtyPrice = cleanPrice + accruedInterest.
 *   - Modified duration is computed on the *yield* basis above:
 *
 *         MD = (1 / P) * sum_i t_i * CF_i / (1 + y)^(t_i + 1)
 *
 *     which is the standard `-dP/dy / P` linearization.
 *   - Paridad técnica = cleanPrice / valorTecnico, where
 *     `valorTecnico = residualFace + accruedInterest`. Expressed as a ratio
 *     (0.42 = 42% of par). The Argentine broker UI usually shows it as a
 *     percentage — the UI layer multiplies by 100.
 */

interface ComputeArgs {
  bond: BondDefinition;
  /** Clean price per 100 face (USD). */
  cleanPrice: number;
  /** Settlement ISO date (T+1 in BYMA hard-dollar). */
  settlementIso: string;
  /** Optional precomputed cashflows — saves rebuilding in tight loops. */
  cashflows?: CashflowItem[];
}

const YEAR_DAYS = 365;
const NEWTON_MAX_ITER = 80;
const NEWTON_TOLERANCE = 1e-9;

export function computeYTM(args: {
  cashflows: CashflowItem[];
  dirtyPrice: number;
  /** Optional starting guess; defaults to 0.10. */
  initialGuess?: number;
}): number {
  const { cashflows, dirtyPrice, initialGuess = 0.1 } = args;
  if (cashflows.length === 0) {
    throw new Error("computeYTM: cashflow schedule is empty");
  }
  if (dirtyPrice <= 0) {
    throw new Error(`computeYTM: dirtyPrice must be positive, got ${dirtyPrice}`);
  }
  let y = initialGuess;
  for (let iter = 0; iter < NEWTON_MAX_ITER; iter += 1) {
    let pv = 0;
    let dpv = 0;
    for (const cf of cashflows) {
      const t = cf.daysFromSettlement / YEAR_DAYS;
      const amount = cf.interest + cf.principal;
      const disc = Math.pow(1 + y, t);
      pv += amount / disc;
      dpv += (-t * amount) / (disc * (1 + y));
    }
    const f = pv - dirtyPrice;
    if (Math.abs(f) < NEWTON_TOLERANCE) return y;
    if (dpv === 0) break;
    const next = y - f / dpv;
    // Clamp to keep the iteration inside a sensible band. Argentine sovereign
    // yields have historically run 5% – 100%+; we go wider to be safe but
    // refuse to let it escape into negative territory where (1+y)^t is wild.
    if (!Number.isFinite(next) || next <= -0.99) {
      y = (y + 0) / 2;
      continue;
    }
    y = next;
  }
  return y;
}

export function computeModifiedDuration(args: {
  cashflows: CashflowItem[];
  ytm: number;
  dirtyPrice: number;
}): number {
  const { cashflows, ytm, dirtyPrice } = args;
  let weightedT = 0;
  for (const cf of cashflows) {
    const t = cf.daysFromSettlement / YEAR_DAYS;
    const amount = cf.interest + cf.principal;
    weightedT += (t * amount) / Math.pow(1 + ytm, t + 1);
  }
  return weightedT / dirtyPrice;
}

export function computeBondMath({
  bond,
  cleanPrice,
  settlementIso,
  cashflows,
}: ComputeArgs): BondMath {
  const allFlows = cashflows ?? buildCashflows(bond);
  const { face, accrued } = residualState(bond, allFlows, settlementIso);
  const future = futureCashflows(allFlows, settlementIso);
  const dirtyPrice = cleanPrice + accrued;
  const valorTecnico = face + accrued;
  const paridad = valorTecnico === 0 ? 0 : cleanPrice / valorTecnico;
  let ytm = 0;
  let modifiedDuration = 0;
  if (future.length > 0 && dirtyPrice > 0) {
    ytm = computeYTM({ cashflows: future, dirtyPrice });
    modifiedDuration = computeModifiedDuration({
      cashflows: future,
      ytm,
      dirtyPrice,
    });
  }
  return {
    symbol: bond.symbol,
    asOf: settlementIso,
    cleanPrice,
    residualFace: round4(face),
    accruedInterest: round6(accrued),
    valorTecnico: round4(valorTecnico),
    paridad: round6(paridad),
    ytm: round6(ytm),
    modifiedDuration: round4(modifiedDuration),
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
