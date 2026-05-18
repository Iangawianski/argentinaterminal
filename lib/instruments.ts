import { BONDS } from "@/lib/bonds/cashflows";
import { CEDEARS } from "@/lib/cedears";

export type AssetKind = "stock" | "cedear" | "bond" | "fx";

export interface Instrument {
  symbol: string;
  name: string;
  kind: AssetKind;
  market: "BYMA" | "NYSE" | "NASDAQ" | "BCBA" | "OTC";
  description?: string;
}

const stocks: Instrument[] = [
  {
    symbol: "GGAL",
    name: "Grupo Financiero Galicia",
    kind: "stock",
    market: "BYMA",
    description: "Acción del panel líder. Cotización en vivo vía Yahoo (GGAL.BA).",
  },
  {
    symbol: "YPFD",
    name: "YPF S.A.",
    kind: "stock",
    market: "BYMA",
    description: "Próximo en línea (Fase 3 — panel líder ampliado).",
  },
  {
    symbol: "PAMP",
    name: "Pampa Energía",
    kind: "stock",
    market: "BYMA",
    description: "Próximo en línea (Fase 3 — panel líder ampliado).",
  },
];

const cedearInstruments: Instrument[] = CEDEARS.map((c) => ({
  symbol: c.symbol,
  name: `${c.name} (CEDEAR)`,
  kind: "cedear" as const,
  market: "BYMA" as const,
  description: `CEDEAR de ${c.underlying} · ratio ${c.ratio}:1.`,
}));

const bonds: Instrument[] = BONDS.map((b) => ({
  symbol: b.symbol,
  name: b.name,
  kind: "bond" as const,
  market: "BYMA" as const,
  description: b.description,
}));

export const INSTRUMENTS: Instrument[] = [...stocks, ...cedearInstruments, ...bonds];

export function findInstrument(symbol: string): Instrument | undefined {
  const upper = symbol.trim().toUpperCase();
  return INSTRUMENTS.find((i) => i.symbol === upper);
}
