import type {
  AmortizationStep,
  BondDefinition,
  CashflowItem,
  CouponStep,
} from "@/lib/bonds/types";

/**
 * Static cashflow definitions for the five sovereign hard-dollar bonds from
 * the 2020 Guzmán restructuring (AL30/GD30 amortizing, GD35 bullet, GD38 and
 * GD41 amortizing long-tenor). Source: Ministerio de Economía prospectus
 * (Decreto 582/2020 + offering memoranda).
 *
 * Why hardcoded: there is no free, contractually stable API exposing the
 * amortization tables; Rava only ships the live price. If a re-tap, canje or
 * coupon swap happens in the future, update this table by hand — the math
 * module will pick up the new schedule automatically.
 *
 * All amortization slices below sum to exactly 100. Coupon step-up dates use
 * the published anniversary cadence (Jul 9 / Jan 9). Rates are annual, paid
 * semi-annually on the same dates. The first sub-period coupon (Jul-2020 →
 * Jan-2021) is on a stub basis but small enough to round to the next
 * scheduled date for our purposes — we mostly care about *future* flows.
 */

function semiAnnualAmortization(start: string, count: number): AmortizationStep[] {
  // Splits 100% into `count` equal slices on semestral anniversaries (Jul 9 /
  // Jan 9 cadence). The final slice carries any rounding so the schedule sums
  // exactly to 100 — that matters for paridad técnica at the very tail.
  const slice = 100 / count;
  const out: AmortizationStep[] = [];
  const [yy, mm, dd] = start.split("-").map(Number) as [number, number, number];
  let year = yy;
  let month = mm;
  let cumulative = 0;
  for (let i = 0; i < count; i += 1) {
    const isLast = i === count - 1;
    const pct = isLast ? Number((100 - cumulative).toFixed(6)) : slice;
    cumulative = Number((cumulative + pct).toFixed(6));
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    out.push({ date: iso, pctOfFace: pct });
    // Step forward 6 months. Jan (1) -> Jul (7); Jul (7) -> Jan next year.
    if (month === 7) {
      month = 1;
      year += 1;
    } else {
      month = 7;
    }
  }
  return out;
}

const AL30_COUPON: CouponStep[] = [
  { from: "2020-07-09", annualRatePct: 0.125 },
  { from: "2021-07-09", annualRatePct: 0.5 },
  { from: "2023-07-09", annualRatePct: 0.75 },
  { from: "2027-07-09", annualRatePct: 1.75 },
];

const AL30: BondDefinition = {
  symbol: "AL30",
  name: "Bonar 2030 (AL30)",
  issued: "2020-09-04",
  maturity: "2030-07-09",
  law: "AR",
  couponSchedule: AL30_COUPON,
  // 13 equal slices on 9-jul-2024 ... 9-jul-2030 (semestral).
  amortizationSchedule: semiAnnualAmortization("2024-07-09", 13),
  arsBaSymbol: "AL30.BA",
  usdBaSymbol: "AL30D.BA",
  description: "Hard-dollar, ley argentina, vence 09-jul-2030. Amortiza en 13 cuotas semestrales.",
};

const GD30: BondDefinition = {
  symbol: "GD30",
  name: "Global 2030 (GD30)",
  issued: "2020-09-04",
  maturity: "2030-07-09",
  law: "NY",
  couponSchedule: AL30_COUPON,
  amortizationSchedule: semiAnnualAmortization("2024-07-09", 13),
  arsBaSymbol: "GD30.BA",
  usdBaSymbol: "GD30D.BA",
  description: "Hard-dollar, ley NY, vence 09-jul-2030. Misma estructura que AL30.",
};

const GD35: BondDefinition = {
  symbol: "GD35",
  name: "Global 2035 (GD35)",
  issued: "2020-09-04",
  maturity: "2035-07-09",
  law: "NY",
  couponSchedule: [
    { from: "2020-07-09", annualRatePct: 0.125 },
    { from: "2021-07-09", annualRatePct: 1.125 },
    { from: "2022-07-09", annualRatePct: 1.5 },
    { from: "2024-07-09", annualRatePct: 3.625 },
    { from: "2027-07-09", annualRatePct: 4.125 },
  ],
  // Bullet — 100% at maturity.
  amortizationSchedule: [{ date: "2035-07-09", pctOfFace: 100 }],
  arsBaSymbol: "GD35.BA",
  usdBaSymbol: "GD35D.BA",
  description: "Hard-dollar, ley NY, vence 09-jul-2035. Bullet (paga capital al vencimiento).",
};

const GD38: BondDefinition = {
  symbol: "GD38",
  name: "Global 2038 (GD38)",
  issued: "2020-09-04",
  maturity: "2038-01-09",
  law: "NY",
  couponSchedule: [
    { from: "2020-07-09", annualRatePct: 0.125 },
    { from: "2021-07-09", annualRatePct: 2.0 },
    { from: "2022-07-09", annualRatePct: 3.875 },
    { from: "2023-07-09", annualRatePct: 4.25 },
    { from: "2024-07-09", annualRatePct: 5.0 },
  ],
  // 22 equal slices on 9-jul-2027 ... 9-ene-2038.
  amortizationSchedule: semiAnnualAmortization("2027-07-09", 22),
  arsBaSymbol: "GD38.BA",
  usdBaSymbol: "GD38D.BA",
  description: "Hard-dollar, ley NY, vence 09-ene-2038. Amortiza en 22 cuotas semestrales.",
};

