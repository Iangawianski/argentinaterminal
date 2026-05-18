export const messages = {
  app: {
    name: "ArgentinaTerminal",
    tagline: "Terminal financiera para el inversor argentino.",
  },
  topBar: {
    paletteHint: "Buscar ticker",
    themeToggle: "Cambiar tema",
  },
  home: {
    title: "ArgentinaTerminal",
    subtitle:
      "Vista unificada, keyboard-first, para acciones BYMA, CEDEARs, bonos soberanos y macro local.",
    paletteHint:
      "Apretá Ctrl+K (o ⌘K) para abrir el palette y buscar un ticker.",
    symbolsHeader: "Tickers de prueba",
  },
  palette: {
    placeholder: "Buscar ticker, CEDEAR, bono…",
    empty: "Sin resultados. Probá GGAL, YPF, MERVAL.",
    sections: {
      stocks: "Acciones BYMA",
      cedears: "CEDEARs",
      bonds: "Bonos hard-dollar",
      benchmarks: "Índices",
    },
    goto: "Ir a /ticker/",
  },
  ticker: {
    lastPrice: "Último",
    previousClose: "Cierre anterior",
    open: "Apertura",
    dayRange: "Rango del día",
    volume: "Volumen",
    asOf: "Actualizado",
    source: "Fuente",
    fundamentalsStub: "Fundamentals",
    fundamentalsCopy:
      "Datos fundamentales (P/E, dividendos, ratios) llegan en una fase posterior.",
    fetchErrorTitle: "No se pudo cargar la cotización",
    fetchErrorFallback:
      "El proveedor no respondió. Probá refrescar en unos segundos.",
    notFoundTitle: "Ticker desconocido",
    notFoundCopy:
      "Ese símbolo todavía no está en el catálogo de Phase 1. Vuelve al home y probá uno de los listados.",
  },
  common: {
    backHome: "Volver al inicio",
  },
  acciones: {
    title: "Acciones BYMA",
    subtitle:
      "Panel líder + general. Cotización en ARS, variación intradía y YTD. Datos vía Yahoo.",
    searchPlaceholder: "Buscar ticker o nombre…",
    allSectors: "Todos",
    leadersChip: "Panel líder",
    colSymbol: "Símbolo",
    colName: "Nombre",
    colSector: "Sector",
    colLast: "Último",
    colDayChange: "Δ día",
    colYtdChange: "Δ YTD",
    colVolume: "Volumen",
    colBucket: "Cap",
    bucketLarge: "Líder",
    bucketMid: "Medio",
    bucketSmall: "Chico",
    heatmapTitle: "Heatmap intradía",
    heatmapHint:
      "Tamaño ≈ peso relativo del panel; color ≈ variación del día.",
    empty: "Sin datos.",
    error: "Falló la carga del mercado. Reintento automático en 30s.",
    asOf: "Snapshot:",
  },
  indices: {
    title: "Índices",
    subtitle:
      "Merval y benchmarks asociados. Sparkline = últimos 20 cierres diarios.",
    colSymbol: "Símbolo",
    colName: "Nombre",
    colLast: "Último",
    colDayChange: "Δ día",
    colYtdChange: "Δ YTD",
    colSparkline: "20d",
    colCurrency: "Moneda",
    topConstituents: "Top componentes",
    empty: "Sin datos de índices.",
    asOf: "Snapshot:",
    pointsLabel: "puntos",
  },
  sectors: {
    banks: "Bancos",
    energy: "Energía",
    utilities: "Servicios",
    materials: "Materiales",
    industrials: "Industriales",
    consumer: "Consumo",
    real_estate: "Real estate",
    agro: "Agro",
    telecom: "Telecom",
    holdings: "Holdings",
  },
  launchpadEquities: {
    title: "Acciones",
    cta: "Ver acciones →",
    moversUp: "Top subas",
    moversDown: "Top bajas",
    empty: "Sin movimientos publicados.",
  },
} as const;

export type Messages = typeof messages;

import type { EquitySector, MarketCapBucket } from "@/lib/equities/catalog";

export function sectorLabel(sector: EquitySector): string {
  return messages.sectors[sector];
}

export function bucketLabel(bucket: MarketCapBucket): string {
  switch (bucket) {
    case "large":
      return messages.acciones.bucketLarge;
    case "mid":
      return messages.acciones.bucketMid;
    case "small":
      return messages.acciones.bucketSmall;
  }
}
