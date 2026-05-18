import type { BcraPoint } from "@/lib/macro/bcra";

interface InflationChartProps {
  /** IPC mes/mes (`ipcMensual`) — published with anchor date = first of month. */
  monthly: BcraPoint[];
  /** IPC interanual (`ipcInteranual`) — same anchor. */
  yearly: BcraPoint[];
  width?: number;
  height?: number;
}

interface JoinedRow {
  date: string;
  monthly: number | null;
  yearly: number | null;
}

/**
 * Inflation chart: monthly IPC as bars, interanual IPC as a line, on a
 * shared time axis. Pure server-rendered SVG, no client JS, no chart lib.
 *
 * Layout: bars sit on the bottom band of the y-axis with their own scale
 * (typically 0–25%); the YoY line uses the right axis (typically 0–300% in
 * Argentine context). Both axes start at zero so the visual is honest.
 */
export function InflationChart({
  monthly,
  yearly,
  width = 720,
  height = 260,
}: InflationChartProps) {
  const joined = joinByMonth(monthly, yearly);
  if (joined.length < 2) {
    return (
      <div className="rounded-md border p-6 text-sm text-[hsl(var(--muted-fg))]">
        Sin datos de inflación disponibles.
      </div>
    );
  }

  const padding = { top: 16, right: 56, bottom: 28, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const monthlyValues = joined.map((d) => d.monthly).filter((v): v is number => v !== null);
  const yearlyValues = joined.map((d) => d.yearly).filter((v): v is number => v !== null);
  const monthlyMax = Math.max(...monthlyValues, 5);
  const yearlyMax = Math.max(...yearlyValues, 50);
  const monthlyTop = niceTop(monthlyMax);
  const yearlyTop = niceTop(yearlyMax);

  const n = joined.length;
  const barWidth = Math.max(2, plotW / n - 1);
  const xFor = (i: number) => padding.left + (i / Math.max(1, n - 1)) * plotW;
  const yForMonthly = (v: number) => padding.top + plotH - (v / monthlyTop) * plotH;
  const yForYearly = (v: number) => padding.top + plotH - (v / yearlyTop) * plotH;

  const linePath = joined
    .map((d, i) => {
      if (d.yearly === null) return null;
      const x = xFor(i);
      const y = yForYearly(d.yearly);
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter((s): s is string => s !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p}`)
    .join(" ");

  // Grid lines: 4 ticks across the monthly axis.
  const gridLines = [0.25, 0.5, 0.75, 1].map((frac) => ({
    y: padding.top + plotH - frac * plotH,
    monthlyLabel: `${(monthlyTop * frac).toFixed(0)}%`,
    yearlyLabel: `${(yearlyTop * frac).toFixed(0)}%`,
  }));

  // Last data point labels (used as the "current" reading next to chart).
  const last = joined[joined.length - 1]!;
  const xLabels = pickXTicks(joined, 5);

  return (
    <figure className="rounded-md border bg-[hsl(var(--surface))]">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2 text-xs text-[hsl(var(--muted-fg))]">
        <span>
          IPC — barras = variación mensual · línea = interanual
        </span>
        <span className="font-mono">
          Últ. {last.date.slice(0, 7)}:{" "}
          <span className="text-[hsl(var(--fg))]">
            m/m {last.monthly !== null ? `${last.monthly.toFixed(1)}%` : "—"}
          </span>
          {" · "}
          <span className="text-[hsl(var(--fg))]">
            YoY {last.yearly !== null ? `${last.yearly.toFixed(1)}%` : "—"}
          </span>
        </span>
      </figcaption>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Inflación mensual e interanual de Argentina (IPC)"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid */}
        {gridLines.map((g, idx) => (
          <g key={idx}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={g.y}
              y2={g.y}
              stroke="hsl(var(--border))"
              strokeDasharray="2 3"
              strokeWidth={0.5}
            />
            <text
              x={padding.left - 6}
              y={g.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-[hsl(var(--muted-fg))]"
              fontSize={9}
            >
              {g.monthlyLabel}
            </text>
            <text
              x={width - padding.right + 6}
              y={g.y}
              textAnchor="start"
              dominantBaseline="middle"
              className="fill-[hsl(var(--muted-fg))]"
              fontSize={9}
            >
              {g.yearlyLabel}
            </text>
          </g>
        ))}

        {/* Bars (monthly) */}
        {joined.map((d, i) => {
          if (d.monthly === null) return null;
          const x = xFor(i) - barWidth / 2;
          const y = yForMonthly(d.monthly);
          const h = padding.top + plotH - y;
          return (
            <rect
              key={`bar-${d.date}`}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(0.5, h)}
              fill="hsl(var(--positive))"
              opacity={0.55}
            />
          );
        })}

        {/* Line (YoY) */}
        {linePath !== "" ? (
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth={1.5}
          />
        ) : null}

        {/* X axis ticks */}
        {xLabels.map((tick) => (
          <text
            key={tick.date}
            x={xFor(tick.index)}
            y={height - padding.bottom + 14}
            textAnchor="middle"
            className="fill-[hsl(var(--muted-fg))]"
            fontSize={9}
          >
            {tick.label}
          </text>
        ))}

        {/* Axes baseline */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotH}
          y2={padding.top + plotH}
          stroke="hsl(var(--border))"
          strokeWidth={0.75}
        />
      </svg>
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-[11px] text-[hsl(var(--muted-fg))]">
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block h-2.5 w-3"
            style={{ background: "hsl(var(--positive))", opacity: 0.55 }}
          />
          m/m (eje izq.)
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block h-[2px] w-4"
            style={{ background: "hsl(var(--accent))" }}
          />
          YoY (eje der.)
        </span>
        <span className="ml-auto">{joined.length} observaciones · INDEC vía BCRA</span>
      </div>
    </figure>
  );
}

function joinByMonth(monthly: BcraPoint[], yearly: BcraPoint[]): JoinedRow[] {
  const monthKey = (d: string) => d.slice(0, 7);
  const byMonth = new Map<string, JoinedRow>();
  for (const p of monthly) {
    const k = monthKey(p.date);
    byMonth.set(k, { date: p.date, monthly: p.value, yearly: null });
  }
  for (const p of yearly) {
    const k = monthKey(p.date);
    const existing = byMonth.get(k);
    if (existing) {
      existing.yearly = p.value;
    } else {
      byMonth.set(k, { date: p.date, monthly: null, yearly: p.value });
    }
  }
  return [...byMonth.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function niceTop(max: number): number {
  if (max <= 5) return 5;
  if (max <= 10) return 10;
  if (max <= 25) return 25;
  if (max <= 50) return 50;
  if (max <= 100) return 100;
  if (max <= 200) return 200;
  if (max <= 300) return 300;
  return Math.ceil(max / 100) * 100;
}

function pickXTicks(
  rows: JoinedRow[],
  count: number,
): Array<{ index: number; date: string; label: string }> {
  if (rows.length === 0) return [];
  const out: Array<{ index: number; date: string; label: string }> = [];
  const step = Math.max(1, Math.floor((rows.length - 1) / (count - 1)));
  for (let i = 0; i < rows.length; i += step) {
    const row = rows[i]!;
    out.push({ index: i, date: row.date, label: row.date.slice(0, 7) });
  }
  // Always include the last row.
  const last = rows[rows.length - 1]!;
  if (out[out.length - 1]?.index !== rows.length - 1) {
    out.push({ index: rows.length - 1, date: last.date, label: last.date.slice(0, 7) });
  }
  return out;
}
