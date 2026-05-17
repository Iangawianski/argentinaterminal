/**
 * Shared formatters and tiny helpers used by the Phase 2/3 surfaces
 * (CEDEARs, FX, bonds, macro). Phase 1's lib/format.ts predates this file
 * and exposes a different surface (`formatArs`, `formatTimestamp`, …) used
 * by the home + Phase 1 ticker pages — both can coexist.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatARS(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatUSD(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPct(value: number, fractionDigits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
