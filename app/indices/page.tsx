import Link from "next/link";
import { messages } from "@/lib/messages/es-AR";
import { getAllIndices, type IndexSnapshot } from "@/lib/equities/indices";
import { Sparkline } from "@/components/sparkline";
import { formatNumber, formatPct, formatTimestamp } from "@/lib/format";

export const revalidate = 30;

export default async function IndicesPage() {
  const snapshots = await getAllIndices();
  const fetchedAt = Math.max(...snapshots.map((s) => s.timestamp), 0);

  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {messages.indices.title}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-fg))]">
            {messages.indices.subtitle}
          </p>
        </div>
        {fetchedAt > 0 && (
          <p className="font-mono text-xs text-[hsl(var(--muted-fg))]">
            {messages.indices.asOf} {formatTimestamp(fetchedAt)}
          </p>
        )}
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {snapshots.map((s) => (
          <IndexCard key={s.symbol} snapshot={s} />
        ))}
      </div>

      {snapshots.length === 0 && (
        <p className="mt-6 text-sm text-[hsl(var(--muted-fg))]">
          {messages.indices.empty}
        </p>
      )}
    </section>
  );
}

function IndexCard({ snapshot }: { snapshot: IndexSnapshot }) {
  const dayPos = (snapshot.dayChangePct ?? 0) >= 0;
  const ytdPos = (snapshot.ytdChangePct ?? 0) >= 0;
  return (
    <div className="surface rounded-xl border p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-mono text-lg font-semibold">{snapshot.name}</h2>
          <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-fg))]">
            {snapshot.symbol} · {snapshot.currency}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl">
            {snapshot.last !== null
              ? formatNumber(snapshot.last, "precise")
              : "—"}
          </div>
          <div
            className="font-mono text-xs"
            style={{
              color:
                snapshot.dayChangePct !== null
                  ? `hsl(var(--${dayPos ? "positive" : "negative"}))`
                  : undefined,
            }}
          >
            {snapshot.dayChangePct !== null
              ? `${messages.indices.colDayChange} ${formatPct(snapshot.dayChangePct)}`
              : "—"}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-fg))]">
            {messages.indices.colYtdChange}
          </div>
          <div
            className="font-mono text-sm"
            style={{
              color:
                snapshot.ytdChangePct !== null
                  ? `hsl(var(--${ytdPos ? "positive" : "negative"}))`
                  : undefined,
            }}
          >
            {snapshot.ytdChangePct !== null
              ? formatPct(snapshot.ytdChangePct)
              : "—"}
          </div>
        </div>
        <Sparkline
          points={snapshot.sparkline}
          width={128}
          height={36}
          ariaLabel={`Sparkline ${snapshot.name}`}
        />
      </div>
      <div className="mt-4 border-t pt-3">
        <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-fg))]">
          {messages.indices.topConstituents}
        </div>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {snapshot.topConstituents.map((c) => (
            <li key={c}>
              <Link
                href={`/ticker/${c.toLowerCase()}`}
                className="rounded border px-1.5 py-0.5 font-mono text-xs hover:surface"
              >
                {c}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {snapshot.error && (
        <p className="mt-3 text-xs text-[hsl(var(--negative))]">
          {snapshot.error}
        </p>
      )}
    </div>
  );
}
