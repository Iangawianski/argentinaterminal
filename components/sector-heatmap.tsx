import Link from "next/link";
import {
  EQUITY_SECTORS,
  bucketWeight,
  type EquitySector,
} from "@/lib/equities/catalog";
import type { EquitySnapshot } from "@/lib/equities/quotes";
import { sectorLabel } from "@/lib/messages/es-AR";
import { formatPct } from "@/lib/format";

type Props = {
  snapshots: ReadonlyArray<EquitySnapshot>;
  width?: number;
  height?: number;
  // Suppress the sector label band when embedded as a tight panel.
  compact?: boolean;
};

// Sector-grouped treemap, hand-rolled in SVG. Layout:
//
//   1. Group tiles by sector.
//   2. Allocate each sector a horizontal *row* whose height is proportional
//      to the sum of its tiles' bucket weights. Empty sectors are dropped.
//   3. Within each row, tiles span widths proportional to their bucket
//      weight (large=4, mid=2, small=1).
//
// Each tile is colored by intraday % move on a green→red diverging scale,
// clamped to ±4% to keep faint moves visible. The whole thing is rendered
// from a server component — no client JS, no chart libs (<50KB gz rule).
export function SectorHeatmap({
  snapshots,
  width = 720,
  height = 420,
  compact = false,
}: Props) {
  const rows = layout(snapshots, width, height, compact);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-sm text-[hsl(var(--muted-fg))]">
        Sin datos de mercado para el heatmap.
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label="Heatmap sectorial intradía"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="block w-full"
    >
      {rows.map((row) => (
        <g key={row.sector}>
          {!compact && (
            <text
              x={row.x + 4}
              y={row.y + 12}
              fontSize="10"
              fill="hsl(var(--muted-fg))"
              fontFamily="ui-monospace, monospace"
              style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              {sectorLabel(row.sector)}
            </text>
          )}
          {row.tiles.map((tile) => (
            <Tile key={tile.symbol} {...tile} />
          ))}
        </g>
      ))}
    </svg>
  );
}

type Tile = {
  symbol: string;
  sector: EquitySector;
  x: number;
  y: number;
  w: number;
  h: number;
  changePct: number | null;
};

type Row = {
  sector: EquitySector;
  x: number;
  y: number;
  width: number;
  height: number;
  tiles: Tile[];
};

function layout(
  snapshots: ReadonlyArray<EquitySnapshot>,
  width: number,
  height: number,
  compact: boolean,
): Row[] {
  const grouped = new Map<EquitySector, EquitySnapshot[]>();
  for (const s of snapshots) {
    const arr = grouped.get(s.sector) ?? [];
    arr.push(s);
    grouped.set(s.sector, arr);
  }

  // Drop sectors with no data, preserve canonical sector order.
  const sectors = EQUITY_SECTORS.filter(
    (sec) => (grouped.get(sec)?.length ?? 0) > 0,
  );
  const sectorWeights = sectors.map((sec) =>
    (grouped.get(sec) ?? []).reduce(
      (acc, s) => acc + bucketWeight(s.bucket),
      0,
    ),
  );
  const totalWeight = sectorWeights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return [];

  const headerBand = compact ? 0 : 14; // reserved for the sector label

  const rows: Row[] = [];
  let y = 0;
  for (let i = 0; i < sectors.length; i++) {
    const sec = sectors[i]!;
    const weight = sectorWeights[i]!;
    const rowHeight = Math.round((weight / totalWeight) * height);
    const tilesInRow = (grouped.get(sec) ?? [])
      .slice()
      .sort((a, b) => bucketWeight(b.bucket) - bucketWeight(a.bucket));
    const innerWeight = tilesInRow.reduce(
      (acc, s) => acc + bucketWeight(s.bucket),
      0,
    );
    const tileY = y + headerBand;
    const tileH = Math.max(0, rowHeight - headerBand);
    let x = 0;
    const tiles: Tile[] = [];
    for (let j = 0; j < tilesInRow.length; j++) {
      const t = tilesInRow[j]!;
      const w = j === tilesInRow.length - 1
        ? width - x
        : Math.round((bucketWeight(t.bucket) / innerWeight) * width);
      tiles.push({
        symbol: t.symbol,
        sector: t.sector,
        x,
        y: tileY,
        w,
        h: tileH,
        changePct: t.dayChangePct,
      });
      x += w;
    }
    rows.push({ sector: sec, x: 0, y, width, height: rowHeight, tiles });
    y += rowHeight;
  }
  return rows;
}

function Tile(props: Tile) {
  const fill = colorFor(props.changePct);
  const label = props.symbol;
  const showLabel = props.w >= 36 && props.h >= 22;
  const showPct = props.w >= 56 && props.h >= 34 && props.changePct !== null;
  return (
    <Link href={`/ticker/${props.symbol.toLowerCase()}`}>
      <g>
        <rect
          x={props.x}
          y={props.y}
          width={Math.max(0, props.w - 1)}
          height={Math.max(0, props.h - 1)}
          fill={fill}
          stroke="hsl(var(--background))"
          strokeWidth="1"
        />
        {showLabel && (
          <text
            x={props.x + 4}
            y={props.y + 14}
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill="hsl(0 0% 100%)"
            style={{ pointerEvents: "none" }}
          >
            {label}
          </text>
        )}
        {showPct && (
          <text
            x={props.x + 4}
            y={props.y + 28}
            fontSize="10"
            fontFamily="ui-monospace, monospace"
            fill="hsl(0 0% 100% / 0.85)"
            style={{ pointerEvents: "none" }}
          >
            {formatPct(props.changePct ?? 0)}
          </text>
        )}
      </g>
    </Link>
  );
}

// Diverging green→red palette. Clamps at ±4% so most of the dynamic
// range covers a typical Argentine session (which routinely runs 1–3%).
// Neutral grey when the snapshot has no price.
function colorFor(changePct: number | null): string {
  if (changePct === null || !Number.isFinite(changePct)) {
    return "hsl(0 0% 35%)";
  }
  const clamped = Math.max(-0.04, Math.min(0.04, changePct));
  const intensity = Math.abs(clamped) / 0.04; // 0..1
  // Hand-picked anchors: positive green hsl(142 70% 32%), negative red
  // hsl(0 70% 38%). Both lift toward muted neutral hsl(220 5% 28%) at 0.
  const neutral: [number, number, number] = [220, 5, 28];
  const target: [number, number, number] = clamped >= 0
    ? [142, 70, 32]
    : [0, 70, 38];
  const h = lerp(neutral[0], target[0], intensity);
  const s = lerp(neutral[1], target[1], intensity);
  const l = lerp(neutral[2], target[2], intensity);
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
