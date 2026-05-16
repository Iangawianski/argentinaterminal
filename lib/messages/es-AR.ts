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
} as const;

export type Messages = typeof messages;
