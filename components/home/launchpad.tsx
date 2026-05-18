import Link from "next/link";

import { BONDS, buildCashflows } from "@/lib/bonds/cashflows";
import { getDefaultBondProvider } from "@/lib/bonds/composite";
import { computeBondMath } from "@/lib/bonds/math";
import type { BondQuote } from "@/lib/bonds/quote-types";
import type { BondMath } from "@/lib/bonds/types";
import { CEDEARS, computeParity } from "@/lib/cedears";
import { leaderPanel } from "@/lib/equities/catalog";
import {
  getEquitiesSnapshot,
  type EquitySnapshot,
} from "@/lib/equities/quotes";
import { getDefaultFxProvider, type FxQuote } from "@/lib/fx";
import { getDefaultEmbiProvider, type RiesgoPais } from "@/lib/macro/embi";
import { fetchNews, type NewsItem } from "@/lib/news/rss";
import { getDefaultQuoteProvider, type Quote } from "@/lib/quotes";
import { qualifySymbol } from "@/lib/quotes/yahoo";
import { formatNumber, formatPct } from "@/lib/utils";

/**
 * Bloomberg-style launchpad home. Four panels render in parallel from
 * server-side fetches. Each panel degrades to a "sin datos" state on
 * upstream failure so a single broken provider can't black out the home.
 *
 * Cache: 60s revalidate on the page; per-fetch cache TTLs apply on top.
 */

interface BondRow {
  symbol: string;
  name: string;
  quote: BondQuote | null;
  math: BondMath | null;
  error: string | null;
}

interface CedearRow {
  symbol: string;
  name: string;
  quote: Quote | null;
  parity: ReturnType<typeof computeParity> | null;
  error: string | null;
}

const TOP_BONDS = ["AL30", "GD30", "GD35"];
const TOP_CEDEARS = ["AAPL", "MSFT", "TSLA", "GOOGL"];

const TAG_LABEL: Record<NewsItem["tag"], string> = {
  economia: "Economía",
  finanzas: "Finanzas",
  dolar: "Dólar",
  mercados: "Mercados",
  politica: "Política",
};

export async function Launchpad() {
  const [bonds, embi, cedears, fx, news, equities] = await Promise.all([
    loadBonds(),
    loadEmbi(),
    loadCedears(),
    loadFx(),
    loadNews(),
    loadEquities(),
  ]);
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-fg))]">
            ArgentinaTerminal
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Launchpad</h1>
        </div>
        <p className="hidden text-xs text-[hsl(var(--muted-fg))] sm:block">
          Ctrl+K para abrir el palette. Datos refrescados cada minuto.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <BondsPanel bonds={bonds} embi={embi} />
        <FxPanel fx={fx} />
        <CedearsPanel cedears={cedears} />
        <NewsPanel news={news} />
        <EquitiesPanel equities={equities} />
      </div>
    </section>
  );
}

/* ------------------------------ panels ------------------------------ */

function Panel({
  title,
  href,
  hint,
  children,
}: {
  title: string;
  href: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface flex flex-col rounded-lg border">
      <header className="flex items-baseline justify-between border-b px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-fg))]">
          {title}
        </h2>
        <Link
          href={href}
          className="text-[11px] text-[hsl(var(--muted-fg))] hover:underline"
        >
          {hint ?? "Ver todo →"}
        </Link>
      </header>
      <div className="flex-1 px-3 py-2">{children}</div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="px-1 py-3 text-center text-xs text-[hsl(var(--muted-fg))]">{label}</p>
  );
}

function ChangeCell({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[hsl(var(--muted-fg))]">—</span>;
  }
  const color = value >= 0 ? "positive" : "negative";
  return (
    <span style={{ color: `hsl(var(--${color}))` }}>{formatPct(value)}</span>
  );
}

