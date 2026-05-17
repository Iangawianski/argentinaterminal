import { describe, expect, it } from "vitest";

import {
  buildCashflows,
  findBond,
  futureCashflows,
  residualState,
} from "./cashflows";
import { computeBondMath, computeModifiedDuration, computeYTM } from "./math";
import type { CashflowItem } from "./types";

/**
 * Newton-Raphson YTM sanity: a 1-year zero-coupon bond priced at 90 should
 * yield ~11.11% (= 100/90 - 1). This isolates the solver from the static
 * Argentine cashflow tables.
 */
describe("computeYTM (synthetic flows)", () => {
  it("recovers 11.11% on a 1y zero priced at 90", () => {
    const cf: CashflowItem[] = [
      { date: "2027-05-16", daysFromSettlement: 365, interest: 0, principal: 100, faceAfter: 0 },
    ];
    const y = computeYTM({ cashflows: cf, dirtyPrice: 90 });
    expect(y).toBeCloseTo(100 / 90 - 1, 6);
  });

  it("recovers 5% on a 2y annual 5% coupon bond priced at par", () => {
    // Par bond: YTM equals coupon rate. Two annual flows of 5 + final 100.
    const cf: CashflowItem[] = [
      { date: "2027-05-16", daysFromSettlement: 365, interest: 5, principal: 0, faceAfter: 100 },
      { date: "2028-05-16", daysFromSettlement: 730, interest: 5, principal: 100, faceAfter: 0 },
    ];
    const y = computeYTM({ cashflows: cf, dirtyPrice: 100 });
    expect(y).toBeCloseTo(0.05, 6);
  });

  it("handles a discounted multi-flow bond (deep junk territory)", () => {
    // A bond paying 1, 1, 1, 101 yearly, priced at 40 — Argentine-style
    // deep-discount paper. Solver should still converge.
    const cf: CashflowItem[] = [
      { date: "2027-05-16", daysFromSettlement: 365, interest: 1, principal: 0, faceAfter: 100 },
      { date: "2028-05-16", daysFromSettlement: 730, interest: 1, principal: 0, faceAfter: 100 },
      { date: "2029-05-16", daysFromSettlement: 1095, interest: 1, principal: 0, faceAfter: 100 },
      { date: "2030-05-16", daysFromSettlement: 1460, interest: 1, principal: 100, faceAfter: 0 },
    ];
    const y = computeYTM({ cashflows: cf, dirtyPrice: 40 });
    expect(y).toBeGreaterThan(0.25);
    // Verify by reconstructing PV.
    let pv = 0;
    for (const c of cf) {
      const t = c.daysFromSettlement / 365;
      pv += (c.interest + c.principal) / Math.pow(1 + y, t);
    }
    expect(pv).toBeCloseTo(40, 4);
  });
});

describe("computeModifiedDuration", () => {
  it("equals ~1y for a 1y zero", () => {
    const cf: CashflowItem[] = [
      { date: "2027-05-16", daysFromSettlement: 365, interest: 0, principal: 100, faceAfter: 0 },
    ];
    const y = computeYTM({ cashflows: cf, dirtyPrice: 90 });
    const md = computeModifiedDuration({ cashflows: cf, ytm: y, dirtyPrice: 90 });
    // MacDur = 1y, modDur = MacDur / (1+y) ≈ 0.9.
    expect(md).toBeCloseTo(1 / (1 + y), 5);
  });
});

describe("AL30 cashflow schedule", () => {
  const al30 = findBond("AL30")!;
  const flows = buildCashflows(al30);

  it("amortization sums to 100", () => {
    const totalPrincipal = flows.reduce((s, f) => s + f.principal, 0);
    expect(totalPrincipal).toBeCloseTo(100, 4);
  });

  it("final face after last amortization is 0", () => {
    const last = flows[flows.length - 1]!;
    expect(last.faceAfter).toBeCloseTo(0, 4);
    expect(last.date).toBe("2030-07-09");
  });

  it("first amortization happens 2024-07-09", () => {
    const firstAmort = flows.find((f) => f.principal > 0);
    expect(firstAmort?.date).toBe("2024-07-09");
  });

  it("coupon rate steps up — 2027 coupon paid on full residual face at 1.75%", () => {
    // Find the period that *starts* 2027-07-09 (residual 100 - 6*7.6923 = ~53.85).
    // The coupon paid 2028-01-09 reflects the 1.75% rate.
    const cf = flows.find((f) => f.date === "2028-01-09");
    expect(cf).toBeDefined();
    // residual at start of that period = faceAfter on 2027-07-09 amortization.
    const startOfPeriod = flows.find((f) => f.date === "2027-07-09");
    const expectedInterest = (startOfPeriod!.faceAfter * 1.75) / 100 / 2;
    expect(cf!.interest).toBeCloseTo(expectedInterest, 4);
  });
});

