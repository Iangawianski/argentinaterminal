interface MacroSparklineProps {
  points: Array<{ date: string; value: number }>;
  width?: number;
  height?: number;
  ariaLabel?: string;
}

/**
 * Tiny inline SVG sparkline. Server-renderable, no client JS, no dep.
 *
 * Renders a polyline normalised to the [min,max] band of the supplied
 * points. Used by the macro board to give visual context to each variable
 * without dragging in a chart library. If `points.length < 2` we render the
 * empty band so the row layout stays stable.
 */
export function MacroSparkline({
  points,
  width = 120,
  height = 32,
  ariaLabel,
}: MacroSparklineProps) {
  if (points.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? "Sin datos"}
      >
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="hsl(var(--muted-fg))"
          strokeDasharray="2 2"
          strokeWidth={1}
        />
      </svg>
    );
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p.value - min) / range) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const lastValue = values[values.length - 1]!;
  const firstValue = values[0]!;
  const positive = lastValue >= firstValue;
  const stroke = positive ? "hsl(var(--positive))" : "hsl(var(--negative))";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `Sparkline ${points.length} obs`}
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} />
    </svg>
  );
}
