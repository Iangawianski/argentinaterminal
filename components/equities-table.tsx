"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EquitySnapshot } from "@/lib/equities/quotes";
import {
  EQUITY_SECTORS,
  type EquitySector,
} from "@/lib/equities/catalog";
import { bucketLabel, messages, sectorLabel } from "@/lib/messages/es-AR";
import { formatArs, formatNumber, formatPct } from "@/lib/format";

type SortKey =
  | "symbol"
  | "name"
  | "sector"
  | "last"
  | "dayChangePct"
  | "ytdChangePct"
  | "volume";

type SortDir = "asc" | "desc";

type Props = {
  snapshots: ReadonlyArray<EquitySnapshot>;
};

export function EquitiesTable({ snapshots }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("dayChangePct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [activeSector, setActiveSector] = useState<EquitySector | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return snapshots.filter((s) => {
      if (activeSector !== "all" && s.sector !== activeSector) return false;
      if (q === "") return true;
      return (
        s.symbol.includes(q) ||
        s.name.toUpperCase().includes(q) ||
        (s.adr ?? "").includes(q)
      );
    });
  }, [snapshots, query, activeSector]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => compare(a, b, sortKey) * (sortDir === "asc" ? 1 : -1));
    return arr;
  }, [filtered, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "symbol" || k === "name" || k === "sector" ? "asc" : "desc");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={messages.acciones.searchPlaceholder}
          className="w-full max-w-xs rounded-md border bg-transparent px-2 py-1 text-sm placeholder:text-[hsl(var(--muted-fg))]"
          aria-label={messages.acciones.searchPlaceholder}
        />
        <div className="flex flex-wrap gap-1.5">
          <SectorChip
            label={messages.acciones.allSectors}
            active={activeSector === "all"}
            onClick={() => setActiveSector("all")}
          />
          {EQUITY_SECTORS.map((sec) => (
            <SectorChip
              key={sec}
              label={sectorLabel(sec)}
              active={activeSector === sec}
              onClick={() => setActiveSector(sec)}
            />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-sm font-mono">
          <thead className="bg-[hsl(var(--muted))] text-xs uppercase tracking-wide text-[hsl(var(--muted-fg))]">
            <tr>
              <Th onClick={() => onSort("symbol")} active={sortKey === "symbol"} dir={sortDir} align="left">
                {messages.acciones.colSymbol}
              </Th>
              <Th onClick={() => onSort("name")} active={sortKey === "name"} dir={sortDir} align="left">
                {messages.acciones.colName}
              </Th>
              <Th onClick={() => onSort("sector")} active={sortKey === "sector"} dir={sortDir} align="left">
                {messages.acciones.colSector}
              </Th>
              <Th onClick={() => onSort("last")} active={sortKey === "last"} dir={sortDir} align="right">
                {messages.acciones.colLast}
              </Th>
              <Th onClick={() => onSort("dayChangePct")} active={sortKey === "dayChangePct"} dir={sortDir} align="right">
                {messages.acciones.colDayChange}
              </Th>
              <Th onClick={() => onSort("ytdChangePct")} active={sortKey === "ytdChangePct"} dir={sortDir} align="right">
                {messages.acciones.colYtdChange}
              </Th>
              <Th onClick={() => onSort("volume")} active={sortKey === "volume"} dir={sortDir} align="right">
                {messages.acciones.colVolume}
              </Th>
              <th className="px-2 py-1.5 text-right">{messages.acciones.colBucket}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-2 py-6 text-center text-[hsl(var(--muted-fg))]"
                >
                  {messages.acciones.empty}
                </td>
              </tr>
            )}
            {sorted.map((s) => (
              <Row key={s.symbol} snapshot={s} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[hsl(var(--muted-fg))]">
        {sorted.length} / {snapshots.length}
      </p>
    </div>
  );
}

function SectorChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors " +
        (active
          ? "bg-[hsl(var(--fg))] text-[hsl(var(--background))]"
          : "text-[hsl(var(--muted-fg))] hover:surface")
      }
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  align,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
  align: "left" | "right";
}) {
  return (
    <th className={`px-2 py-1.5 text-${align}`}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-1 uppercase"
        style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}
      >
        <span>{children}</span>
        {active && (
          <span aria-hidden className="text-[10px]">
            {dir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </button>
    </th>
  );
}

function Row({ snapshot }: { snapshot: EquitySnapshot }) {
  const pos = (snapshot.dayChangePct ?? 0) >= 0;
  return (
    <tr className="border-t hover:bg-[hsl(var(--muted))]">
      <td className="px-2 py-1">
        <Link
          href={`/ticker/${snapshot.symbol.toLowerCase()}`}
          className="font-semibold hover:underline"
        >
          {snapshot.symbol}
        </Link>
      </td>
      <td className="px-2 py-1 text-[hsl(var(--muted-fg))]">{snapshot.name}</td>
      <td className="px-2 py-1 text-[hsl(var(--muted-fg))]">
        {sectorLabel(snapshot.sector)}
      </td>
      <td className="px-2 py-1 text-right">
        {snapshot.last !== null ? formatArs(snapshot.last) : "—"}
      </td>
      <td
        className="px-2 py-1 text-right"
        style={{
          color:
            snapshot.dayChangePct !== null
              ? `hsl(var(--${pos ? "positive" : "negative"}))`
              : undefined,
        }}
      >
        {snapshot.dayChangePct !== null ? formatPct(snapshot.dayChangePct) : "—"}
      </td>
      <td
        className="px-2 py-1 text-right"
        style={{
          color:
            snapshot.ytdChangePct !== null
              ? `hsl(var(--${(snapshot.ytdChangePct ?? 0) >= 0 ? "positive" : "negative"}))`
              : undefined,
        }}
      >
        {snapshot.ytdChangePct !== null ? formatPct(snapshot.ytdChangePct) : "—"}
      </td>
      <td className="px-2 py-1 text-right text-[hsl(var(--muted-fg))]">
        {snapshot.volume !== null ? formatNumber(snapshot.volume) : "—"}
      </td>
      <td className="px-2 py-1 text-right text-[10px] uppercase text-[hsl(var(--muted-fg))]">
        {bucketLabel(snapshot.bucket)}
      </td>
    </tr>
  );
}

function compare(a: EquitySnapshot, b: EquitySnapshot, key: SortKey): number {
  switch (key) {
    case "symbol":
      return a.symbol.localeCompare(b.symbol);
    case "name":
      return a.name.localeCompare(b.name);
    case "sector":
      return a.sector.localeCompare(b.sector);
    case "last":
      return num(a.last) - num(b.last);
    case "dayChangePct":
      return num(a.dayChangePct) - num(b.dayChangePct);
    case "ytdChangePct":
      return num(a.ytdChangePct) - num(b.ytdChangePct);
    case "volume":
      return num(a.volume) - num(b.volume);
  }
}

function num(v: number | null): number {
  return v ?? Number.NEGATIVE_INFINITY;
}
