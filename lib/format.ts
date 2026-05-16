const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const PCT = new Intl.NumberFormat("es-AR", {
  style: "percent",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const DATETIME = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatArs(value: number): string {
  return ARS.format(value);
}

export function formatPct(fraction: number): string {
  return PCT.format(fraction);
}

export function formatTimestamp(ts: number): string {
  return DATETIME.format(new Date(ts));
}
