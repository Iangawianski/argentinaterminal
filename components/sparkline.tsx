interface SparklineProps {
  points: ReadonlyArray<number>;
  width?: number;
  height?: number;
  ariaLabel?: string;
}

/**
 * Numeric sparkline used by /indices. Mirrors the visual contract of
 * <MacroSparkline /> but accepts a flat number[] instead of {date,value}
 * pairs, since equity index history comes from Yahoo as a closes array.
 *
 * Server-renderable, no client JS, no chart dep (<50KB gz rule).
 */
export function Sparkline({
  points,
  width = 120,
  height = 32,
  ariaLabel,
}: SparklineProps) {
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
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const positive = last >= first;
  const stroke = positive ? "hsl(var(--positive))" : "hsl(var(--negative))";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `Sparkline ${points.length} cierres`}
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
