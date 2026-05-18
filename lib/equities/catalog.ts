// Expanded BYMA equities catalog for Phase 5.
//
// Universe covered: Panel Líder (~20 names) plus the active Panel General
// (~50 more). Sectors and market-cap buckets are curated by hand because
// BYMA does not publish a free machine-readable mapping. Bucket thresholds
// are qualitative (size relative to the local panel, not absolute USD):
//
//   - large : Panel Líder constituents and the very largest Panel General
//             names by free float (think YPF, Galicia, Pampa, Ternium).
//   - mid   : Active Panel General names with regular volume (LOMA, MIRG,
//             Edenor, Cresud, IRSA…).
//   - small : Thinly traded Panel General names; included for completeness
//             so the catalog spans the realistic retail universe, not just
//             the headline twenty.
//
// ADR mappings only include cases where a true NYSE/Nasdaq ADR exists for
// the same issuer (typically with 1:n ratios). They are intentionally
// conservative — we'd rather omit than display a wrong cross-listing.
//
// Sectors are kept English-canonical here (banks, energy, …) and
// translated for display in `lib/messages/es-AR.ts`.

export type EquitySector =
  | "banks"
  | "energy"
  | "utilities"
  | "materials"
  | "industrials"
  | "consumer"
  | "real_estate"
  | "agro"
  | "telecom"
  | "holdings";

export type MarketCapBucket = "large" | "mid" | "small";

export type EquityMeta = {
  symbol: string;
  name: string;
  sector: EquitySector;
  bucket: MarketCapBucket;
  // Underlying ADR ticker on NYSE/Nasdaq when one exists. The local BYMA
  // share trades in ARS; the ADR trades in USD with its own ratio. We do
  // not encode the ratio here — Phase 6 (parity calc) will own that.
  adr?: string;
  // Whether the symbol is a current Merval Líder constituent. The list is
  // refreshed by BYMA semi-annually; we snapshot the 2025-H2 panel.
  leader?: boolean;
};

