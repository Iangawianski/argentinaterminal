import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectorHeatmap } from "@/components/sector-heatmap";
import type { EquitySnapshot } from "@/lib/equities/quotes";

function snap(overrides: Partial<EquitySnapshot>): EquitySnapshot {
  return {
    symbol: "GGAL",
    name: "Grupo Financiero Galicia",
    sector: "banks",
    bucket: "large",
    last: 6450,
    prevClose: 6320,
    dayChange: 130,
    dayChangePct: 0.0206,
    ytdChangePct: 0.29,
    volume: 1_000_000,
    marketCap: null,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("SectorHeatmap", () => {
  it("renders an SVG with one tile per snapshot grouped by sector", () => {
    const snapshots: EquitySnapshot[] = [
      snap({ symbol: "GGAL", sector: "banks", bucket: "large", dayChangePct: 0.03 }),
      snap({ symbol: "BMA", sector: "banks", bucket: "large", dayChangePct: -0.015 }),
      snap({ symbol: "YPFD", sector: "energy", bucket: "large", dayChangePct: 0.018 }),
      snap({ symbol: "PAMP", sector: "energy", bucket: "large", dayChangePct: -0.005 }),
    ];
    const html = renderToStaticMarkup(<SectorHeatmap snapshots={snapshots} />);
    expect(html).toContain("<svg");
    // One tile per ticker.
    for (const s of snapshots) {
      expect(html).toContain(s.symbol);
    }
    // Sector label band shows the sector name (rendered as "Bancos",
    // uppercased visually via CSS).
    expect(html).toContain("Bancos");
    expect(html).toContain("Energía");
  });

  it("falls back to a friendly empty state when there are no snapshots", () => {
    const html = renderToStaticMarkup(<SectorHeatmap snapshots={[]} />);
    expect(html).toContain("Sin datos");
  });

  it("links each tile to /ticker/<symbol> (lowercase)", () => {
    const html = renderToStaticMarkup(
      <SectorHeatmap
        snapshots={[snap({ symbol: "GGAL", dayChangePct: 0.01 })]}
      />,
    );
    expect(html).toContain("/ticker/ggal");
  });

  it("colors positive moves green and negative moves red", () => {
    const html = renderToStaticMarkup(
      <SectorHeatmap
        snapshots={[
          snap({ symbol: "UP", sector: "banks", dayChangePct: 0.04 }),
          snap({ symbol: "DN", sector: "energy", dayChangePct: -0.04 }),
        ]}
      />,
    );
    // Positive hits the green anchor (hue ~142), negative the red (~0).
    expect(html).toMatch(/hsl\(142/);
    expect(html).toMatch(/hsl\(0 /);
  });
});
