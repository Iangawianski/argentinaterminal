import type { IntradayPoint } from "@/lib/quotes/types";

interface IntradaySparkProps {
  points: IntradayPoint[];
  width?: number;
  height?: number;
}

/**
 * Minimal inline-SVG sparkline. Phase 1 ships without a charting library so
 * the dependency surface stays small; lightweight-charts is queued for
 * Fase 4 alongside the dashboard work.
 */
export function IntradaySpark({ points, width = 720, height = 200 }: IntradaySparkProps) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground"
        style={{ width, height }}
      >
        Sin datos intradía disponibles.
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.price - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const last = prices[prices.length - 1] ?? 0;
  const first = prices[0] ?? 0;
  const positive = last >= first;
  const strokeClass = positive ? "stroke-up" : "stroke-down";
  const fillClass = positive ? "fill-up" : "fill-down";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Gráfico intradía"
      preserveAspectRatio="none"
      className="h-48 w-full"
    >
      <path d={`${path} L${width},${height} L0,${height} Z`} className={`${fillClass} opacity-10`} />
      <path d={path} className={`${strokeClass} fill-none`} strokeWidth={1.5} />
    </svg>
  );
}
