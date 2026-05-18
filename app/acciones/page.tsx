import { messages } from "@/lib/messages/es-AR";
import { getFullEquitiesSnapshot } from "@/lib/equities/quotes";
import { EquitiesTable } from "@/components/equities-table";
import { SectorHeatmap } from "@/components/sector-heatmap";
import { formatTimestamp } from "@/lib/format";

// Re-render on the server every 30s. Aligns with the in-process quotes
// cache TTL so a request that survives the cache window gets fresh data.
export const revalidate = 30;

export default async function AccionesPage() {
  const snapshots = await getFullEquitiesSnapshot();
  const hasData = snapshots.some((s) => s.last !== null);
  const fetchedAt = Math.max(...snapshots.map((s) => s.timestamp), 0);

  return (
    <section className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {messages.acciones.title}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-fg))]">
            {messages.acciones.subtitle}
          </p>
        </div>
        {fetchedAt > 0 && (
          <p className="font-mono text-xs text-[hsl(var(--muted-fg))]">
            {messages.acciones.asOf} {formatTimestamp(fetchedAt)}
          </p>
        )}
      </header>

      <div className="mt-6 surface rounded-xl border p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-fg))]">
            {messages.acciones.heatmapTitle}
          </h2>
          <span className="text-xs text-[hsl(var(--muted-fg))]">
            {messages.acciones.heatmapHint}
          </span>
        </div>
        <div className="mt-2">
          <SectorHeatmap snapshots={snapshots} />
        </div>
      </div>

      <div className="mt-8">
        {hasData ? (
          <EquitiesTable snapshots={snapshots} />
        ) : (
          <div className="rounded-xl border p-6 text-sm text-[hsl(var(--muted-fg))]">
            {messages.acciones.error}
          </div>
        )}
      </div>
    </section>
  );
}
