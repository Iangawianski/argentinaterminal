import { NextResponse } from "next/server";

import { fetchNews } from "@/lib/news/rss";

/**
 * Server-side aggregated news endpoint.
 *
 *   GET /api/news?limit=20&q=dolar,merval
 *
 * Cache 10 minutes (BCRA/inflation don't change faster, neither do
 * editorial cycles). On the wire we send the cache headers Vercel honors
 * for CDN edge — see `Cache-Control` below.
 */
export const revalidate = 600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 80) : 30;
  const q = url.searchParams.get("q") ?? "";
  const keywords = q
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = await fetchNews({ limit, keywords });
  return NextResponse.json(out, {
    headers: {
      "Cache-Control": "public, max-age=120, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