const GD41: BondDefinition = {
  symbol: "GD41",
  name: "Global 2041 (GD41)",
  issued: "2020-09-04",
  maturity: "2041-07-09",
  law: "NY",
  couponSchedule: [
    { from: "2020-07-09", annualRatePct: 0.125 },
    { from: "2021-07-09", annualRatePct: 2.5 },
    { from: "2022-07-09", annualRatePct: 3.5 },
    { from: "2029-07-09", annualRatePct: 4.875 },
  ],
  // 28 equal slices on 9-jul-2028 ... 9-ene-2042 (formal contract).
  amortizationSchedule: semiAnnualAmortization("2028-07-09", 28),
  arsBaSymbol: "GD41.BA",
  usdBaSymbol: "GD41D.BA",
  description: "Hard-dollar, ley NY, vence 09-jul-2041. Amortiza en 28 cuotas semestrales.",
};

export const BONDS: BondDefinition[] = [AL30, GD30, GD35, GD38, GD41];

export function findBond(symbol: string): BondDefinition | undefined {
  const upper = symbol.trim().toUpperCase();
  return BONDS.find((b) => b.symbol === upper);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Returns the coupon rate (annual, percent) effective on a given ISO date,
 * scanning the step-up table from latest to earliest.
 */
export function couponRateAt(bond: BondDefinition, isoDate: string): number {
  const t = Date.parse(isoDate);
  let rate = 0;
  for (const step of bond.couponSchedule) {
    if (Date.parse(step.from) <= t) {
      rate = step.annualRatePct;
    }
  }
  return rate;
}

/**
 * Builds the complete dated cashflow schedule for the bond, normalized to
 * 100 units of *original* face. Coupons are paid on every amortization date
 * (and on intermediate semestral dates before amortization begins, when no
 * principal is paid). Coupon for a period is computed on the residual face
 * at the *start* of the period using the rate effective at that period start.
 *
 * The first historical sub-period (issuance → first coupon) is dropped from
 * the schedule we publish because:
 *   (a) it's already in the past for every settlement we'll ever care about,
 *   (b) it was paid pro-rata and is documented in the prospectus stub.
 * For YTM purposes, only future flows matter.
 */
export function buildCashflows(bond: BondDefinition): CashflowItem[] {
  // Collect every payment date (every Jan 9 / Jul 9 from first coupon up to
  // and including maturity).
  const dates = new Set<string>();
  for (const a of bond.amortizationSchedule) dates.add(a.date);
  // Step semestral from the first coupon anniversary after issuance until the
  // last amortization date. We approximate: first coupon on Jan 9 2021 for
  // all of the 2020 issues.
  const first = "2021-01-09";
  const last = bond.amortizationSchedule[bond.amortizationSchedule.length - 1]!.date;
  const lastTs = Date.parse(last);
  let [y, m] = [Number(first.slice(0, 4)), Number(first.slice(5, 7))];
  while (true) {
    const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-09`;
    dates.add(iso);
    if (Date.parse(iso) >= lastTs) break;
    if (m === 7) {
      m = 1;
      y += 1;
    } else {
      m = 7;
    }
  }
  const ordered = Array.from(dates).sort();

  const amortByDate = new Map<string, number>();
  for (const a of bond.amortizationSchedule) {
    amortByDate.set(a.date, (amortByDate.get(a.date) ?? 0) + a.pctOfFace);
  }

  const items: CashflowItem[] = [];
  let face = 100;
  let prevDate = "2020-07-09";
  for (const date of ordered) {
    // Coupon is on the face *at the start of the period* using the rate at
    // the *start of the period*. Semestral pay → annualRate / 2.
    const periodRate = couponRateAt(bond, prevDate);
    const interest = (face * periodRate) / 100 / 2;
    const principal = amortByDate.get(date) ?? 0;
    face = Math.max(0, face - principal);
    items.push({
      date,
      daysFromSettlement: 0,
      interest: round6(interest),
      principal: round6(principal),
      faceAfter: round6(face),
    });
    prevDate = date;
  }
  return items;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Filters the static cashflow to those after the settlement date and stamps
 * `daysFromSettlement`. Returns the future flows the YTM / duration math
 * iterates over.
 */
export function futureCashflows(
  cashflows: CashflowItem[],
  settlementIso: string
): CashflowItem[] {
  const settle = Date.parse(settlementIso);
  return cashflows
    .filter((cf) => Date.parse(cf.date) > settle)
    .map((cf) => ({ ...cf, daysFromSettlement: daysBetween(settlementIso, cf.date) }));
}

/**
 * Outstanding face at settlement (per 100 of original face), and the accrued
 * coupon since the last coupon date.
 *
 * Accrual convention: actual/actual on the current coupon period (start →
 * next coupon date). This matches CAFCI / BYMA practice for these species
 * and keeps paridad técnica comparable to broker screens.
 */
export function residualState(
  bond: BondDefinition,
  cashflows: CashflowItem[],
  settlementIso: string
): { face: number; accrued: number; lastCouponDate: string; nextCouponDate: string } {
  const settle = Date.parse(settlementIso);
  let face = 100;
  let lastCouponDate = "2020-07-09";
  let nextCouponDate = cashflows[0]?.date ?? bond.maturity;
  for (const cf of cashflows) {
    const t = Date.parse(cf.date);
    if (t <= settle) {
      face = cf.faceAfter;
      lastCouponDate = cf.date;
    } else {
      nextCouponDate = cf.date;
      break;
    }
  }
  const periodRate = couponRateAt(bond, lastCouponDate);
  const periodDays = daysBetween(lastCouponDate, nextCouponDate);
  const accruedDays = Math.max(0, daysBetween(lastCouponDate, settlementIso));
  const fullCoupon = (face * periodRate) / 100 / 2;
  const accrued = periodDays > 0 ? (fullCoupon * accruedDays) / periodDays : 0;
  return { face, accrued, lastCouponDate, nextCouponDate };
}
