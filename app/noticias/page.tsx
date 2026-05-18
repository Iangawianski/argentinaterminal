import type { Metadata } from "next";

import { fetchNews, type NewsItem } from "@/lib/news/rss";

export const metadata: Metadata = {
  title: "Noticias",
  description:
    "Últimas noticias de economía y finanzas argentinas: Ámbito, La Nación y Clarín agregadas en un solo feed.",
};

export const revalidate = 600;

const TAG_LABELS: Record<NewsItem["tag"], string> = {
  economia: "Economía",
  finanzas: "Finanzas",
  dolar: "Dólar",
  mercados: "Mercados",
  politica: "Política",
};

export default async function NoticiasPage() {
  const data = await fetchNews({ limit: 50 });
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-fg))]">
          Noticias · Economía y mercados argentinos
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Noticias</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-fg))]">
          Ámbito, La Nación y Clarín. Cache 10 min. {data.items.length} titulares.
          {data.errors.length > 0 ? (
            <span className="ml-2 text-[11px]">
              ({data.errors.length} fuente
              {data.errors.length === 1 ? "" : "s"} caída
              {data.errors.length === 1 ? "" : "s"})
            </span>
          ) : null}
        </p>
      </header>

      <ol className="divide-y divide-[hsl(var(--border))] rounded-lg border">
        {data.items.map((item) => (
          <li key={item.url} className="px-3 py-2.5">
            <article className="flex flex-col gap-1">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm font-medium leading-snug hover:underline focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] focus:ring-offset-1"
              >
                {item.title}
              </a>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[hsl(var(--muted-fg))]">
                <span className="font-medium">{item.source.label}</span>
                <span aria-hidden>·</span>
                <span>{formatRelative(item.publishedAt)}</span>
                <span aria-hidden>·</span>
                <span className="rounded-sm border px-1.5 py-[1px] font-medium uppercase tracking-wider">
                  {TAG_LABELS[item.tag]}
                </span>
              </div>
            </article>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[11px] text-[hsl(var(--muted-fg))]">
        Fuente: RSS de los medios listados. Sin tracking, sin enlaces afiliados.
      </p>
    </section>
  );
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