describe("GD35 (bullet) cashflow schedule", () => {
  const gd35 = findBond("GD35")!;
  const flows = buildCashflows(gd35);

  it("pays 100% principal at maturity only", () => {
    const principalDates = flows.filter((f) => f.principal > 0);
    expect(principalDates).toHaveLength(1);
    expect(principalDates[0]!.date).toBe("2035-07-09");
    expect(principalDates[0]!.principal).toBeCloseTo(100, 4);
  });

  it("uses the 4.125% step-up coupon at the end", () => {
    // Coupon period starting 2030-01-09 (after step-up at 2027-07-09 was
    // already 4.125%, well past 2024 step). Residual face = 100 (bullet).
    const cf = flows.find((f) => f.date === "2030-01-09");
    expect(cf?.interest).toBeCloseTo((100 * 4.125) / 100 / 2, 4);
  });
});

describe("residualState", () => {
  it("AL30 face on a settlement before any amortization is 100", () => {
    const al30 = findBond("AL30")!;
    const flows = buildCashflows(al30);
    const { face, accrued } = residualState(al30, flows, "2024-01-01");
    expect(face).toBeCloseTo(100, 4);
    expect(accrued).toBeGreaterThan(0);
  });

  it("AL30 face after 2 amortizations equals 100 - 2*(100/13)", () => {
    const al30 = findBond("AL30")!;
    const flows = buildCashflows(al30);
    // Two amortizations: 2024-07-09 and 2025-01-09. Settle 2025-01-10.
    const { face } = residualState(al30, flows, "2025-01-10");
    const expected = 100 - 2 * (100 / 13);
    expect(face).toBeCloseTo(expected, 3);
  });
});

describe("computeBondMath on AL30 at par-ish", () => {
  it("yields ~coupon when priced at residual face (par on residual)", () => {
    const al30 = findBond("AL30")!;
    const flows = buildCashflows(al30);
    // Pick a settlement well into the bond's life so we have residual < 100.
    const settle = "2027-01-10";
    const { face } = residualState(al30, flows, settle);
    // Clean price = residual (par on residual). YTM should be roughly the
    // weighted-average coupon — for AL30 this far in, the rate is 1.75%.
    const m = computeBondMath({ bond: al30, cleanPrice: face, settlementIso: settle });
    expect(m.symbol).toBe("AL30");
    expect(m.residualFace).toBeCloseTo(face, 3);
    expect(m.ytm).toBeGreaterThan(0);
    expect(m.ytm).toBeLessThan(0.05); // single-digit when priced at par
    expect(m.paridad).toBeCloseTo(face / (face + m.accruedInterest), 3);
  });

  it("yields >20% when AL30 is heavily discounted (40% of residual)", () => {
    const al30 = findBond("AL30")!;
    const settle = "2026-05-16";
    const { face } = residualState(al30, buildCashflows(al30), settle);
    const m = computeBondMath({
      bond: al30,
      cleanPrice: face * 0.4,
      settlementIso: settle,
    });
    expect(m.ytm).toBeGreaterThan(0.2);
    expect(m.modifiedDuration).toBeGreaterThan(0);
    expect(m.modifiedDuration).toBeLessThan(5);
  });
});

describe("futureCashflows", () => {
  it("excludes flows on or before the settlement date", () => {
    const al30 = findBond("AL30")!;
    const flows = buildCashflows(al30);
    const future = futureCashflows(flows, "2025-01-09");
    expect(future.every((f) => Date.parse(f.date) > Date.parse("2025-01-09"))).toBe(true);
    // Should have many flows remaining (multiple amortizations through 2030).
    expect(future.length).toBeGreaterThan(5);
  });
});