export const EQUITY_CATALOG: readonly EquityMeta[] = [
  // -- Banks --------------------------------------------------------------
  { symbol: "GGAL", name: "Grupo Financiero Galicia", sector: "banks", bucket: "large", adr: "GGAL", leader: true },
  { symbol: "BMA", name: "Banco Macro", sector: "banks", bucket: "large", adr: "BMA", leader: true },
  { symbol: "BBAR", name: "BBVA Argentina", sector: "banks", bucket: "large", adr: "BBAR", leader: true },
  { symbol: "SUPV", name: "Grupo Supervielle", sector: "banks", bucket: "mid", adr: "SUPV", leader: true },
  { symbol: "BPAT", name: "Banco Patagonia", sector: "banks", bucket: "mid" },
  { symbol: "BHIP", name: "Banco Hipotecario", sector: "banks", bucket: "mid" },
  { symbol: "VALO", name: "Grupo Financiero Valores", sector: "banks", bucket: "small" },

  // -- Energy -------------------------------------------------------------
  { symbol: "YPFD", name: "YPF S.A.", sector: "energy", bucket: "large", adr: "YPF", leader: true },
  { symbol: "PAMP", name: "Pampa Energía", sector: "energy", bucket: "large", adr: "PAM", leader: true },
  { symbol: "TGSU2", name: "Transportadora Gas del Sur", sector: "energy", bucket: "large", adr: "TGS", leader: true },
  { symbol: "TGNO4", name: "Transportadora Gas del Norte", sector: "energy", bucket: "mid" },
  { symbol: "CEPU", name: "Central Puerto", sector: "energy", bucket: "mid", adr: "CEPU", leader: true },
  { symbol: "CECO2", name: "Central Costanera", sector: "energy", bucket: "small" },
  { symbol: "METR", name: "MetroGAS", sector: "energy", bucket: "mid" },
  { symbol: "CGPA2", name: "Camuzzi Gas Pampeana", sector: "energy", bucket: "small" },
  { symbol: "DGCU2", name: "Distribuidora de Gas Cuyana", sector: "energy", bucket: "small" },
  { symbol: "CAPX", name: "Capex S.A.", sector: "energy", bucket: "mid" },

  // -- Utilities (separated from energy producers) -----------------------
  { symbol: "EDN", name: "Edenor", sector: "utilities", bucket: "mid", adr: "EDN", leader: true },
  { symbol: "TRAN", name: "Transener", sector: "utilities", bucket: "mid", leader: true },
  { symbol: "DGCE", name: "Distribuidora de Gas del Centro", sector: "utilities", bucket: "small" },

  // -- Materials / Steel / Cement ----------------------------------------
  { symbol: "TXAR", name: "Ternium Argentina", sector: "materials", bucket: "large", leader: true },
  { symbol: "ALUA", name: "Aluar Aluminio Argentino", sector: "materials", bucket: "large", leader: true },
  { symbol: "LOMA", name: "Loma Negra", sector: "materials", bucket: "mid", adr: "LOMA", leader: true },
  { symbol: "HARG", name: "Holcim Argentina", sector: "materials", bucket: "mid" },
  { symbol: "FERR", name: "Ferrum", sector: "materials", bucket: "small" },
  { symbol: "RIGO", name: "Rigolleau", sector: "materials", bucket: "small" },

  // -- Industrials --------------------------------------------------------
  { symbol: "MIRG", name: "Mirgor", sector: "industrials", bucket: "mid", leader: true },
  { symbol: "AUSO", name: "Autopistas del Sol", sector: "industrials", bucket: "small" },
  { symbol: "BOLT", name: "Boldt", sector: "industrials", bucket: "small" },
  { symbol: "LONG", name: "Longvie", sector: "industrials", bucket: "small" },
  { symbol: "POLL", name: "Polledo", sector: "industrials", bucket: "small" },
  { symbol: "DOME", name: "Domec", sector: "industrials", bucket: "small" },
  { symbol: "GBAN", name: "Gas Natural BAN", sector: "industrials", bucket: "small" },

  // -- Consumer / Food / Retail ------------------------------------------
  { symbol: "MOLI", name: "Molinos Río de la Plata", sector: "consumer", bucket: "mid" },
  { symbol: "MOLA", name: "Molinos Agro", sector: "consumer", bucket: "small" },
  { symbol: "MORI", name: "Morixe Hermanos", sector: "consumer", bucket: "small" },
  { symbol: "LEDE", name: "Ledesma", sector: "consumer", bucket: "mid" },
  { symbol: "INVJ", name: "Inversora Juramento", sector: "consumer", bucket: "small" },
  { symbol: "PATA", name: "Importadora y Exportadora de la Patagonia", sector: "consumer", bucket: "small" },

  // -- Real Estate --------------------------------------------------------
  { symbol: "CRES", name: "Cresud", sector: "real_estate", bucket: "mid", adr: "CRESY", leader: true },
  { symbol: "IRSA", name: "IRSA Inversiones y Representaciones", sector: "real_estate", bucket: "mid", adr: "IRS", leader: true },
  { symbol: "IRCP", name: "IRSA Propiedades Comerciales", sector: "real_estate", bucket: "mid", adr: "IRCP" },

  // -- Agro --------------------------------------------------------------
  { symbol: "AGRO", name: "Agrometal", sector: "agro", bucket: "small" },
  { symbol: "SAMI", name: "San Miguel A.G.I.C.I. y F.", sector: "agro", bucket: "small" },
  { symbol: "GARO", name: "Garovaglio y Zorraquín", sector: "agro", bucket: "small" },
  { symbol: "GCDI", name: "GCDI (ex-IRSA Internacional)", sector: "agro", bucket: "small" },

  // -- Telecom / Media ---------------------------------------------------
  { symbol: "TECO2", name: "Telecom Argentina", sector: "telecom", bucket: "large", adr: "TEO", leader: true },
  { symbol: "GCLA", name: "Grupo Clarín", sector: "telecom", bucket: "mid" },

  // -- Holdings & diversified --------------------------------------------
  { symbol: "COME", name: "Sociedad Comercial del Plata", sector: "holdings", bucket: "small", leader: true },
  { symbol: "CARC", name: "Carboclor", sector: "holdings", bucket: "small" },
  { symbol: "INTR", name: "Compañía Introductora de Buenos Aires", sector: "holdings", bucket: "small" },
  { symbol: "SEMI", name: "Semino", sector: "holdings", bucket: "small" },
  { symbol: "ROSE", name: "Instituto Rosenbusch", sector: "holdings", bucket: "small" },
  { symbol: "BRIO", name: "Banco Río / Santander Argentina", sector: "banks", bucket: "small" },
  { symbol: "GAMI", name: "Boldt Gaming", sector: "holdings", bucket: "small" },
  { symbol: "HAVA", name: "Havanna Holding", sector: "consumer", bucket: "small" },
  { symbol: "OEST", name: "Grupo Concesionario del Oeste", sector: "industrials", bucket: "small" },
  { symbol: "RICH", name: "Laboratorios Richmond", sector: "consumer", bucket: "small" },
  { symbol: "DGCU", name: "Distribuidora Gas del Centro", sector: "utilities", bucket: "small" },
  { symbol: "GRIM", name: "Grimoldi", sector: "consumer", bucket: "small" },
  { symbol: "FIPL", name: "Fiplasto", sector: "materials", bucket: "small" },
  { symbol: "INAG", name: "Importadora Agrícola", sector: "agro", bucket: "small" },
  { symbol: "CTIO", name: "Consultatio", sector: "real_estate", bucket: "small" },
  { symbol: "DYCA", name: "Dycasa", sector: "industrials", bucket: "small" },
] as const;

const BY_SYMBOL: Map<string, EquityMeta> = new Map(
  EQUITY_CATALOG.map((e) => [e.symbol, e]),
);

export function findEquity(symbol: string): EquityMeta | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

export function isEquitySymbol(symbol: string): boolean {
  return BY_SYMBOL.has(symbol.toUpperCase());
}

export const EQUITY_SECTORS: readonly EquitySector[] = [
  "banks",
  "energy",
  "utilities",
  "materials",
  "industrials",
  "consumer",
  "real_estate",
  "agro",
  "telecom",
  "holdings",
] as const;

export function equitiesBySector(sector: EquitySector): EquityMeta[] {
  return EQUITY_CATALOG.filter((e) => e.sector === sector);
}

export function leaderPanel(): EquityMeta[] {
  return EQUITY_CATALOG.filter((e) => e.leader === true);
}

// Relative weight used by the sector heatmap to size tiles. Anchored on
// the bucket: large = 4, mid = 2, small = 1. Chosen so the visual ranking
// matches qualitative free-float order without claiming pixel-precision
// market cap data we don't have.
export function bucketWeight(bucket: MarketCapBucket): number {
  switch (bucket) {
    case "large":
      return 4;
    case "mid":
      return 2;
    case "small":
      return 1;
  }
}
