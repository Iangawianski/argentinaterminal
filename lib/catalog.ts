export type Market = "BYMA" | "NYSE" | "NASDAQ" | "INDEX";

export type SymbolKind = "stock" | "cedear" | "bond" | "benchmark";

export type SymbolMeta = {
  symbol: string;
  name: string;
  market: Market;
  kind: SymbolKind;
};

export const SYMBOL_CATALOG: readonly SymbolMeta[] = [
  { symbol: "GGAL", name: "Grupo Financiero Galicia", market: "BYMA", kind: "stock" },
  { symbol: "YPFD", name: "YPF S.A.", market: "BYMA", kind: "stock" },
  { symbol: "BMA", name: "Banco Macro", market: "BYMA", kind: "stock" },
  { symbol: "PAMP", name: "Pampa Energía", market: "BYMA", kind: "stock" },
  { symbol: "TXAR", name: "Ternium Argentina", market: "BYMA", kind: "stock" },
  { symbol: "ALUA", name: "Aluar", market: "BYMA", kind: "stock" },
  { symbol: "CRES", name: "Cresud", market: "BYMA", kind: "stock" },
  { symbol: "EDN", name: "Edenor", market: "BYMA", kind: "stock" },
  { symbol: "TGSU2", name: "Transportadora Gas del Sur", market: "BYMA", kind: "stock" },
  { symbol: "MERVAL", name: "Índice MERVAL", market: "INDEX", kind: "benchmark" },
] as const;

const BY_SYMBOL: Map<string, SymbolMeta> = new Map(
  SYMBOL_CATALOG.map((s) => [s.symbol, s]),
);

export function findSymbol(symbol: string): SymbolMeta | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}
