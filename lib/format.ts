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

const NUM2 = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const NUM4 = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 4,
  minimumFractionDigits: 2,
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

export function formatNumber(value: number, mode: "default" | "precise" = "default"): string {
  return (mode === "precise" ? NUM4 : NUM2).format(value);
}

export function formatTimestamp(ts: number): string {
  return DATETIME.format(new Date(ts));
}
