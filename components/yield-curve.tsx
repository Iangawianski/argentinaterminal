"use client";

/**
 * Hand-rolled SVG scatter — no charting dep. One point per bond,
 * X = modified duration (years), Y = TIR (%).
 *
 * Static, server-friendly, accessible (labels are inline `<text>` so screen
 * readers and the cmdk find them). Tooltips on hover via native `<title>`.
 */
export interface YieldCurvePoint {
  symbol: string;
  modifiedDuration: number;
  ytmPct: number;
  /** Optional governing-law tag — colors the marker. */
  law?: "AR" | "NY";
}

interface YieldCurveProps {
  points: YieldCurvePoint[];
  /** Pixel dimensions of the SVG viewport. */
  width?: number;
  height?: number;
}

const PAD = { top: 16, right: 16, bottom: 32, left: 36 };

export function YieldCurve({ points, width = 640, height = 280 }: YieldCurveProps) {
  const usable = points.filter(
    (p) => Number.isFinite(p.modifiedDuration) && Number.isFinite(p.ytmPct)
  );
  if (usable.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border border-border bg-muted/10 text-sm text-muted-foreground">
        Sin datos suficientes para la curva soberana.
      </div>
    );
  }
  const xs = usable.map((p) => p.modifiedDuration);
  const ys = usable.map((p) => p.ytmPct);
  // Round the axis bounds to friendly steps so the gridlines look intentional.
  const xMin = 0;
  const xMax = niceCeil(Math.max(...xs, 1));
  const yMin = Math.max(0, niceFloor(Math.min(...ys)));
  const yMax = niceCeil(Math.max(...ys, yMin + 5));

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const px = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin)) * innerW;
  const py = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const xTicks = ticks(xMin, xMax, 5);
  const yTicks = ticks(yMin, yMax, 5);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Curva soberana hard-dollar: TIR vs. duration modificada"
      className="h-auto w-full"
    >
      {/* Grid */}
      {xTicks.map((tx) => (
        <line
          key={`gx-${tx}`}
          x1={px(tx)}
          x2={px(tx)}
          y1={PAD.top}
          y2={height - PAD.bottom}
          stroke="currentColor"
          strokeOpacity={0.08}
        />
      ))}
      {yTicks.map((ty) => (
        <line
          key={`gy-${ty}`}
          x1={PAD.left}
          x2={width - PAD.right}
          y1={py(ty)}
          y2={py(ty)}
          stroke="currentColor"
          strokeOpacity={0.08}
        />
      ))}
      {/* Axes */}
      <line
        x1={PAD.left}
        x2={width - PAD.right}
        y1={height - PAD.bottom}
        y2={height - PAD.bottom}
        stroke="currentColor"
        strokeOpacity={0.4}
      />
      <line
        x1={PAD.left}
        x2={PAD.left}
        y1={PAD.top}
        y2={height - PAD.bottom}
        stroke="currentColor"
        strokeOpacity={0.4}
      />
      {/* X labels */}
      {xTicks.map((tx) => (
        <text
          key={`xl-${tx}`}
          x={px(tx)}
          y={height - PAD.bottom + 14}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          opacity={0.6}
        >
          {tx.toFixed(1)}
        </text>
      ))}
      {/* Y labels */}
      {yTicks.map((ty) => (
        <text
          key={`yl-${ty}`}
          x={PAD.left - 6}
          y={py(ty) + 3}
          textAnchor="end"
          fontSize={10}
          fill="currentColor"
          opacity={0.6}
        >
          {ty.toFixed(0)}%
        </text>
      ))}
      {/* Axis titles */}
      <text
        x={width / 2}
        y={height - 4}
        textAnchor="middle"
        fontSize={10}
        fill="currentColor"
        opacity={0.6}
      >
        Duration modificada (años)
      </text>
      <text
        x={12}
        y={PAD.top + innerH / 2}
        textAnchor="middle"
        fontSize={10}
        fill="currentColor"
        opacity={0.6}
        transform={`rotate(-90 12 ${PAD.top + innerH / 2})`}
      >
        TIR (%)
      </text>
      {/* Connecting line (sort by duration) */}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1.5}
        points={[...usable]
          .sort((a, b) => a.modifiedDuration - b.modifiedDuration)
          .map((p) => `${px(p.modifiedDuration)},${py(p.ytmPct)}`)
          .join(" ")}
      />
      {/* Points */}
      {usable.map((p) => (
        <g key={p.symbol}>
          <title>{`${p.symbol} · TIR ${p.ytmPct.toFixed(2)}% · MD ${p.modifiedDuration.toFixed(2)}y`}</title>
          <circle
            cx={px(p.modifiedDuration)}
            cy={py(p.ytmPct)}
            r={5}
            // Tailwind tokens aren't accessible in SVG fills directly; use
            // currentColor for the law=NY default, and a `text-accent` group
            // for law=AR (set via the wrapping `g` color).
            fill={p.law === "AR" ? "var(--accent)" : "currentColor"}
            stroke="var(--background)"
            strokeWidth={1.5}
          />
          <text
            x={px(p.modifiedDuration) + 8}
            y={py(p.ytmPct) - 6}
            fontSize={10}
            fontFamily="ui-monospace, monospace"
            fill="currentColor"
            opacity={0.9}
          >
            {p.symbol}
          </text>
        </g>
      ))}
    </svg>
  );
}

function niceCeil(v: number): number {
  if (v <= 1) return Math.ceil(v * 10) / 10;
  if (v <= 10) return Math.ceil(v);
  return Math.ceil(v / 5) * 5;
}

function niceFloor(v: number): number {
  if (v <= 1) return Math.floor(v * 10) / 10;
  if (v <= 10) return Math.floor(v);
  return Math.floor(v / 5) * 5;
}

function ticks(min: number, max: number, count: number): number[] {
  const step = (max - min) / count;
  const out: number[] = [];
  for (let i = 0; i <= count; i += 1) out.push(min + step * i);
  return out;
}