function BondsPanel({
  bonds,
  embi,
}: {
  bonds: BondRow[];
  embi: RiesgoPais | null;
}) {
  return (
    <Panel title="Bonos hard-dollar + Riesgo país" href="/bonos">
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="text-[hsl(var(--muted-fg))]">EMBI+ Argentina</span>
        {embi ? (
          <span className="font-mono">
            <strong className="text-base">{formatNumber(embi.valueBps, 0)}</strong>{" "}
            <span className="text-[10px] uppercase text-[hsl(var(--muted-fg))]">bps</span>
            {embi.changeBps !== null ? (
              <span className="ml-2">
                <ChangeCell value={embi.changeBps} />{" "}
                <span className="text-[10px] text-[hsl(var(--muted-fg))]">d/d</span>
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-[hsl(var(--muted-fg))]">sin datos</span>
        )}
      </div>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-[hsl(var(--muted-fg))]">
          <tr>
            <th className="py-1 text-left">Bono</th>
            <th className="py-1 text-right">Precio</th>
            <th className="py-1 text-right">TIR</th>
            <th className="py-1 text-right">Paridad</th>
            <th className="py-1 text-right">Var.</th>
          </tr>
        </thead>
        <tbody>
          {bonds.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <EmptyRow label="Bonos no disponibles" />
              </td>
            </tr>
          ) : (
            bonds.map((row) => (
              <tr key={row.symbol} className="border-t">
                <td className="py-1.5 font-mono">{row.symbol}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {row.quote ? row.quote.cleanPrice.toFixed(2) : "—"}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {row.math ? `${(row.math.ytm * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {row.math ? `${(row.math.paridad * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  <ChangeCell value={row.quote?.changePct ?? null} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Panel>
  );
}

function FxPanel({ fx }: { fx: FxQuote[] }) {
  return (
    <Panel title="Dólar Argentina" href="/fx">
      {fx.length === 0 ? (
        <EmptyRow label="FX no disponible" />
      ) : (
        <ul className="divide-y text-xs">
          {fx.map((q) => (
            <li
              key={q.key}
              className="flex items-center justify-between py-1.5"
            >
              <span className="font-medium">{q.label}</span>
              <span className="flex items-center gap-3 font-mono tabular-nums">
                <span className="text-[hsl(var(--fg))]">
                  ${formatNumber(q.ask, 2)}
                </span>
                <span className="w-14 text-right">
                  <ChangeCell value={q.changePct} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CedearsPanel({ cedears }: { cedears: CedearRow[] }) {
  return (
    <Panel title="CEDEARs top" href="/" hint="Ver tickers →">
      {cedears.length === 0 ? (
        <EmptyRow label="CEDEARs no disponibles" />
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[hsl(var(--muted-fg))]">
            <tr>
              <th className="py-1 text-left">Ticker</th>
              <th className="py-1 text-right">ARS</th>
              <th className="py-1 text-right">USD impl.</th>
              <th className="py-1 text-right">Var.</th>
            </tr>
          </thead>
          <tbody>
            {cedears.map((row) => (
              <tr key={row.symbol} className="border-t">
                <td className="py-1.5">
                  <Link
                    href={`/ticker/${row.symbol.toLowerCase()}`}
                    className="font-mono hover:underline"
                  >
                    {row.symbol}
                  </Link>
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {row.quote ? formatNumber(row.quote.price, 0) : "—"}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {row.parity ? row.parity.impliedUSD.toFixed(2) : "—"}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  <ChangeCell value={row.quote?.changePct ?? null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function EquitiesPanel({ equities }: { equities: EquitySnapshot[] }) {
  const withChange = equities.filter((s) => s.dayChangePct !== null);
  const sortedDesc = withChange
    .slice()
    .sort((a, b) => (b.dayChangePct ?? 0) - (a.dayChangePct ?? 0));
  const up = sortedDesc.slice(0, 3).filter((s) => (s.dayChangePct ?? 0) > 0);
  const down = sortedDesc
    .slice(-3)
    .reverse()
    .filter((s) => (s.dayChangePct ?? 0) < 0);
  return (
    <Panel title="Acciones · top movers" href="/acciones">
      {up.length === 0 && down.length === 0 ? (
        <EmptyRow label="Acciones sin movimientos publicados" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MoversList title="Subas" items={up} tone="positive" />
          <MoversList title="Bajas" items={down} tone="negative" />
        </div>
      )}
    </Panel>
  );
}

function MoversList({
  title,
  items,
  tone,
}: {
  title: string;
  items: EquitySnapshot[];
  tone: "positive" | "negative";
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-fg))]">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-fg))]">—</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((s) => (
            <li key={s.symbol} className="flex items-baseline justify-between gap-2">
              <Link
                href={`/ticker/${s.symbol.toLowerCase()}`}
                className="font-mono hover:underline"
              >
                {s.symbol}
              </Link>
              <span
                className="font-mono tabular-nums"
                style={{ color: `hsl(var(--${tone}))` }}
              >
                {s.dayChangePct !== null
                  ? formatPct((s.dayChangePct ?? 0) * 100)
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewsPanel({ news }: { news: NewsItem[] }) {
  return (
    <Panel title="Últimas noticias" href="/noticias">
      {news.length === 0 ? (
        <EmptyRow label="Sin noticias" />
      ) : (
        <ul className="divide-y text-xs">
          {news.map((item) => (
            <li key={item.url} className="py-1.5">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="block leading-snug hover:underline"
              >
                {item.title}
              </a>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[hsl(var(--muted-fg))]">
                <span>{item.source.label}</span>
                <span aria-hidden>·</span>
                <span>{formatRelative(item.publishedAt)}</span>
                <span aria-hidden>·</span>
                <span className="rounded-sm border px-1 py-px uppercase tracking-wider">
                  {TAG_LABEL[item.tag]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------ loaders ------------------------------ */

async function loadBonds(): Promise<BondRow[]> {
  const provider = getDefaultBondProvider();
  const today = new Date().toISOString().slice(0, 10);
  const targets = BONDS.filter((b) => TOP_BONDS.includes(b.symbol));
  return Promise.all(
    targets.map(async (bond) => {
      try {
        const quote = await provider.getQuote(bond.symbol);
        const math = computeBondMath({
          bond,
          cleanPrice: quote.cleanPrice,
          settlementIso: today,
          cashflows: buildCashflows(bond),
        });
        return { symbol: bond.symbol, name: bond.name, quote, math, error: null };
      } catch (err) {
        return {
          symbol: bond.symbol,
          name: bond.name,
          quote: null,
          math: null,
          error: err instanceof Error ? err.message : "error",
        };
      }
    }),
  );
}

async function loadEmbi(): Promise<RiesgoPais | null> {
  try {
    return await getDefaultEmbiProvider().getRiesgoPais();
  } catch {
    return null;
  }
}

async function loadFx(): Promise<FxQuote[]> {
  try {
    return await getDefaultFxProvider().getAll();
  } catch {
    return [];
  }
}

async function loadCedears(): Promise<CedearRow[]> {
  const quoteProvider = getDefaultQuoteProvider();
  const fxProvider = getDefaultFxProvider();
  const targets = CEDEARS.filter((c) => TOP_CEDEARS.includes(c.symbol));
  // CCL is the canonical FX for CEDEAR parity. We only need it once.
  const ccl = await fxProvider
    .get("ccl")
    .then((q) => q.ask)
    .catch(() => null);
  return Promise.all(
    targets.map(async (cedear) => {
      try {
        const [arsQuote, usdQuote] = await Promise.all([
          quoteProvider.getQuote(qualifySymbol(cedear.symbol, "BA")),
          quoteProvider.getQuote(cedear.underlying),
        ]);
        const parity =
          ccl !== null
            ? computeParity({
                priceARS: arsQuote.price,
                priceUSD: usdQuote.price,
                fx: ccl,
                ratio: cedear.ratio,
              })
            : null;
        return {
          symbol: cedear.symbol,
          name: cedear.name,
          quote: arsQuote,
          parity,
          error: null,
        };
      } catch (err) {
        return {
          symbol: cedear.symbol,
          name: cedear.name,
          quote: null,
          parity: null,
          error: err instanceof Error ? err.message : "error",
        };
      }
    }),
  );
}

async function loadNews(): Promise<NewsItem[]> {
  try {
    const { items } = await fetchNews({ limit: 5 });
    return items;
  } catch {
    return [];
  }
}

async function loadEquities(): Promise<EquitySnapshot[]> {
  // Only the Merval leader panel — the home is a snapshot, not the full
  // /acciones board. Wider universe stays behind a click.
  const leaders = leaderPanel().map((e) => e.symbol);
  try {
    return await getEquitiesSnapshot(leaders);
  } catch {
    return [];
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "sin fecha";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "sin fecha";
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDay = Math.round(diffHr / 24);
  return `hace ${diffDay} día${diffDay === 1 ? "" : "s"}`;
}
