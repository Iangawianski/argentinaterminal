import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InflationChart } from "./inflation-chart";

const monthly = [
  { date: "2025-06-01", value: 3.1 },
  { date: "2025-07-01", value: 2.9 },
  { date: "2025-08-01", value: 2.4 },
  { date: "2025-09-01", value: 2.0 },
  { date: "2025-10-01", value: 1.8 },
];

const yearly = [
  { date: "2025-06-01", value: 240 },
  { date: "2025-07-01", value: 195 },
  { date: "2025-08-01", value: 165 },
  { date: "2025-09-01", value: 140 },
  { date: "2025-10-01", value: 120 },
];

describe("InflationChart", () => {
  it("renders the SVG with at least one bar and the YoY line", () => {
    const html = renderToStaticMarkup(
      <InflationChart monthly={monthly} yearly={yearly} />,
    );
    expect(html).toContain("<svg");
    // 5 monthly observations → 5 bars.
    const bars = html.match(/<rect /g) ?? [];
    expect(bars.length).toBe(5);
    // YoY line path should be present.
    expect(html).toMatch(/<path [^>]*d="M /);
    // Caption shows latest reading.
    expect(html).toContain("m/m 1.8%");
    expect(html).toContain("YoY 120.0%");
  });

  it("renders a fallback message when there is no data", () => {
    const html = renderToStaticMarkup(<InflationChart monthly={[]} yearly={[]} />);
    expect(html).toContain("Sin datos de inflación disponibles");
  });

  it("joins by month so a sparse yearly series still produces points", () => {
    const html = renderToStaticMarkup(
      <InflationChart
        monthly={monthly}
        yearly={[{ date: "2025-10-01", value: 120 }]}
      />,
    );
    expect(html).toContain("<svg");
    // Caption should still show latest reading.
    expect(html).toContain("YoY 120.0%");
  });
});
