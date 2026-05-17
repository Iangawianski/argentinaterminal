import type { Metadata } from "next";

import { FxBoard } from "@/components/fx-board";
import { getDefaultFxProvider } from "@/lib/fx";

export const metadata: Metadata = {
  title: "FX paralelo",
  description: "Cotizaciones del dólar en Argentina: oficial, mayorista, MEP, CCL y blue.",
};

// SSR with a 30s revalidate window so the first paint already has fresh
// data and the client `useQuery` (also 30s) takes over after hydration.
export const revalidate = 30;

export default async function FxPage() {
  const provider = getDefaultFxProvider();
  let initialData: { quotes: Awaited<ReturnType<typeof provider.getAll>>; asOf: string } | undefined;
  try {
    const quotes = await provider.getAll();
    initialData = { quotes, asOf: new Date().toISOString() };
  } catch {
    initialData = undefined;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <FxBoard initialData={initialData} />
    </div>
  );
}
